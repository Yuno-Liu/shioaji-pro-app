// src/lib/esun/service.ts — E.SUN Securities trading service manager

import type { ContractBase } from '../types/contract';
import type { OrderResult, OrderStatusInfo, StockOrderReq, Trade } from '../types/order';
import type { Account } from '../types/portfolio';
import type { IEsunTradeDriver } from './adapter';
import { MockEsunDriver } from './mock-driver';
import {
    fromEsunOrderResponse,
    fromEsunOrderResult,
    isEsunAccount,
    toEsunOrderPayload,
    validateEsunStockOrder,
} from './order-mapping';
import { ESUN_BROKER_CODE, ESUN_BROKER_NAME, type EsunClientConfig } from './types';

function mutationNotStartedError(message: string): Error & { mutationNotStarted: true } {
    return Object.assign(new Error(message), {
        mutationNotStarted: true as const,
    });
}

export class EsunTradeService {
    private driver: IEsunTradeDriver;
    private accounts: Account[] = [];
    private config: Partial<EsunClientConfig> = {};

    constructor(initialDriver?: IEsunTradeDriver) {
        this.driver = initialDriver ?? new MockEsunDriver();
        this.initFromEnv();
    }

    private initFromEnv(): void {
        try {
            const env = (typeof import.meta !== 'undefined' && (import.meta as any).env)
                ? (import.meta as any).env
                : undefined;
            const aid = env?.VITE_ESUN_ACCOUNT || env?.VITE_ESUN_AID;
            const brokerId = env?.VITE_ESUN_BROKER_ID || ESUN_BROKER_CODE;
            const username = env?.VITE_ESUN_USERNAME || ESUN_BROKER_NAME;
            if (aid) {
                this.registerAccount({
                    account_type: 'S',
                    broker_id: String(brokerId),
                    account_id: String(aid),
                    signed: true,
                    username: String(username),
                    person_id: '',
                });
            }
        } catch {
            // ignore non-vite environments
        }
    }

    getDriver(): IEsunTradeDriver {
        return this.driver;
    }

    setDriver(driver: IEsunTradeDriver): void {
        this.driver = driver;
    }

