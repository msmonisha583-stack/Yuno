import { describe, expect, it } from 'vitest';
import { calculateOrder, calculateProcessorMetrics, calculateSummary, getOrderStatus, validateOrder } from './reconciliation';
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

  it('classifies mixed success and failure as partial failure', () => {
    const order = { ...base, legs: base.legs.map((leg, index) => ({ ...leg, status: index ? 'failed' as const : 'settled' as const })) };
    expect(getOrderStatus(order)).toBe('partial_failure');
  });

  it('deducts refunds from retained collections and settled net settlement', () => {
    const order = { ...base, legs: [{ ...base.legs[0], refundedAmount: 1000, status: 'refunded' as const }, base.legs[1]] };
    const result = calculateOrder(order);
    expect(result.refunds).toBe(1000);
    expect(result.retainedCollected).toBe(9000);
    expect(result.netSettlement).toBe(4880);
  });

  it('marks fully refunded collections as refunded, including orders with pending legs', () => {
    const order = { ...base, legs: [
      { ...base.legs[0], status: 'refunded' as const, refundedAmount: 6000 },
      { ...base.legs[1], status: 'pending' as const, refundedAmount: 0 },
    ] };
    expect(getOrderStatus(order)).toBe('refunded');
  });

  it('keeps summary totals separated by currency', () => {
    const ghana = { ...base, id: 'TEST-2', country: 'Ghana' as const, currency: 'GHS' as const, legs: base.legs.map((leg) => ({ ...leg, currency: 'GHS' as const })) };
    expect(calculateSummary([base, ghana]).map((item) => item.currency).sort()).toEqual(['GHS', 'NGN']);
  });

  it('does not count failed legs as outstanding', () => {
    const order = { ...base, legs: [{ ...base.legs[0], status: 'failed' as const }, { ...base.legs[1], status: 'authorized' as const }] };
    expect(calculateOrder(order).outstandingAmount).toBe(4000);
  });

  it('validates that tender legs reconcile exactly to order gross', () => {
    expect(validateOrder(base)).toEqual([]);
    const invalid = { ...base, legs: base.legs.map((leg, index) => index ? { ...leg, amount: 3900 } : leg) };
    expect(validateOrder(invalid)).toContain('Payment leg amounts do not add up to the order gross amount.');
  });

  it('rejects negative refunds, currency mismatches and invalid fee rates', () => {
    const invalid = { ...base, legs: [{ ...base.legs[0], refundedAmount: -1, feeRate: 1.5 }, { ...base.legs[1], currency: 'KES' as const }] };
    const errors = validateOrder(invalid);
    expect(errors.some((error) => error.includes('refund amount'))).toBe(true);
    expect(errors.some((error) => error.includes('fee rate'))).toBe(true);
    expect(errors.some((error) => error.includes('currency'))).toBe(true);
  });

  it('calculates failure rates from failed legs over total legs, not failed orders', () => {
    const metrics = calculateProcessorMetrics([base]);
    expect(metrics.find((item) => item.processor === 'Paystack')?.failureRate).toBe(0);
    const failedOrder = { ...base, legs: base.legs.map((leg) => ({ ...leg, status: 'failed' as const })) };
    expect(calculateProcessorMetrics([failedOrder]).every((item) => item.failureRate === 1)).toBe(true);
  });

  it('does not return NaN when invalid numeric inputs reach calculations', () => {
    const invalid = { ...base, legs: [{ ...base.legs[0], amount: Number.NaN, feeRate: Number.NaN }] };
    const result = calculateOrder(invalid);
    expect(Number.isFinite(result.collectedAmount)).toBe(true);
    expect(Number.isFinite(result.netSettlement)).toBe(true);
  });
});