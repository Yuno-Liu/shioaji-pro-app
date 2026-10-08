// src/lib/esun/adapter.ts — Driver interface for E.SUN Securities trading

import type {
    EsunOrderPayload,
    EsunOrderResult,
    EsunPlaceOrderResponse,
    EsunPriceFlag,
    EsunReplaceOrderResponse,
} from './types';

/** 抽象驅動介面：支援不同執行環境（Direct Node SDK、Mock 模擬、HTTP 橋接） */
export interface IEsunTradeDriver {
    readonly name: string;

    /** 送出委託 */
    placeOrder(payload: EsunOrderPayload): Promise<EsunPlaceOrderResponse>;

    /** 改價 */
    replacePrice(
        orderNo: string,
        price: number | EsunPriceFlag,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse>;

    /** 減量 / 改量 */
    replaceQuantity(
        orderNo: string,
        quantity: number,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse>;

    /** 刪單 */
    cancelOrder(
        orderNo: string,
        payload?: Partial<EsunOrderPayload>,
    ): Promise<EsunReplaceOrderResponse>;

    /** 查詢當日委託（可選） */
    getOrders?(): Promise<EsunOrderResult[]>;

    /** 登入 / 連線（可選） */
    login?(): Promise<void>;
}