    configure(config: Partial<EsunClientConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.aid && !this.accounts.some(a => a.account_id === config.aid)) {
            this.registerAccount({
                account_type: 'S',
                broker_id: ESUN_BROKER_CODE,
                account_id: config.aid,
                signed: true,
                username: ESUN_BROKER_NAME,
                person_id: '',
            });
        }
    }

    getConfig(): Partial<EsunClientConfig> {
        return this.config;
    }

    registerAccount(account: Account): void {
        if (!this.accounts.some(a => a.broker_id === account.broker_id && a.account_id === account.account_id)) {
            this.accounts.push(account);
        }
    }

    clearAccounts(): void {
        this.accounts = [];
    }

    getAccounts(): Account[] {
        return [...this.accounts];
    }

    /** 送出玉山證券現貨委託 */
    async placeStockOrder(
        contract: ContractBase,
        order: StockOrderReq,
        account: Account,
        opts?: { beforeDispatch?: () => void; onResponse?: (res: Response) => void },
    ): Promise<Trade> {
        if (!isEsunAccount(account)) {
            throw mutationNotStartedError('指定的帳戶非玉山證券帳戶');
        }

        const problem = validateEsunStockOrder(contract, order);
        if (problem) {
            throw mutationNotStartedError(problem);
        }

        opts?.beforeDispatch?.();

        const payload = toEsunOrderPayload(contract, order);
        const res = await this.driver.placeOrder(payload);

        if (opts?.onResponse) {
            try {
                opts.onResponse(
                    new Response(JSON.stringify(res), {
                        status: res.retCode === '000000' || res.retCode === '0' || !res.retCode ? 200 : 400,
                        headers: { 'Content-Type': 'application/json' },
                    }),
                );
            } catch {
                // Ignore mock response wrapper error
            }
        }

        if (res.retCode && res.retCode !== '000000' && res.retCode !== '0') {
            throw mutationNotStartedError(`玉山證券下單失敗 [${res.retCode}]：${res.retMsg}`);
        }

        return fromEsunOrderResponse(res, contract, order, account);
    }

    /** 取消玉山證券委託 */
    async cancelOrder(
        contract: ContractBase,
        order: OrderResult,
        account: Account,
        opts?: { beforeDispatch?: () => void },
    ): Promise<Trade> {
        const ordNo = order.ordno || order.seqno || order.id;
        if (!ordNo) {
            throw mutationNotStartedError('缺少玉山證券委託編號，無法刪單');
        }

        opts?.beforeDispatch?.();

        const res = await this.driver.cancelOrder(ordNo, {
            stockNo: contract.code,
        });

        if (res.retCode && res.retCode !== '000000' && res.retCode !== '0') {
            throw new Error(`玉山證券刪單失敗 [${res.retCode}]：${res.retMsg}`);
        }

        const statusInfo: OrderStatusInfo = {
            id: order.id,
            status: 'Cancelled',
            status_code: res.retCode,
            msg: res.retMsg || '已刪單',
            order_quantity: order.quantity,
            deal_quantity: 0,
            cancel_quantity: order.quantity,
            modified_price: 0,
            deals: [],
        };

        return {
            contract,
            order,
            status: statusInfo,
        };
    }

    /** 修改委託價格 */
    async updateOrderPrice(
        contract: ContractBase,
        order: OrderResult,
        newPrice: number,
        account: Account,
        opts?: { beforeDispatch?: () => void },
    ): Promise<Trade> {
        const ordNo = order.ordno || order.seqno || order.id;
        if (!ordNo) {
            throw mutationNotStartedError('缺少玉山證券委託編號，無法改價');
        }
        if (!Number.isFinite(newPrice) || newPrice <= 0) {
            throw mutationNotStartedError('改價需要大於 0 的有效價格');
        }

        opts?.beforeDispatch?.();

        const res = await this.driver.replacePrice(ordNo, newPrice, {
            stockNo: contract.code,
        });

        if (res.retCode && res.retCode !== '000000' && res.retCode !== '0') {
            throw new Error(`玉山證券改價失敗 [${res.retCode}]：${res.retMsg}`);
        }

        return {
            contract,
            order: { ...order, price: newPrice },
            status: {
                id: order.id,
                status: 'Submitted',
                status_code: res.retCode,
                msg: res.retMsg || '改價成功',
                order_quantity: order.quantity,
                deal_quantity: 0,
                cancel_quantity: 0,
                modified_price: newPrice,
                deals: [],
            },
        };
    }

    /** 修改委託數量（減量） */
    async updateOrderQty(
        contract: ContractBase,
        order: OrderResult,
        newQty: number,
        account: Account,
        opts?: { beforeDispatch?: () => void },
    ): Promise<Trade> {
        const ordNo = order.ordno || order.seqno || order.id;
        if (!ordNo) {
            throw mutationNotStartedError('缺少玉山證券委託編號，無法改量');
        }
        if (!Number.isSafeInteger(newQty) || newQty <= 0) {
            throw mutationNotStartedError('改量必須為正整數');
        }

        opts?.beforeDispatch?.();

        const res = await this.driver.replaceQuantity(ordNo, newQty, {
            stockNo: contract.code,
        });

        if (res.retCode && res.retCode !== '000000' && res.retCode !== '0') {
            throw new Error(`玉山證券改量失敗 [${res.retCode}]：${res.retMsg}`);
        }

        return {
            contract,
            order: { ...order, quantity: newQty },
            status: {
                id: order.id,
                status: 'Submitted',
                status_code: res.retCode,
                msg: res.retMsg || '改量成功',
                order_quantity: newQty,
                deal_quantity: 0,
                cancel_quantity: Math.max(0, order.quantity - newQty),
                modified_price: 0,
                deals: [],
            },
        };
    }

    /** 查詢玉山委託 */
    async fetchTrades(account: Account): Promise<Trade[]> {
        if (!this.driver.getOrders) return [];
        const results = await this.driver.getOrders();
        return results.map(r => fromEsunOrderResult(r, account));
    }
}

export const esunTradeService = new EsunTradeService();
