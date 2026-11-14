import type { OrderCalculation, OrderStatus, PaymentLeg, Transaction } from '../types/payment';

const isCollected = (status: PaymentLeg['status']) =>
  status === 'captured' || status === 'settled' || status === 'refunded';
const isSettled = (status: PaymentLeg['status']) => status === 'settled' || status === 'refunded';

export function getOrderStatus(order: Transaction): OrderStatus {
  const legs = order.legs;
  if (legs.length === 0 || legs.every((leg) => leg.status === 'failed')) return 'failed';
  const refunds = legs.reduce((sum, leg) => sum + leg.refundedAmount, 0);
  if (refunds >= order.grossAmount) return 'refunded';
  if (legs.some((leg) => leg.status === 'failed')) return 'partial_failure';
  if (legs.every(isSettled)) return 'complete';
  if (legs.some((leg) => leg.status === 'captured' || leg.status === 'settled' || leg.status === 'refunded')) return 'processing';
  return 'pending';
}

export function calculateOrder(order: Transaction): OrderCalculation {
  const legs = order.legs;
  const grossAmount = order.grossAmount;
  const collectedAmount = legs.reduce((sum, leg) => sum + (isCollected(leg.status) ? leg.amount : 0), 0);
  const pendingAmount = legs.reduce((sum, leg) => sum + (leg.status === 'pending' || leg.status === 'authorized' ? leg.amount : 0), 0);
  const failedAmount = legs.reduce((sum, leg) => sum + (leg.status === 'failed' ? leg.amount : 0), 0);
  const capturedAmount = legs.reduce((sum, leg) => sum + (leg.status === 'captured' ? leg.amount : 0), 0);
  const settledLegs = legs.filter(isSettled);
  const settledGross = settledLegs.reduce((sum, leg) => sum + leg.amount, 0);
  const estimatedFees = legs.reduce((sum, leg) => sum + (isCollected(leg.status) ? leg.amount * leg.feeRate : 0), 0);
  const settledFees = settledLegs.reduce((sum, leg) => sum + leg.amount * leg.feeRate, 0);
  const refunds = legs.reduce((sum, leg) => sum + leg.refundedAmount, 0);
  const settledRefunds = settledLegs.reduce((sum, leg) => sum + leg.refundedAmount, 0);
  const retainedCollected = Math.max(0, collectedAmount - refunds);
  const netSettlement = Math.max(0, settledGross - settledFees - settledRefunds);
  const outstandingAmount = legs.reduce(
    (sum, leg) => sum + (leg.status === 'failed' ? 0 : (leg.status === 'pending' || leg.status === 'authorized' ? leg.amount : 0)),
    0,
  );

  return {
    status: getOrderStatus(order), grossAmount, collectedAmount, pendingAmount, failedAmount,
    capturedAmount, settledGross, estimatedFees, settledFees, refunds, retainedCollected,
    netSettlement, outstandingAmount,
  };
}

export function calculateSummary(orders: Transaction[]) {
  const currencies = [...new Set(orders.map((order) => order.currency))];
  return currencies.map((currency) => {
    const matching = orders.filter((order) => order.currency === currency);
    const totals = matching.map(calculateOrder);
    return {
      currency,
      orderCount: matching.length,
      grossSales: totals.reduce((sum, item) => sum + item.grossAmount, 0),
      collected: totals.reduce((sum, item) => sum + item.retainedCollected, 0),
      pending: totals.reduce((sum, item) => sum + item.pendingAmount, 0),
      failed: totals.reduce((sum, item) => sum + item.failedAmount, 0),
      settledGross: totals.reduce((sum, item) => sum + item.settledGross, 0),
      fees: totals.reduce((sum, item) => sum + item.settledFees, 0),
      refunds: totals.reduce((sum, item) => sum + item.refunds, 0),
      netSettlement: totals.reduce((sum, item) => sum + item.netSettlement, 0),
    };
  });
}

export function formatMoney(amount: number, currency: Transaction['currency']) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}