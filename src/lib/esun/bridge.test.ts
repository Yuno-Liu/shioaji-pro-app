// src/lib/esun/bridge.test.ts — esun-bridge (server/esun-bridge.cjs) HTTP 路由與
// HttpEsunDriver 端對端：真實 HTTP server + 假 SDK，驗證瀏覽器 → bridge → SDK 整條鏈路。

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpEsunDriver, UnavailableEsunDriver } from './http-driver';
import { EsunTradeService } from './service';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridgeModule = require('../../../server/esun-bridge.cjs') as {
    parseIni: (t: string) => Record<string, Record<string, string>>;
    loadConfig: (env: Record<string, string>) => { problems: string[]; config?: Record<string, string>; environment?: string };
    startServer: (o: unknown) => { server: Server };
};

function makeFakeSdk(opts: { loginError?: string } = {}) {
    const calls: { method: string; args: unknown[] }[] = [];
    let logins = 0;
    class Order { constructor(public payload: Record<string, unknown>) {} }
    class PlacedOrder {
        constructor(public payload: Record<string, unknown>) {}
        toObject() { return { ...this.payload }; }
    }
    class EsunTrade {
        constructor(public options: { config: Record<string, string> }) { calls.push({ method: 'ctor', args: [options.config] }); }
        async login() { logins++; if (opts.loginError) throw new Error(opts.loginError); }
        async placeOrder(o: Order) { calls.push({ method: 'placeOrder', args: [o.payload] }); return { ordNo: 'A0001', retCode: '000000', retMsg: '' }; }
        async getOrders() { return [new PlacedOrder({ ordNo: 'A0001', stockNo: '2884', buySell: 'B', orgQty: '1', odPrice: '25' })]; }
        async replacePrice(p: PlacedOrder, price: number) { calls.push({ method: 'replacePrice', args: [p.payload, price] }); return { retCode: '000000', retMsg: '' }; }
        async replaceQuantity(p: PlacedOrder, q: number) { calls.push({ method: 'replaceQuantity', args: [p.payload, q] }); return { retCode: '000000', retMsg: '' }; }
        async cancelOrder(p: PlacedOrder) { calls.push({ method: 'cancelOrder', args: [p.payload] }); return { retCode: '000000', retMsg: '' }; }
    }
    return { sdk: { EsunTrade, Order, PlacedOrder }, calls, logins: () => logins };
}

let tmp: string;
let server: Server | null = null;

function writeConfig() {
    fs.mkdirSync(path.join(tmp, 'certs'));
    fs.writeFileSync(path.join(tmp, 'certs', 'c.p12'), 'x');
    fs.writeFileSync(path.join(tmp, 'config.ini'), [
        '# comment', '[Core]', 'Entry = https://esuntradingapi-simulation.esunsec.com.tw/api/v1',
        '[Cert]', 'Path = ./certs/c.p12', '[Api]', 'Key = k', 'Secret = s', '[User]', 'Account = 88400664718', '',
    ].join('\r\n'));
}

async function start(env: Record<string, string>, fake = makeFakeSdk()) {
    const loaded = bridgeModule.loadConfig({ ESUN_CONFIG_PATH: path.join(tmp, 'config.ini'), ...env });
    const s = bridgeModule.startServer({ loaded, loadSdk: () => fake.sdk });
    server = s.server;
    await new Promise<void>(r => server!.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    return { base: `http://127.0.0.1:${port}`, fake, loaded };
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esun-bridge-'));
    writeConfig();
});

afterEach(async () => {
    if (server) await new Promise(r => server!.close(r));
    server = null;
    fs.rmSync(tmp, { recursive: true, force: true });
});

const creds = { ESUN_PASSWORD: 'pw', ESUN_CERT_PASSWORD: 'cpw' };

