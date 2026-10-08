// src/lib/esun/mock-driver.ts — Mock driver for testing and simulation

import type { IEsunTradeDriver } from './adapter';
import type {
    EsunOrderPayload,
    EsunOrderResult,
    EsunPlaceOrderResponse,
    EsunPriceFlag,
    EsunReplaceOrderResponse,
} from './types';

export class MockEsunDriver implements IEsunTradeDriver {
    readonly name = 'mock';

    private seq = 1;
    private orders = new Map<string, EsunOrderPayload & { ordNo: string; celQty: number; orgQty: number }>();
    public simulateFailure: string | null = null;

    async placeOrder(payload: EsunOrderPayload): Promise<EsunPlaceOrderResponse> {
        if (this.simulateFailure) {
            return {
                retCode: '999999',
                retMsg: this.simulateFailure,
                workDate: '20261009',
                ordType: '0',
                ordNo: '',
                ordDate: '20261009',
                ordTime: '090000',
            };
        }

        const ordNo = `E${String(this.seq++).padStart(5, '0')}`;
        this.orders.set(ordNo, {
            ...payload,
            ordNo,
            orgQty: payload.quantity,
            celQty: 0,
        });

        return {
            retCode: '000000',
            retMsg: '委託成功',
            workDate: '20261009',
            ordType: '0',
            ordNo,
            ordDate: '20261009',
            ordTime: '090000',
        };
    }

    async replacePrice(
        orderNo: string,
        price: number | EsunPriceFlag,
    ): Promise<EsunReplaceOrderResponse> {
        if (this.simulateFailure) {
            return {
                retCode: '999999',
                retMsg: this.simulateFailure,
                ordDate: '20261009',
                ordTime: '090100',
            };
        }

        const existing = this.orders.get(orderNo);
        if (existing && typeof price === 'number') {
            existing.price = price;
        }

        return {
            retCode: '000000',
            retMsg: '改價成功',
            ordDate: '20261009',
            ordTime: '090100',
        };
    }

    async replaceQuantity(
        orderNo: string,
        quantity: number,
    ): Promise<EsunReplaceOrderResponse> {
        if (this.simulateFailure) {
            return {
                retCode: '999999',
                retMsg: this.simulateFailure,
                ordDate: '20261009',
                ordTime: '090200',
            };
        }

        const existing = this.orders.get(orderNo);
        if (existing) {
            existing.quantity = quantity;
        }

        return {
            retCode: '000000',
            retMsg: '改量成功',
            ordDate: '20261009',
            ordTime: '090200',
        };
    }

    async cancelOrder(orderNo: string): Promise<EsunReplaceOrderResponse> {
        if (this.simulateFailure) {
            return {
                retCode: '999999',
                retMsg: this.simulateFailure,
                ordDate: '20261009',
                ordTime: '090300',
            };
        }

        const existing = this.orders.get(orderNo);
        if (existing) {
            existing.celQty = existing.quantity;
            existing.quantity = 0;
        }

        return {
            retCode: '000000',
            retMsg: '刪單成功',
            ordDate: '20261009',
            ordTime: '090300',
        };
    }

    async getOrders(): Promise<EsunOrderResult[]> {
        const out: EsunOrderResult[] = [];
        for (const o of this.orders.values()) {
            out.push({
                workDate: '20261009',
                ordDate: '20261009',
                ordTime: '090000',
                ordStatus: o.celQty >= o.orgQty ? 'Cancel' : 'Submitted',
                ordNo: o.ordNo,
                preOrdNo: o.ordNo,
                stockNo: o.stockNo,
                buySell: o.buySell,
                apCode: o.apCode,
                priceFlag: o.priceFlag,
                trade: o.trade,
                odPrice: String(o.price),
                orgQty: String(o.orgQty),
                orgQtyShare: String(o.orgQty * (o.apCode === '1' ? 1000 : 1)),
                matQty: '0',
                matQtyShare: '0',
                celQty: String(o.celQty),
                celQtyShare: String(o.celQty * (o.apCode === '1' ? 1000 : 1)),
                celable: o.celQty < o.orgQty ? 'Y' : 'N',
                errCode: '000000',
                errMsg: '',
                avgPrice: '0',
                bsFlag: o.bsFlag,
                memo: o.userDef || '',
            });
        }
        return out;
    }
}
