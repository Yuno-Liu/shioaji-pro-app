import { describe, expect, it } from 'vitest';
import { EsunTrade, Order } from '@esun/trade';

describe('EsunTrade Node.js SDK Smoke Test', () => {
    it('successfully imports and constructs Order', () => {
        const order = new Order({
            stockNo: '2884',
            buySell: Order.Side.Buy,
            price: 25.0,
            quantity: 1,
            apCode: Order.ApCode.Common,
            priceFlag: Order.PriceFlag.Limit,
            bsFlag: Order.BsFlag.ROD,
            trade: Order.Trade.Cash,
        });

        const obj = order.toObject();
        expect(obj.stockNo).toBe('2884');
        expect(obj.buySell).toBe('B');
        expect(obj.price).toBe('25');
        expect(obj.quantity).toBe('1');
        expect(obj.apCode).toBe('1');
        expect(obj.priceFlag).toBe('0');
        expect(obj.bsFlag).toBe('R');
        expect(obj.trade).toBe('0');
    });

    it('has EsunTrade class available', () => {
        expect(typeof EsunTrade).toBe('function');
    });
});