describe('esun-bridge config', () => {
    it('parses config.ini, splits the 8840 account and resolves cert relative to config', () => {
        const loaded = bridgeModule.loadConfig({ ESUN_CONFIG_PATH: path.join(tmp, 'config.ini'), ...creds });
        expect(loaded.problems).toEqual([]);
        expect(loaded.environment).toBe('SIMULATION');
        expect(loaded.config!.certPath).toBe(path.join(tmp, 'certs', 'c.p12'));
        expect(loaded.config!.aid).toBe('88400664718');
    });

    it('reports missing passwords instead of prompting', () => {
        const loaded = bridgeModule.loadConfig({ ESUN_CONFIG_PATH: path.join(tmp, 'config.ini') });
        expect(loaded.problems.join()).toContain('ESUN_PASSWORD');
        expect(loaded.problems.join()).toContain('ESUN_CERT_PASSWORD');
    });
});

describe('esun-bridge HTTP + HttpEsunDriver', () => {
    it('lists the account and places / modifies / cancels orders through the SDK', async () => {
        const { base, fake } = await start(creds);
        const driver = new HttpEsunDriver(base);

        const health = await driver.health();
        expect(health).toMatchObject({ configured: true, account: { broker_id: '8840', account_id: '0664718' } });
        expect(await driver.accounts()).toEqual([expect.objectContaining({ broker_id: '8840', account_id: '0664718', account_type: 'S', signed: true })]);

        const placed = await driver.placeOrder({ stockNo: '2884', buySell: 'B', price: 25, quantity: 1, apCode: '1', priceFlag: '0', bsFlag: 'R', trade: '0' } as never);
        expect(placed).toMatchObject({ ordNo: 'A0001', retCode: '000000' });
        expect(fake.calls[0]!.args[0]).toMatchObject({ password: 'pw', certPass: 'cpw', aid: '88400664718' });

        await driver.replacePrice('A0001', 26);
        await driver.replaceQuantity('A0001', 1);
        await driver.cancelOrder('A0001');
        expect(fake.calls.map(c => c.method)).toEqual(['ctor', 'placeOrder', 'replacePrice', 'replaceQuantity', 'cancelOrder']);
        expect(fake.logins()).toBe(1);
        expect(await driver.getOrders()).toEqual([expect.objectContaining({ ordNo: 'A0001' })]);
    });

    it('fails closed with a clear error when passwords are missing', async () => {
        const { base, fake } = await start({});
        const driver = new HttpEsunDriver(base);
        await expect(driver.placeOrder({ stockNo: '2884', buySell: 'B', quantity: 1 } as never)).rejects.toThrow(/ESUN_PASSWORD/);
        expect(fake.calls).toEqual([]);
    });

    it('does not retry login after a failure (avoids account lock-out)', async () => {
        const fake = makeFakeSdk({ loginError: 'C00003: cert password may be wrong' });
        const { base } = await start(creds, fake);
        const driver = new HttpEsunDriver(base);
        await expect(driver.placeOrder({ stockNo: '2884', buySell: 'B', quantity: 1 } as never)).rejects.toThrow(/C00003/);
        await expect(driver.placeOrder({ stockNo: '2884', buySell: 'B', quantity: 1 } as never)).rejects.toThrow(/重啟/);
        expect(fake.logins()).toBe(1);
        expect((await driver.health()).loginError).toContain('C00003');
    });

    it('rejects non-JSON POSTs (CSRF guard)', async () => {
        const { base } = await start(creds);
        const res = await fetch(`${base}/esun/orders/place`, { method: 'POST', body: 'payload=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        expect(res.status).toBe(415);
    });
});

describe('EsunTradeService.connectBridge', () => {
    it('switches to the bridge driver and registers bridge accounts', async () => {
        const { base } = await start(creds);
        const service = new EsunTradeService(new UnavailableEsunDriver());
        service.clearAccounts();
        const health = await service.connectBridge(new HttpEsunDriver(base));
        expect(health?.configured).toBe(true);
        expect(service.getDriver().name).toBe('http-bridge');
        expect(service.getAccounts()).toEqual([expect.objectContaining({ broker_id: '8840', account_id: '0664718' })]);
    });

    it('keeps the fail-closed driver when the bridge is unreachable', async () => {
        const service = new EsunTradeService(new UnavailableEsunDriver());
        const health = await service.connectBridge(new HttpEsunDriver('http://127.0.0.1:1'));
        expect(health).toBeNull();
        expect(service.getDriver().name).toBe('unavailable');
        await expect(service.getDriver().placeOrder({} as never)).rejects.toThrow(/esun-bridge/);
    });
});
