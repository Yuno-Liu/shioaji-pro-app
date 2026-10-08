// src/lib/esun/order-mapping.ts — Order translation and validation for E.SUN Securities

import type { ContractBase } from '../types/contract';
import type { Action, OrderResult, OrderStatusInfo, OrderStatusName, StockOrderReq, Trade } from '../types/order';
import type { Account } from '../types/portfolio';
import {
    ESUN_BROKER_CODE,
    ESUN_BROKER_NAME,
    EsunApCode,
    EsunBsFlag,
    EsunOrderPayload,
    EsunOrderResult,
    EsunPlaceOrderResponse,
    EsunPriceFlag,
    EsunSide,
    EsunTradeType,
} from './types';

/** 判斷 broker_id 是否為玉山證券代號或名稱 */
export function isEsunBroker(brokerId?: string | null): boolean {
    if (!brokerId) return false;
    const b = brokerId.trim().toUpperCase();
    return (
        b === ESUN_BROKER_CODE ||
        b === 'ESUN' ||
        b === 'E.SUN' ||
        b === 'ESUNSEC' ||
        b === '玉山' ||
        b === ESUN_BROKER_NAME ||
        b.startsWith('96')
    );
}

/** 判斷帳戶是否為玉山證券帳戶 */
export function isEsunAccount(account?: Pick<Account, 'broker_id'> | null): boolean {
    return !!account && isEsunBroker(account.broker_id);
}

/** 驗證玉山證券下單條件；若不合法回傳錯誤訊息，合法回傳 null */
export function validateEsunStockOrder(
    contract: ContractBase,
    order: StockOrderReq,
): string | null {
    if (contract.security_type !== 'STK') {
        return '玉山證券僅支援台股現貨交易，不支援期貨、選擇權或指數商品';
    }

    if (!Number.isSafeInteger(order.quantity) || order.quantity <= 0) {
        return '委託數量必須為正整數';
    }

    if (order.order_lot === 'BlockTrade') {
        return '玉山證券 API 不支援鉅額交易';
    }

    if (
        order.order_cond === 'SBLShort' ||
        order.order_cond === 'SBLShortPriceExempt'
    ) {
        return '玉山證券 API 不支援借券賣出委託';
    }

    const isOdd =
        order.order_lot === 'IntradayOdd' || order.order_lot === 'Odd';

    if (isOdd) {
        if (order.quantity > 999) {
            return '零股委託數量必須在 1 至 999 股之間';
        }
        if (order.order_cond && order.order_cond !== 'Cash') {
            return '零股交易不支援融資券信用條件';
        }
        if (order.daytrade_short) {
            return '零股交易不支援現股當沖';
        }
        if (order.price_type === 'MKT') {
            return '零股交易不支援市價委託，請使用限價';
        }
        if (order.order_type && order.order_type !== 'ROD') {
            return '零股委託效期只能為 ROD';
        }
    }

    if (order.daytrade_short) {
        if (order.action !== 'Sell') {
            return '現股當沖先賣僅支援賣出委託';
        }
        if (order.order_cond && order.order_cond !== 'Cash') {
            return '現股當沖先賣僅適用現股條件';
        }
        if (order.order_lot && order.order_lot !== 'Common') {
            return '現股當沖先賣僅支援整股交易';
        }
    }

    if (order.price_type === 'LMT') {
        if (!Number.isFinite(order.price) || order.price <= 0) {
            return '限價委託需要大於 0 的有效價格';
        }
    }

    return null;
}

/** 將 Shioaji-Pro 的委託規格轉換為玉山證券 SDK 的 OrderPayload */
export function toEsunOrderPayload(
    contract: ContractBase,
    order: StockOrderReq,
): EsunOrderPayload {
    const buySell = order.action === 'Buy' ? EsunSide.Buy : EsunSide.Sell;

    let apCode = EsunApCode.Common;
    if (order.order_lot === 'IntradayOdd') {
        apCode = EsunApCode.IntradayOdd;
    } else if (order.order_lot === 'Odd') {
        apCode = EsunApCode.Odd;
    } else if (order.order_lot === 'Fixing') {
        apCode = EsunApCode.AfterMarket;
    }

    const priceFlag =
        order.price_type === 'MKT'
            ? EsunPriceFlag.Market
            : EsunPriceFlag.Limit;

    let bsFlag = EsunBsFlag.ROD;
    if (order.order_type === 'IOC') {
        bsFlag = EsunBsFlag.IOC;
    } else if (order.order_type === 'FOK') {
        bsFlag = EsunBsFlag.FOK;
    }

    let trade = EsunTradeType.Cash;
    if (order.daytrade_short && order.action === 'Sell') {
        trade = EsunTradeType.DayTradingSell;
    } else if (order.order_cond === 'MarginTrading') {
        trade = EsunTradeType.Margin;
    } else if (order.order_cond === 'ShortSelling') {
        trade = EsunTradeType.Short;
    }

    return {
        stockNo: contract.code.trim(),
        buySell,
        price: order.price_type === 'MKT' ? 0 : order.price,
        quantity: order.quantity,
        apCode,
        priceFlag,
        bsFlag,
        trade,
        userDef: order.custom_field,
    };
}

