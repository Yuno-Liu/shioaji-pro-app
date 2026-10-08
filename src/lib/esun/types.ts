// src/lib/esun/types.ts — Types and definitions for E.SUN Securities (玉山證券) trading

import type { StockOrderReq, StockOrderLot, StockOrderCond, Action, OrderType, StockPriceType } from '../types/order';
import type { ContractBase } from '../types/contract';
import type { Account } from '../types/portfolio';

export const ESUN_BROKER_CODE = '9600';
export const ESUN_BROKER_NAME = '玉山證券';

/** E.SUN SDK ApCode (委託類別) */
export enum EsunApCode {
    Common = '1',       // 整股 (以張為單位)
    AfterMarket = '2',  // 盤後定價
    Odd = '3',          // 盤後零股 (以股為單位)
    Emg = '4',          // 興櫃
    IntradayOdd = '5',  // 盤中零股 (以股為單位)
}

/** E.SUN SDK BsFlag (委託條件 / 效期) */
export enum EsunBsFlag {
    ROD = 'R',
    IOC = 'I',
    FOK = 'F',
}

/** E.SUN SDK Side (買賣別) */
export enum EsunSide {
    Buy = 'B',
    Sell = 'S',
}

/** E.SUN SDK PriceFlag (價格旗標 / 價別) */
export enum EsunPriceFlag {
    Limit = '0',      // 限價
    Flat = '1',       // 平盤價
    LimitDown = '2',  // 跌停價
    LimitUp = '3',    // 漲停價
    Market = '4',     // 市價
}

/** E.SUN SDK TradeType (交易類別 / 信用別) */
export enum EsunTradeType {
    Cash = '0',            // 現股
    Margin = '3',          // 融資
    Short = '4',           // 融券
    DayTradingSell = 'A',  // 現股當沖先賣
}

/** Configuration required to connect to E.SUN Trading API */
export interface EsunClientConfig {
    apiUrl: string;
    apiKey: string;
    apiSecret: string;
    certPath: string;
    certPass: string;
    aid: string;
    password: string;
}

/** Order payload matching @esun/trade OrderPayload */
export interface EsunOrderPayload {
    stockNo: string;
    buySell: EsunSide;
    price: number;
    quantity: number;
    apCode: EsunApCode;
    priceFlag: EsunPriceFlag;
    bsFlag: EsunBsFlag;
    trade: EsunTradeType;
    userDef?: string;
}

/** Response returned by E.SUN placeOrder */
export interface EsunPlaceOrderResponse {
    retCode: string;
    retMsg: string;
    workDate: string;
    ordType: string;
    ordNo: string;
    ordDate: string;
    ordTime: string;
}

/** Response returned by E.SUN replacePrice / replaceQuantity / cancelOrder */
export interface EsunReplaceOrderResponse {
    retCode: string;
    retMsg: string;
    ordDate: string;
    ordTime: string;
}

/** Order result query item from E.SUN */
export interface EsunOrderResult {
    workDate: string;
    ordDate: string;
    ordTime: string;
    ordStatus: string;
    ordNo: string;
    preOrdNo: string;
    stockNo: string;
    buySell: string;
    apCode: string;
    priceFlag: string;
    trade: string;
    odPrice: string;
    orgQty: string;
    orgQtyShare: string;
    matQty: string;
    matQtyShare: string;
    celQty: string;
    celQtyShare: string;
    celable: string;
    errCode: string;
    errMsg: string;
    avgPrice: string;
    bsFlag: string;
    memo: string;
}
