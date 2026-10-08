import { describe, expect, it } from 'vitest';
import type { ContractBase } from '../types/contract';
import type { StockOrderReq } from '../types/order';
import type { Account } from '../types/portfolio';
import {
    fromEsunOrderResponse,
    fromEsunOrderResult,
    isEsunAccount,
    isEsunBroker,
    toEsunOrderPayload,
    validateEsunStockOrder,
} from './order-mapping';
import {
    ESUN_BROKER_CODE,
    EsunApCode,
    EsunBsFlag,
    EsunOrderResult,
    EsunPriceFlag,
    EsunSide,
    EsunTradeType,
} from './types';

const esunAccount: Account = {
    account_type: 'S',
    broker_id: ESUN_BROKER_CODE,
    account_id: '9600123',
    signed: true,
    username: '測試玉山帳戶',
    person_id: 'A123456789',
};

const sinopacAccount: Account = {
    account_type: 'S',
    broker_id: '9A95',
    account_id: '9876543',
    signed: true,
    username: '永豐帳戶',
    person_id: 'A123456789',
};

const stockContract: ContractBase = {
    code: '2884',
    security_type: 'STK',
    exchange: 'TSE',
    target_code: null,
};

const futuresContract: ContractBase = {
    code: 'TXFR1',
    security_type: 'FUT',
    exchange: 'TAIFEX',
    target_code: null,
};

describe('isEsunBroker and isEsunAccount', () => {
    it('correctly identifies E.SUN broker identifiers', () => {
        expect(isEsunBroker('9600')).toBe(true);
        expect(isEsunBroker('9601')).toBe(true);
        expect(isEsunBroker('esun')).toBe(true);
        expect(isEsunBroker('ESUN')).toBe(true);
        expect(isEsunBroker('E.SUN')).toBe(true);
        expect(isEsunBroker('玉山')).toBe(true);
        expect(isEsunBroker('玉山證券')).toBe(true);

        expect(isEsunBroker('9A95')).toBe(false);
        expect(isEsunBroker('Sinopac')).toBe(false);
        expect(isEsunBroker('')).toBe(false);
        expect(isEsunBroker(null)).toBe(false);
        expect(isEsunBroker(undefined)).toBe(false);
    });

    it('identifies E.SUN accounts', () => {
        expect(isEsunAccount(esunAccount)).toBe(true);
        expect(isEsunAccount(sinopacAccount)).toBe(false);
        expect(isEsunAccount(null)).toBe(false);
    });
});

describe('validateEsunStockOrder', () => {
    it('rejects non-STK securities', () => {
        const order: StockOrderReq = {
            action: 'Buy',
            price: 25,
            quantity: 1,
            price_type: 'LMT',
            order_type: 'ROD',
        };
        expect(validateEsunStockOrder(futuresContract, order)).toContain('不支援期貨');
    });

    it('rejects invalid quantities', () => {
        const order: StockOrderReq = {
            action: 'Buy',
            price: 25,
            quantity: 0,
            price_type: 'LMT',
            order_type: 'ROD',
        };
        expect(validateEsunStockOrder(stockContract, order)).toContain('正整數');
    });

    it('rejects unsupported order lots and conditions', () => {
        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
                order_lot: 'BlockTrade',
            }),
        ).toContain('鉅額交易');

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Sell',
                price: 25,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
                order_cond: 'SBLShort',
            }),
        ).toContain('借券賣出');
    });

    it('validates odd lot constraints', () => {
        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 1000,
                price_type: 'LMT',
                order_type: 'ROD',
                order_lot: 'IntradayOdd',
            }),
        ).toContain('1 至 999');

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 100,
                price_type: 'LMT',
                order_type: 'ROD',
                order_lot: 'IntradayOdd',
                order_cond: 'MarginTrading',
            }),
        ).toContain('融資券');

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 0,
                quantity: 100,
                price_type: 'MKT',
                order_type: 'ROD',
                order_lot: 'IntradayOdd',
            }),
        ).toContain('不支援市價');

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 100,
                price_type: 'LMT',
                order_type: 'IOC',
                order_lot: 'IntradayOdd',
            }),
        ).toContain('只能為 ROD');
    });

    it('validates daytrade_short constraints', () => {
        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
                daytrade_short: true,
            }),
        ).toContain('僅支援賣出');

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Sell',
                price: 25,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
                order_cond: 'MarginTrading',
                daytrade_short: true,
            }),
        ).toContain('現股條件');
    });

    it('validates limit price', () => {
        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 0,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
            }),
        ).toContain('有效價格');
    });

    it('passes valid orders', () => {
        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
            }),
        ).toBeNull();

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Sell',
                price: 25,
                quantity: 2,
                price_type: 'LMT',
                order_type: 'ROD',
                daytrade_short: true,
            }),
        ).toBeNull();

        expect(
            validateEsunStockOrder(stockContract, {
                action: 'Buy',
                price: 25,
                quantity: 50,
                price_type: 'LMT',
                order_type: 'ROD',
                order_lot: 'IntradayOdd',
            }),
        ).toBeNull();
    });
});