function isSuccessRetCode(retCode: string): boolean {
    return retCode === '000000' || retCode === '0' || retCode === '';
}

/** 將玉山證券 placeOrder 回應轉換為 Shioaji-Pro 標準 Trade 物件 */
export function fromEsunOrderResponse(
    res: EsunPlaceOrderResponse,
    contract: ContractBase,
    order: StockOrderReq,
    account: Account,
): Trade {
    const success = isSuccessRetCode(res.retCode);
    const ordNo = res.ordNo || '';
    const orderId = ordNo || `ESUN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const orderResult: OrderResult = {
        id: orderId,
        seqno: ordNo,
        ordno: ordNo,
        action: order.action,
        price: order.price,
        quantity: order.quantity,
        order_type: order.order_type,
        price_type: order.price_type,
        order_lot: order.order_lot ?? 'Common',
        order_cond: order.order_cond,
        daytrade_short: order.daytrade_short,
        custom_field: order.custom_field,
        account: {
            broker_id: account.broker_id || ESUN_BROKER_CODE,
            account_id: account.account_id,
            account_type: 'S',
        },
    };

    const statusInfo: OrderStatusInfo = {
        id: orderId,
        status: (success ? 'Submitted' : 'Failed') as OrderStatusName,
        status_code: res.retCode,
        msg: res.retMsg,
        order_quantity: order.quantity,
        deal_quantity: 0,
        cancel_quantity: 0,
        modified_price: 0,
        deals: [],
    };

    return {
        contract: {
            ...contract,
            security_type: 'STK',
            exchange: contract.exchange ?? 'TSE',
        },
        order: orderResult,
        status: statusInfo,
    };
}

/** 將玉山證券查詢回傳的委託紀錄轉換為 Trade 物件 */
export function fromEsunOrderResult(
    item: EsunOrderResult,
    account: Account,
): Trade {
    const action: Action = item.buySell === 'B' ? 'Buy' : 'Sell';
    const price = parseFloat(item.odPrice) || 0;
    const orgQty = parseInt(item.orgQty, 10) || parseInt(item.orgQtyShare, 10) || 0;
    const matQty = parseInt(item.matQty, 10) || parseInt(item.matQtyShare, 10) || 0;
    const celQty = parseInt(item.celQty, 10) || parseInt(item.celQtyShare, 10) || 0;

    let status: OrderStatusName = 'Submitted';
    if (matQty >= orgQty && orgQty > 0) {
        status = 'Filled';
    } else if (celQty >= orgQty && orgQty > 0) {
        status = 'Cancelled';
    } else if (matQty > 0) {
        status = 'PartFilled';
    } else if (item.ordStatus === 'Fail' || (item.errCode && item.errCode !== '000000')) {
        status = 'Failed';
    }

    let orderLot = 'Common';
    if (item.apCode === EsunApCode.IntradayOdd) orderLot = 'IntradayOdd';
    else if (item.apCode === EsunApCode.Odd) orderLot = 'Odd';
    else if (item.apCode === EsunApCode.AfterMarket) orderLot = 'Fixing';

    let orderCond = 'Cash';
    let daytradeShort = false;
    if (item.trade === EsunTradeType.Margin) orderCond = 'MarginTrading';
    else if (item.trade === EsunTradeType.Short) orderCond = 'ShortSelling';
    else if (item.trade === EsunTradeType.DayTradingSell) {
        orderCond = 'Cash';
        daytradeShort = true;
    }

    return {
        contract: {
            code: item.stockNo,
            security_type: 'STK',
            exchange: 'TSE',
            target_code: null,
        },
        order: {
            id: item.ordNo || item.preOrdNo,
            seqno: item.ordNo,
            ordno: item.ordNo,
            action,
            price,
            quantity: orgQty,
            order_lot: orderLot,
            order_cond: orderCond,
            daytrade_short: daytradeShort,
            custom_field: item.memo,
            account: {
                broker_id: account.broker_id || ESUN_BROKER_CODE,
                account_id: account.account_id,
                account_type: 'S',
            },
        },
        status: {
            id: item.ordNo || item.preOrdNo,
            status,
            status_code: item.errCode || '000000',
            msg: item.errMsg || '',
            order_quantity: orgQty,
            deal_quantity: matQty,
            cancel_quantity: celQty,
            modified_price: parseFloat(item.avgPrice) || 0,
            deals: [],
        },
    };
}
