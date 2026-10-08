// src/lib/esun/sdk-driver.ts — Direct Node.js SDK driver using @esun/trade

import type { IEsunTradeDriver } from './adapter';
import type {
    EsunClientConfig,
    EsunOrderPayload,
    EsunOrderResult,
    EsunPlaceOrderResponse,
    EsunPriceFlag,
    EsunReplaceOrderResponse,
} from './types';

export interface NodeSdkDriverOptions {
    configPath?: string;
    config?: Partial<EsunClientConfig>;
    /** 允許注入已存在的 client instance（測試或外部配置） */
    client?: any;
}

export class NodeSdkDriver implements IEsunTradeDriver {
    readonly name = 'node-sdk';

    private clientInstance: any = null;
    private options: NodeSdkDriverOptions;
    private sdkModule: any = null;

    constructor(options: NodeSdkDriverOptions = {}) {
        this.options = options;
        if (options.client) {
            this.clientInstance = options.client;
        }
    }

    private async getSdk(): Promise<any> {
        if (!this.sdkModule) {
            try {
                const pkgName = '@esun/trade';
                const main = await import(/* @vite-ignore */ pkgName);
                let PlacedOrder = (main as any).PlacedOrder;
                if (!PlacedOrder) {
                    try {
                        const poPkg = '@esun/trade/lib/placed-order';
                        const poModule = await import(/* @vite-ignore */ poPkg);
                        PlacedOrder = poModule.PlacedOrder;
                    } catch {
                        // ignore
                    }
                }
                this.sdkModule = { ...main, PlacedOrder };
            } catch (err) {
                throw new Error(
                    `無法載入 @esun/trade SDK 套件：${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }
        return this.sdkModule;
    }

    private async getClient(): Promise<any> {
        if (this.clientInstance) return this.clientInstance;
        const sdk = await this.getSdk();
        const { EsunTrade } = sdk;
        this.clientInstance = new EsunTrade({
            configPath: this.options.configPath,
            config: this.options.config,
        });
        return this.clientInstance;
    }

    async login(): Promise<void> {
        const client = await this.getClient();
        if (typeof client.login === 'function') {
            await client.login();
        }
    }

    async placeOrder(payload: EsunOrderPayload): Promise<EsunPlaceOrderResponse> {
        const sdk = await this.getSdk();
        const client = await this.getClient();
        const { Order } = sdk;

        const order = new Order({
            stockNo: payload.stockNo,
            buySell: payload.buySell,
            price: payload.price,
            quantity: payload.quantity,
            apCode: payload.apCode,
            priceFlag: payload.priceFlag,
            bsFlag: payload.bsFlag,
            trade: payload.trade,
            userDef: payload.userDef,
        });

        const res = await client.placeOrder(order);
        return res;
    }

    private async resolvePlacedOrder(
        orderNo: string,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<any> {
        const sdk = await this.getSdk();
        const client = await this.getClient();
        const { PlacedOrder } = sdk;

        if (typeof client.getOrders === 'function') {
            try {
                const orders = await client.getOrders();
                const matched = orders.find(
                    (o: any) => o.payload?.ordNo === orderNo || o.payload?.preOrdNo === orderNo,
                );
                if (matched) return matched;
            } catch {
                // fallback to synthetic PlacedOrder
            }
        }

        return new PlacedOrder({
            ordNo: orderNo,
            stockNo: payload?.stockNo || '',
            buySell: payload?.buySell || '',
            apCode: payload?.apCode || '1',
            priceFlag: payload?.priceFlag || '0',
            bsFlag: payload?.bsFlag || 'R',
            trade: payload?.trade || '0',
            odPrice: payload?.price !== undefined ? String(payload.price) : '0',
            orgQty: payload?.quantity !== undefined ? String(payload.quantity) : '1',
        });
    }

    async replacePrice(
        orderNo: string,
        price: number | EsunPriceFlag,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse> {
        const client = await this.getClient();
        const placed = await this.resolvePlacedOrder(orderNo, payload);
        return client.replacePrice(placed, price);
    }

    async replaceQuantity(
        orderNo: string,
        quantity: number,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse> {
        const client = await this.getClient();
        const placed = await this.resolvePlacedOrder(orderNo, payload);
        return client.replaceQuantity(placed, quantity);
    }

    async cancelOrder(
        orderNo: string,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse> {
        const client = await this.getClient();
        const placed = await this.resolvePlacedOrder(orderNo, payload);
        return client.cancelOrder(placed);
    }

    async getOrders(): Promise<EsunOrderResult[]> {
        const client = await this.getClient();
        if (typeof client.getOrders !== 'function') return [];
        const placedOrders = await client.getOrders();
        return placedOrders.map((p: any) => p.toObject());
    }
}
