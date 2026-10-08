// src/lib/esun/http-driver.ts — Browser driver: forwards E.SUN orders to the
// Node.js esun-bridge (server/esun-bridge.cjs) over same-origin /esun/* JSON.
// The native @esun/trade SDK cannot run in a browser, so every real order goes
// through the bridge.

import type { IEsunTradeDriver } from './adapter';
import type {
    EsunOrderPayload,
    EsunOrderResult,
    EsunPlaceOrderResponse,
    EsunPriceFlag,
    EsunReplaceOrderResponse,
} from './types';
import type { Account } from '../types/portfolio';

export interface EsunBridgeHealth {
    ok: boolean;
    configured: boolean;
    problems: string[];
    environment: 'SIMULATION' | 'PRODUCTION' | null;
    account: { broker_id: string; account_id: string } | null;
    loggedIn: boolean;
    loginError: string | null;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class EsunBridgeError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'EsunBridgeError';
    }
}

export class HttpEsunDriver implements IEsunTradeDriver {
    readonly name = 'http-bridge';

    constructor(
        private readonly base = '',
        private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    ) {}

    private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
        let res: Response;
        try {
            res = await this.fetchImpl(`${this.base}${path}`, {
                method,
                headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller?.signal,
            });
        } catch (err) {
            throw new EsunBridgeError(
                `無法連線玉山下單服務 (esun-bridge)：${err instanceof Error ? err.message : String(err)}`,
                0,
            );
        } finally {
            if (timer) clearTimeout(timer);
        }
        const text = await res.text();
        let data: unknown = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            throw new EsunBridgeError(`玉山下單服務回應格式錯誤（HTTP ${res.status}）`, res.status);
        }
        if (!res.ok) {
            const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
            throw new EsunBridgeError(msg, res.status);
        }
        return data as T;
    }

    health(timeoutMs?: number) {
        return this.request<EsunBridgeHealth>('GET', '/esun/health', undefined, timeoutMs);
    }

    accounts(timeoutMs?: number) {
        return this.request<Account[]>('GET', '/esun/accounts', undefined, timeoutMs);
    }

    placeOrder(payload: EsunOrderPayload) {
        return this.request<EsunPlaceOrderResponse>('POST', '/esun/orders/place', { payload });
    }

    replacePrice(orderNo: string, price: number | EsunPriceFlag, payload?: Partial<EsunOrderPayload>) {
        return this.request<EsunReplaceOrderResponse>('POST', '/esun/orders/replace-price', { orderNo, price, payload });
    }

    replaceQuantity(orderNo: string, quantity: number, payload?: Partial<EsunOrderPayload>) {
        return this.request<EsunReplaceOrderResponse>('POST', '/esun/orders/replace-qty', { orderNo, quantity, payload });
    }

    cancelOrder(orderNo: string, payload?: Partial<EsunOrderPayload>) {
        return this.request<EsunReplaceOrderResponse>('POST', '/esun/orders/cancel', { orderNo, payload });
    }

    getOrders() {
        return this.request<EsunOrderResult[]>('GET', '/esun/orders');
    }
}

/** 預設驅動：尚未連上 esun-bridge 時，任何委託都明確失敗（絕不假裝成功）。 */
export class UnavailableEsunDriver implements IEsunTradeDriver {
    readonly name = 'unavailable';

    constructor(private readonly reason = '玉山下單服務 (esun-bridge) 未連線，未送出委託') {}

    private fail(): never {
        throw Object.assign(new Error(this.reason), { mutationNotStarted: true as const });
    }

    async placeOrder(): Promise<EsunPlaceOrderResponse> { return this.fail(); }
    async replacePrice(): Promise<EsunReplaceOrderResponse> { return this.fail(); }
    async replaceQuantity(): Promise<EsunReplaceOrderResponse> { return this.fail(); }
    async cancelOrder(): Promise<EsunReplaceOrderResponse> { return this.fail(); }
    async getOrders(): Promise<EsunOrderResult[]> { return []; }
}
