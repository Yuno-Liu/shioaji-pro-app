// server/esun-bridge.cjs — 玉山證券下單橋接服務
//
// @esun/trade 是 Node.js 原生 addon（trade-core.*.node），瀏覽器無法載入。
// 本服務在 Node 端持有 SDK client，提供同源 JSON API（/esun/*）給前端：
//
//   GET  /esun/health                 服務 / 設定 / 登入狀態
//   GET  /esun/accounts               玉山帳戶清單（Account 格式）
//   GET  /esun/orders                 當日委託
//   POST /esun/orders/place           { payload }
//   POST /esun/orders/replace-price   { orderNo, price, payload? }
//   POST /esun/orders/replace-qty     { orderNo, quantity, payload? }
//   POST /esun/orders/cancel          { orderNo, payload? }
//
// 憑證／帳號密碼一律由環境變數提供（ESUN_PASSWORD、ESUN_CERT_PASSWORD），
// 不使用 SDK 的 keytar 儲存與 inquirer 互動輸入（容器內無法互動）。
// 登入失敗後不自動重試，避免以錯誤密碼反覆登入造成帳號鎖定；修正設定後重啟服務。

'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');

// ── keytar / inquirer stub ───────────────────────────────────────────────────
// SDK 的 utils/index 會在載入時 require keytar（原生模組）與 inquirer。
// 我們永遠以 config 直接提供 password/certPass，兩者都不會被呼叫。
const STUBS = {
    keytar: {
        getPassword: async () => null,
        setPassword: async () => undefined,
        deletePassword: async () => true,
    },
    inquirer: {
        prompt: async () => {
            throw new Error('esun-bridge 不支援互動輸入，請設定 ESUN_PASSWORD 與 ESUN_CERT_PASSWORD');
        },
    },
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(STUBS, request)) return STUBS[request];
    return originalLoad.call(this, request, parent, isMain);
};

// ── config ───────────────────────────────────────────────────────────────────

/** 最小 INI 解析（[Section] 與 key = value，# ; 開頭為註解） */
function parseIni(text) {
    const out = {};
    let section = out;
    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;
        const sec = /^\[(.+)\]$/.exec(line);
        if (sec) {
            section = out[sec[1].trim()] = out[sec[1].trim()] || {};
            continue;
        }
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        section[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
}

/** 11 碼帳號（分公司 4 碼 + 帳號 7 碼）切分 */
function splitAccount(aid) {
    const id = String(aid || '').trim();
    if (/^\d{11}$/.test(id)) return { broker_id: id.slice(0, 4), account_id: id.slice(4) };
    return { broker_id: '9600', account_id: id };
}

function loadConfig(env = process.env) {
    const configPath = path.resolve(env.ESUN_CONFIG_PATH || 'config.ini');
    const problems = [];
    if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) {
        return { configPath, problems: [`找不到玉山設定檔 ${configPath}`] };
    }
    const ini = parseIni(fs.readFileSync(configPath, 'utf8'));
    const certRaw = ini.Cert && ini.Cert.Path;
    const certPath = certRaw ? path.resolve(path.dirname(configPath), certRaw) : '';
    const config = {
        apiUrl: ini.Core && ini.Core.Entry,
        apiKey: ini.Api && ini.Api.Key,
        apiSecret: ini.Api && ini.Api.Secret,
        certPath,
        aid: ini.User && ini.User.Account,
        password: env.ESUN_PASSWORD || '',
        certPass: env.ESUN_CERT_PASSWORD || '',
    };
    if (!config.apiUrl) problems.push('config.ini 缺少 [Core] Entry');
    if (!config.apiKey) problems.push('config.ini 缺少 [Api] Key');
    if (!config.apiSecret) problems.push('config.ini 缺少 [Api] Secret');
    if (!config.aid) problems.push('config.ini 缺少 [User] Account');
    if (!certPath) problems.push('config.ini 缺少 [Cert] Path');
    else if (!fs.existsSync(certPath)) problems.push(`找不到憑證檔 ${certPath}`);
    if (!config.password) problems.push('未設定 ESUN_PASSWORD（玉山證券登入密碼）');
    if (!config.certPass) problems.push('未設定 ESUN_CERT_PASSWORD（憑證密碼）');
    const environment = /simulation/i.test(config.apiUrl || '') ? 'SIMULATION' : 'PRODUCTION';
    return { configPath, config, problems, environment };
}

