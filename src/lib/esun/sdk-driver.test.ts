import { describe, expect, it, vi } from 'vitest';
import { NodeSdkDriver } from './sdk-driver';
import { EsunApCode, EsunBsFlag, EsunPriceFlag, EsunSide, EsunTradeType } from './types';

describe('NodeSdkDriver', () => {
    it('creates Order using @esun/trade and delegates to client.placeOrder', async () => {
        let placedOrderObj: any = null;
        const fakeClient = {
            placeOrder: vi.fn(async (order: any) => {
                placedOrderObj = order.toObject();
                return {
                    retCode: '000000',
                    retMsg: 'OK',
                    workDate: '20261009',
                    ordType: '0',
                    ordNo: 'E999',
                    ordDate: '20261009',
                    ordTime: '090000',
                };
            }),
        };

        const driver = new NodeSdkDriver({ client: fakeClient });
        const res = await driver.placeOrder({
            stockNo: '2884',
            buySell: EsunSide.Buy,
            price: 25.5,
            quantity: 1,
            apCode: EsunApCode.Common,
            priceFlag: EsunPriceFlag.Limit,
            bsFlag: EsunBsFlag.ROD,
            trade: EsunTradeType.Cash,
            userDef: 'test-custom',
        });

        expect(res.ordNo).toBe('E999');
        expect(fakeClient.placeOrder).toHaveBeenCalledOnce();
        expect(placedOrderObj).toEqual({
            stockNo: '2884',
            buySell: 'B',
            price: '25.5',
            quantity: '1',
            apCode: '1',
            priceFlag: '0',
            bsFlag: 'R',
            trade: '0',
        });
    });

    it('delegates cancelOrder, replacePrice, and replaceQuantity', async () => {
        const fakeClient = {
            cancelOrder: vi.fn(async (placedOrder: any) => ({
                retCode: '000000',
                retMsg: 'CANCEL OK',
                ordDate: '20261009',
                ordTime: '090100',
            })),
            replacePrice: vi.fn(async (placedOrder: any, price: any) => ({
                retCode: '000000',
                retMsg: 'PRICE OK',
                ordDate: '20261009',
                ordTime: '090200',
            })),
            replaceQuantity: vi.fn(async (placedOrder: any, qty: any) => ({
                retCode: '000000',
                retMsg: 'QTY OK',
                ordDate: '20261009',
                ordTime: '090300',
            })),
        };

        const driver = new NodeSdkDriver({ client: fakeClient });

        const cancelRes = await driver.cancelOrder('E999', { stockNo: '2884' });
        expect(cancelRes.retMsg).toBe('CANCEL OK');
        expect(fakeClient.cancelOrder).toHaveBeenCalledOnce();

        const priceRes = await driver.replacePrice('E999', 26.0, { stockNo: '2884' });
        expect(priceRes.retMsg).toBe('PRICE OK');
        expect(fakeClient.replacePrice).toHaveBeenCalledWith(expect.anything(), 26.0);

        const qtyRes = await driver.replaceQuantity('E999', 2, { stockNo: '2884' });
        expect(qtyRes.retMsg).toBe('QTY OK');
        expect(fakeClient.replaceQuantity).toHaveBeenCalledWith(expect.anything(), 2);
    });

    it('delegates getOrders and converts PlacedOrder', async () => {
        const fakeClient = {
            getOrders: vi.fn(async () => [
                {
                    toObject: () => ({
                        workDate: '20261009',
                        ordNo: 'E100',
                        stockNo: '2884',
                        buySell: 'B',
                    }),
                },
            ]),
        };

        const driver = new NodeSdkDriver({ client: fakeClient });
        const orders = await driver.getOrders();
        expect(orders).toHaveLength(1);
        expect(orders[0]?.ordNo).toBe('E100');
    });
});