describe('toEsunOrderPayload', () => {
    it('converts common limit buy order', () => {
        const payload = toEsunOrderPayload(stockContract, {
            action: 'Buy',
            price: 25.5,
            quantity: 3,
            price_type: 'LMT',
            order_type: 'ROD',
            order_cond: 'Cash',
            custom_field: 'grid-1',
        });

        expect(payload).toEqual({
            stockNo: '2884',
            buySell: EsunSide.Buy,
            price: 25.5,
            quantity: 3,
            apCode: EsunApCode.Common,
            priceFlag: EsunPriceFlag.Limit,
            bsFlag: EsunBsFlag.ROD,
            trade: EsunTradeType.Cash,
            userDef: 'grid-1',
        });
    });

    it('converts market sell order with IOC and margin', () => {
        const payload = toEsunOrderPayload(stockContract, {
            action: 'Sell',
            price: 0,
            quantity: 2,
            price_type: 'MKT',
            order_type: 'IOC',
            order_cond: 'MarginTrading',
        });

        expect(payload).toEqual({
            stockNo: '2884',
            buySell: EsunSide.Sell,
            price: 0,
            quantity: 2,
            apCode: EsunApCode.Common,
            priceFlag: EsunPriceFlag.Market,
            bsFlag: EsunBsFlag.IOC,
            trade: EsunTradeType.Margin,
            userDef: undefined,
        });
    });

    it('converts intraday odd lot and daytrade short', () => {
        const payloadOdd = toEsunOrderPayload(stockContract, {
            action: 'Buy',
            price: 25,
            quantity: 200,
            price_type: 'LMT',
            order_type: 'ROD',
            order_lot: 'IntradayOdd',
        });
        expect(payloadOdd.apCode).toBe(EsunApCode.IntradayOdd);

        const payloadDaytrade = toEsunOrderPayload(stockContract, {
            action: 'Sell',
            price: 25,
            quantity: 1,
            price_type: 'LMT',
            order_type: 'ROD',
            daytrade_short: true,
        });
        expect(payloadDaytrade.trade).toBe(EsunTradeType.DayTradingSell);
    });
});

describe('fromEsunOrderResponse and fromEsunOrderResult', () => {
    it('maps successful placeOrder response to Trade', () => {
        const order: StockOrderReq = {
            action: 'Buy',
            price: 25,
            quantity: 1,
            price_type: 'LMT',
            order_type: 'ROD',
            custom_field: 'my-tag',
        };
        const res = {
            retCode: '000000',
            retMsg: '委託成功',
            workDate: '20261009',
            ordType: '0',
            ordNo: 'B1234',
            ordDate: '20261009',
            ordTime: '090001',
        };

        const trade = fromEsunOrderResponse(res, stockContract, order, esunAccount);
        expect(trade.contract.code).toBe('2884');
        expect(trade.order.ordno).toBe('B1234');
        expect(trade.order.action).toBe('Buy');
        expect(trade.order.price).toBe(25);
        expect(trade.order.quantity).toBe(1);
        expect(trade.order.account?.broker_id).toBe(ESUN_BROKER_CODE);
        expect(trade.order.account?.account_id).toBe('9600123');
        expect(trade.status.status).toBe('Submitted');
        expect(trade.status.status_code).toBe('000000');
    });

    it('maps failed placeOrder response to Trade', () => {
        const order: StockOrderReq = {
            action: 'Buy',
            price: 25,
            quantity: 1,
            price_type: 'LMT',
            order_type: 'ROD',
        };
        const res = {
            retCode: 'ERR999',
            retMsg: '額度不足',
            workDate: '20261009',
            ordType: '0',
            ordNo: '',
            ordDate: '20261009',
            ordTime: '090001',
        };

        const trade = fromEsunOrderResponse(res, stockContract, order, esunAccount);
        expect(trade.status.status).toBe('Failed');
        expect(trade.status.msg).toBe('額度不足');
    });

    it('maps order query result to Trade', () => {
        const item: EsunOrderResult = {
            workDate: '20261009',
            ordDate: '20261009',
            ordTime: '090000',
            ordStatus: 'Filled',
            ordNo: 'ORD001',
            preOrdNo: 'ORD001',
            stockNo: '2884',
            buySell: 'B',
            apCode: '1',
            priceFlag: '0',
            trade: '0',
            odPrice: '25.0',
            orgQty: '2',
            orgQtyShare: '2000',
            matQty: '2',
            matQtyShare: '2000',
            celQty: '0',
            celQtyShare: '0',
            celable: 'N',
            errCode: '000000',
            errMsg: '',
            avgPrice: '25.0',
            bsFlag: 'R',
            memo: 'custom-note',
        };

        const trade = fromEsunOrderResult(item, esunAccount);
        expect(trade.order.id).toBe('ORD001');
        expect(trade.order.action).toBe('Buy');
        expect(trade.order.quantity).toBe(2);
        expect(trade.status.status).toBe('Filled');
        expect(trade.status.deal_quantity).toBe(2);
    });
});
