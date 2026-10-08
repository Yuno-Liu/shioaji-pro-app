import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractBase } from './types/contract';
import type { Account } from './types/portfolio';
import type { ServerInfo } from './shioaji';
import { ESUN_BROKER_CODE } from './esun';

const m = vi.hoisted(() => ({
    accounts: [] as Account[],
    fetch: vi.fn(),
}));

vi.mock('./runtime', () => ({
    getApiBase: () => 'http://127.0.0.1:21322',
    isTauri: false,
}));
vi.mock('./account-store', () => ({
    getAccountState: () => ({ accounts: m.accounts, selectedStock: m.accounts[0] }),
    accountFor: () => m.accounts[0]!,
}));
vi.mock('./stream', () => ({ getStreamStatus: () => 'live' }));
vi.mock('./trading-mirror-lease', () => ({ getTradingMirrorFresh: () => true }));
vi.mock('./activity', () => ({ trackActivity: vi.fn() }));
vi.mock('./risk', () => ({
    checkOrderAllowed: () => null,
    getRiskSettings: () => ({ confirmManualOrders: false }),
}));

describe('Broker Dispatch: Shioaji vs E.SUN Securities', () => {
    let trade: typeof import('./trade');
    let shioaji: typeof import('./shioaji');
    let info: typeof import('./server-info-store');
    let esun: typeof import('./esun');

    const esunAccount: Account = {
        account_type: 'S',
        broker_id: ESUN_BROKER_CODE,
        account_id: '9600123',
        signed: true,
        username: '玉山戶',
        person_id: 'A123456789',
    };

    const sinopacAccount: Account = {
        account_type: 'S',
        broker_id: '9A95',
        account_id: '1234567',
        signed: true,
        username: '永豐戶',
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

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        m.accounts = [esunAccount, sinopacAccount];
        vi.stubGlobal('fetch', m.fetch);

        trade = await import('./trade');
        shioaji = await import('./shioaji');
        info = await import('./server-info-store');
        esun = await import('./esun');

        info.observeServerInfo(info.beginServerInfoRequest(), { simulation: false } as ServerInfo);
        esun.esunTradeService.setDriver(new esun.MockEsunDriver());
        esun.esunTradeService.clearAccounts();
        esun.esunTradeService.registerAccount(esunAccount);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('routes stock order to E.SUN service when E.SUN account is selected', async () => {
        const orderResult = await trade.placeQuickOrder(stockContract, 'Buy', 25.0, 2, {
            account: esunAccount,
            source: 'auto',
        });

        expect(orderResult.order.ordno).toMatch(/^E\d+/);
        expect(orderResult.order.account?.broker_id).toBe(ESUN_BROKER_CODE);
        expect(orderResult.order.price).toBe(25.0);
        expect(orderResult.order.quantity).toBe(2);
        expect(orderResult.status.status).toBe('Submitted');

        // Shioaji fetch should NOT be called for E.SUN orders
        expect(m.fetch).not.toHaveBeenCalled();
    });

    it('routes stock order to Shioaji API when SinoPac account is selected', async () => {
        const responseBody = JSON.stringify({
            contract: stockContract,
            order: {
                id: 'SINO123',
                seqno: '001',
                ordno: '001',
                action: 'Buy',
                price: 25.0,
                quantity: 1,
            },
            status: {
                status: 'Submitted',
                status_code: '000000',
            },
        });

        m.fetch.mockResolvedValueOnce(
            new Response(responseBody, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const orderResult = await trade.placeQuickOrder(stockContract, 'Buy', 25.0, 1, {
            account: sinopacAccount,
            source: 'auto',
        });

        expect(orderResult.order.id).toBe('SINO123');
        expect(m.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/v1/order/place_order'),
            expect.anything(),
        );
    });

    it('rejects futures order when E.SUN account is passed', async () => {
        await expect(
            trade.placeQuickOrder(futuresContract, 'Buy', 20000, 1, {
                account: esunAccount,
                source: 'auto',
            }),
        ).rejects.toMatchObject({
            mutationNotStarted: true,
            message: expect.stringContaining('玉山證券僅支援證券交易'),
        });
    });

    it('merges E.SUN accounts in fetchAccounts', async () => {
        m.fetch.mockResolvedValueOnce(
            new Response(JSON.stringify([sinopacAccount]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const accounts = await shioaji.fetchAccounts();
        expect(accounts.some(a => a.broker_id === ESUN_BROKER_CODE)).toBe(true);
        expect(accounts.some(a => a.broker_id === '9A95')).toBe(true);
    });

    it('cancels E.SUN order via esunTradeService', async () => {
        // Place an order first
        const placed = await trade.placeQuickOrder(stockContract, 'Buy', 25.0, 1, {
            account: esunAccount,
            source: 'auto',
        });

        const cancelResult = await esun.esunTradeService.cancelOrder(
            stockContract,
            placed.order,
            esunAccount,
        );

        expect(cancelResult.status.status).toBe('Cancelled');
        expect(cancelResult.status.cancel_quantity).toBe(1);
    });

    it('updates E.SUN order price and quantity', async () => {
        const placed = await trade.placeQuickOrder(stockContract, 'Buy', 25.0, 3, {
            account: esunAccount,
            source: 'auto',
        });

        const updatedPrice = await esun.esunTradeService.updateOrderPrice(
            stockContract,
            placed.order,
            26.0,
            esunAccount,
        );
        expect(updatedPrice.order.price).toBe(26.0);

        const updatedQty = await esun.esunTradeService.updateOrderQty(
            stockContract,
            placed.order,
            1,
            esunAccount,
        );
        expect(updatedQty.order.quantity).toBe(1);
        expect(updatedQty.status.cancel_quantity).toBe(2);
    });
});