// ── bridge core ──────────────────────────────────────────────────────────────

function defaultSdkLoader() {
    const sdk = require('@esun/trade');
    let PlacedOrder = sdk.PlacedOrder;
    if (!PlacedOrder) PlacedOrder = require('@esun/trade/lib/placed-order').PlacedOrder;
    return { EsunTrade: sdk.EsunTrade, Order: sdk.Order, PlacedOrder };
}

function createBridge(options = {}) {
    const loaded = options.loaded || loadConfig(options.env);
    const loadSdk = options.loadSdk || defaultSdkLoader;
    let sdk = null;
    let client = null;
    let loggedIn = false;
    let loginError = null;
    let loginPromise = null;

    function status() {
        const account = loaded.config && loaded.config.aid ? splitAccount(loaded.config.aid) : null;
        return {
            ok: true,
            configured: loaded.problems.length === 0,
            problems: loaded.problems,
            environment: loaded.environment || null,
            account,
            loggedIn,
            loginError,
        };
    }

    async function ensureLogin() {
        if (loggedIn) return client;
        if (loaded.problems.length) {
            throw Object.assign(new Error(`玉山設定不完整：${loaded.problems.join('；')}`), { status: 503 });
        }
        if (loginError) {
            throw Object.assign(new Error(`玉山登入失敗（請修正設定後重啟 esun-bridge）：${loginError}`), { status: 503 });
        }
        if (!loginPromise) {
            loginPromise = (async () => {
                try {
                    sdk = sdk || loadSdk();
                    client = new sdk.EsunTrade({ config: { ...loaded.config } });
                    await client.login();
                    loggedIn = true;
                    return client;
                } catch (err) {
                    loginError = err && err.message ? err.message : String(err);
                    throw Object.assign(new Error(`玉山登入失敗：${loginError}`), { status: 502 });
                } finally {
                    loginPromise = null;
                }
            })();
        }
        return loginPromise;
    }

    async function resolvePlacedOrder(c, orderNo, payload = {}) {
        if (typeof c.getOrders === 'function') {
            try {
                const orders = await c.getOrders();
                const hit = orders.find(o => o.payload && (o.payload.ordNo === orderNo || o.payload.preOrdNo === orderNo));
                if (hit) return hit;
            } catch {
                // fall through to a synthetic PlacedOrder
            }
        }
        return new sdk.PlacedOrder({
            ordNo: orderNo,
            stockNo: payload.stockNo || '',
            buySell: payload.buySell || '',
            apCode: payload.apCode || '1',
            priceFlag: payload.priceFlag || '0',
            bsFlag: payload.bsFlag || 'R',
            trade: payload.trade || '0',
            odPrice: payload.price !== undefined ? String(payload.price) : '0',
            orgQty: payload.quantity !== undefined ? String(payload.quantity) : '1',
        });
    }

    const routes = {
        'GET /esun/health': async () => status(),
        'GET /esun/accounts': async () => {
            const s = status();
            if (!s.account) return [];
            return [{
                account_type: 'S',
                broker_id: s.account.broker_id,
                account_id: s.account.account_id,
                signed: true,
                username: '玉山證券',
                person_id: '',
            }];
        },
        'GET /esun/orders': async () => {
            const c = await ensureLogin();
            if (typeof c.getOrders !== 'function') return [];
            const orders = await c.getOrders();
            return orders.map(o => (typeof o.toObject === 'function' ? o.toObject() : o));
        },
        'POST /esun/orders/place': async body => {
            const c = await ensureLogin();
            const p = body && body.payload;
            if (!p || !p.stockNo || !p.buySell || !p.quantity) {
                throw Object.assign(new Error('委託內容不完整（stockNo / buySell / quantity）'), { status: 400 });
            }
            const order = new sdk.Order({
                stockNo: p.stockNo,
                buySell: p.buySell,
                price: p.price,
                quantity: p.quantity,
                apCode: p.apCode,
                priceFlag: p.priceFlag,
                bsFlag: p.bsFlag,
                trade: p.trade,
                userDef: p.userDef,
            });
            return c.placeOrder(order);
        },
        'POST /esun/orders/replace-price': async body => {
            const c = await ensureLogin();
            requireOrderNo(body);
            const placed = await resolvePlacedOrder(c, body.orderNo, body.payload);
            return c.replacePrice(placed, body.price);
        },
        'POST /esun/orders/replace-qty': async body => {
            const c = await ensureLogin();
            requireOrderNo(body);
            const placed = await resolvePlacedOrder(c, body.orderNo, body.payload);
            return c.replaceQuantity(placed, Number(body.quantity));
        },
        'POST /esun/orders/cancel': async body => {
            const c = await ensureLogin();
            requireOrderNo(body);
            const placed = await resolvePlacedOrder(c, body.orderNo, body.payload);
            return c.cancelOrder(placed);
        },
    };

    function requireOrderNo(body) {
        if (!body || !body.orderNo) throw Object.assign(new Error('缺少委託書號 orderNo'), { status: 400 });
    }

    async function handle(req, res) {
        const url = new URL(req.url, 'http://bridge');
        const key = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
        const route = routes[key];
        if (!route) return send(res, 404, { error: `未知的端點 ${key}` });
        let body;
        if (req.method === 'POST') {
            // JSON-only：瀏覽器跨站表單無法送出 application/json（需 CORS preflight），擋掉 CSRF
            if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
                return send(res, 415, { error: 'Content-Type 必須為 application/json' });
            }
            try {
                body = JSON.parse((await readBody(req)) || '{}');
            } catch {
                return send(res, 400, { error: 'JSON 格式錯誤' });
            }
        }
        try {
            send(res, 200, await route(body));
        } catch (err) {
            send(res, err && err.status ? err.status : 502, { error: err && err.message ? err.message : String(err) });
        }
    }

    return { handle, status, ensureLogin };
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', c => {
            size += c.length;
            if (size > 64 * 1024) {
                reject(new Error('request too large'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function send(res, status, data) {
    const body = JSON.stringify(data === undefined ? null : data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
}

function startServer(options = {}) {
    const bridge = createBridge(options);
    const server = http.createServer((req, res) => {
        bridge.handle(req, res).catch(err => send(res, 500, { error: String(err && err.message || err) }));
    });
    return { bridge, server };
}

if (require.main === module) {
    const host = process.env.ESUN_BRIDGE_HOST || '127.0.0.1';
    const port = Number(process.env.ESUN_BRIDGE_PORT || 8090);
    const { bridge, server } = startServer();
    server.listen(port, host, () => {
        const s = bridge.status();
        console.log(`[esun-bridge] listening on http://${host}:${port}`);
        console.log(`[esun-bridge] account=${s.account ? `${s.account.broker_id}-${s.account.account_id}` : '-'} env=${s.environment || '-'}`);
        if (s.problems.length) {
            for (const p of s.problems) console.warn(`[esun-bridge] 設定問題：${p}`);
            return;
        }
        bridge.ensureLogin().then(
            () => console.log('[esun-bridge] 玉山證券登入成功'),
            err => console.error(`[esun-bridge] ${err.message}`),
        );
    });
}

module.exports = { parseIni, splitAccount, loadConfig, createBridge, startServer };
