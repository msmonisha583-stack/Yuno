import { describe, expect, it } from 'vitest';
import { calculateOrder, calculateSummary, getOrderStatus } from './reconciliation';
import type { Transaction } from '../types/payment';

const base: Transaction = {
  id: 'TEST-1', customer: 'Test Customer', country: 'Nigeria', location: 'Lagos',
  createdAt: '2026-10-01T10:00:00.000Z', grossAmount: 10000, currency: 'NGN',
  legs: [
    { id: 'A', method: 'Visa', processor: 'Paystack', amount: 6000, currency: 'NGN', status: 'settled', feeRate: 0.02, createdAt: '2026-10-01T10:00:00.000Z', settlementDate: '2026-10-02T10:00:00.000Z', refundedAmount: 0 },
    { id: 'B', method: 'M-Pesa', processor: 'Safaricom', amount: 4000, currency: 'NGN', status: 'captured', feeRate: 0.01, createdAt: '2026-10-01T10:00:00.000Z', settlementDate: null, refundedAmount: 0 },
  ],
};

describe('reconciliation engine', () => {
  it('separates captured funds from settled bank funds', () => {
    const result = calculateOrder(base);
    expect(result.collectedAmount).toBe(10000);
    expect(result.capturedAmount).toBe(4000);
    expect(result.settledGross).toBe(6000);
    expect(result.settledFees).toBe(120);
    expect(result.netSettlement).toBe(5880);
    expect(result.status).toBe('processing');
  });

  it('classifies all-failed orders as failed, not partial failure', () => {
    const order = { ...base, legs: base.legs.map((leg) => ({ ...leg, status: 'failed' as const })) };
    expect(getOrderStatus(order)).toBe('failed');
  });

  it('classifies a mix of successful and failed legs as partial failure', () => {
    const order = { ...base, legs: base.legs.map((leg, index) => ({ ...leg, status: index ? 'failed' as const : 'settled' as const })) };
    expect(getOrderStatus(order)).toBe('partial_failure');
  });

  it('deducts refunds from retained collections and settled net settlement', () => {
    const order = { ...base, legs: [{ ...base.legs[0], refundedAmount: 1000 }, base.legs[1]] };
    const result = calculateOrder(order);
    expect(result.refunds).toBe(1000);
    expect(result.retainedCollected).toBe(9000);
    expect(result.netSettlement).toBe(4880);
  });

  it('keeps summary totals separated by currency', () => {
    const ghana = { ...base, id: 'TEST-2', country: 'Ghana' as const, currency: 'GHS' as const, legs: base.legs.map((leg) => ({ ...leg, currency: 'GHS' as const })) };
    expect(calculateSummary([base, ghana]).map((item) => item.currency).sort()).toEqual(['GHS', 'NGN']);
  });

  it('does not count a failed leg as outstanding', () => {
    const order = { ...base, legs: [{ ...base.legs[0], status: 'failed' as const }, { ...base.legs[1], status: 'authorized' as const }] };
    expect(calculateOrder(order).outstandingAmount).toBe(4000);
  });
});