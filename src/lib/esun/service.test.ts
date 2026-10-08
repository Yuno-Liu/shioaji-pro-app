import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractBase } from '../types/contract';
import type { OrderResult, StockOrderReq } from '../types/order';
import type { Account } from '../types/portfolio';
import { MockEsunDriver } from './mock-driver';
import { EsunTradeService } from './service';
import { ESUN_BROKER_CODE } from './types';

const esunAccount: Account = {
    account_type: 'S',
    broker_id: ESUN_BROKER_CODE,
    account_id: '9600123',
    signed: true,
    username: '測試玉山帳戶',
    person_id: 'A123456789',
};

const otherAccount: Account = {
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

describe('EsunTradeService', () => {
    let service: EsunTradeService;
    let mockDriver: MockEsunDriver;

    beforeEach(() => {
        mockDriver = new MockEsunDriver();
        service = new EsunTradeService(mockDriver);
    });

    describe('account management and configuration', () => {
        it('registers and retrieves accounts', () => {
            service.registerAccount(esunAccount);
            expect(service.getAccounts()).toHaveLength(1);
            expect(service.getAccounts()[0]?.account_id).toBe('9600123');

            // does not duplicate identical account
            service.registerAccount(esunAccount);
            expect(service.getAccounts()).toHaveLength(1);

            service.clearAccounts();
            expect(service.getAccounts()).toHaveLength(0);
        });

        it('auto-registers account when aid is provided in config', () => {
            service.configure({ aid: '9600999', apiKey: 'test-key' });
            const accounts = service.getAccounts();
            expect(accounts).toHaveLength(1);
            expect(accounts[0]?.broker_id).toBe(ESUN_BROKER_CODE);
            expect(accounts[0]?.account_id).toBe('9600999');
            expect(service.getConfig().apiKey).toBe('test-key');
        });
    });

    describe('placeStockOrder', () => {
        it('places order successfully via driver', async () => {
            service.registerAccount(esunAccount);
            const req: StockOrderReq = {
                action: 'Buy',
                price: 25.0,
                quantity: 2,
                price_type: 'LMT',
                order_type: 'ROD',
                custom_field: 'test-tag',
            };

            const beforeDispatch = vi.fn();
            const onResponse = vi.fn();

            const trade = await service.placeStockOrder(stockContract, req, esunAccount, {
                beforeDispatch,
                onResponse,
            });

            expect(beforeDispatch).toHaveBeenCalledOnce();
            expect(onResponse).toHaveBeenCalledOnce();
            expect(trade.contract.code).toBe('2884');
            expect(trade.order.ordno).toMatch(/^E\d+/);
            expect(trade.order.quantity).toBe(2);
            expect(trade.order.price).toBe(25.0);
            expect(trade.status.status).toBe('Submitted');
            expect(trade.order.custom_field).toBe('test-tag');
        });

        it('rejects order with non-E.SUN account', async () => {
            const req: StockOrderReq = {
                action: 'Buy',
                price: 25.0,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
            };

            await expect(
                service.placeStockOrder(stockContract, req, otherAccount),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('非玉山證券帳戶'),
            });
        });

        it('rejects invalid order parameters before dispatching', async () => {
            const req: StockOrderReq = {
                action: 'Buy',
                price: 0,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
            };

            const beforeDispatch = vi.fn();
            await expect(
                service.placeStockOrder(stockContract, req, esunAccount, { beforeDispatch }),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('有效價格'),
            });
            expect(beforeDispatch).not.toHaveBeenCalled();
        });

        it('handles driver error and sets mutationNotStarted', async () => {
            mockDriver.simulateFailure = '市場已收盤，無法下單';
            const req: StockOrderReq = {
                action: 'Buy',
                price: 25.0,
                quantity: 1,
                price_type: 'LMT',
                order_type: 'ROD',
            };

            await expect(
                service.placeStockOrder(stockContract, req, esunAccount),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('市場已收盤'),
            });
        });
    });

    describe('cancelOrder', () => {
        it('cancels order and marks status Cancelled', async () => {
            const order: OrderResult = {
                id: 'E00001',
                seqno: 'E00001',
                ordno: 'E00001',
                action: 'Buy',
                price: 25.0,
                quantity: 2,
            };

            const beforeDispatch = vi.fn();
            const trade = await service.cancelOrder(stockContract, order, esunAccount, {
                beforeDispatch,
            });

            expect(beforeDispatch).toHaveBeenCalledOnce();
            expect(trade.status.status).toBe('Cancelled');
            expect(trade.status.cancel_quantity).toBe(2);
        });

        it('rejects cancel without order number', async () => {
            const order: OrderResult = {
                id: '',
                seqno: '',
                ordno: '',
                action: 'Buy',
                price: 25.0,
                quantity: 1,
            };

            await expect(
                service.cancelOrder(stockContract, order, esunAccount),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('缺少玉山證券委託編號'),
            });
        });
    });

    describe('updateOrderPrice and updateOrderQty', () => {
        const order: OrderResult = {
            id: 'E00002',
            seqno: 'E00002',
            ordno: 'E00002',
            action: 'Buy',
            price: 25.0,
            quantity: 5,
        };

        it('updates price successfully', async () => {
            const trade = await service.updateOrderPrice(stockContract, order, 25.5, esunAccount);
            expect(trade.order.price).toBe(25.5);
            expect(trade.status.modified_price).toBe(25.5);
        });

        it('rejects invalid price', async () => {
            await expect(
                service.updateOrderPrice(stockContract, order, -1, esunAccount),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('大於 0'),
            });
        });

        it('updates quantity successfully', async () => {
            const trade = await service.updateOrderQty(stockContract, order, 2, esunAccount);
            expect(trade.order.quantity).toBe(2);
            expect(trade.status.order_quantity).toBe(2);
            expect(trade.status.cancel_quantity).toBe(3);
        });

        it('rejects invalid quantity', async () => {
            await expect(
                service.updateOrderQty(stockContract, order, 0, esunAccount),
            ).rejects.toMatchObject({
                mutationNotStarted: true,
                message: expect.stringContaining('正整數'),
            });
        });
    });

    describe('fetchTrades', () => {
        it('queries trades and maps them', async () => {
            await service.placeStockOrder(
                stockContract,
                { action: 'Buy', price: 25, quantity: 1, price_type: 'LMT', order_type: 'ROD' },
                esunAccount,
            );

            const trades = await service.fetchTrades(esunAccount);
            expect(trades).toHaveLength(1);
            expect(trades[0]?.contract.code).toBe('2884');
            expect(trades[0]?.order.action).toBe('Buy');
        });
    });
});
