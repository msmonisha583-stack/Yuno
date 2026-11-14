import type { OrderCalculation, OrderStatus, PaymentLeg, Transaction } from '../types/payment';

const amountOf = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const isCollected = (status: PaymentLeg['status']) =>
  status === 'captured' || status === 'settled' || status === 'refunded';
const isSettled = (status: PaymentLeg['status']) => status === 'settled' || status === 'refunded';
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const rateOf = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

export function validateOrder(order: Transaction): string[] {
  const errors: string[] = [];
  if (!order.id.trim()) errors.push('Order ID is required.');
  if (!Number.isFinite(order.grossAmount) || order.grossAmount <= 0) errors.push('Gross amount must be greater than zero.');
  if (!order.legs.length) errors.push('An order must contain at least one payment leg.');
  order.legs.forEach((leg, index) => {
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) errors.push(`Payment leg ${index + 1} must have a positive amount.`);
    if (leg.currency !== order.currency) errors.push(`Payment leg ${index + 1} currency does not match the order currency.`);
    if (!Number.isFinite(leg.feeRate) || leg.feeRate < 0 || leg.feeRate > 1) errors.push(`Payment leg ${index + 1} has an invalid fee rate.`);
    if (!Number.isFinite(leg.refundedAmount) || leg.refundedAmount < 0 || leg.refundedAmount > leg.amount) errors.push(`Payment leg ${index + 1} has an invalid refund amount.`);
    if (leg.status !== 'refunded' && leg.refundedAmount > 0) errors.push(`Payment leg ${index + 1} has a refund but is not marked refunded.`);
  });
  const legTotal = sum(order.legs.map((leg) => amountOf(leg.amount)));
  if (Number.isFinite(order.grossAmount) && Math.abs(legTotal - order.grossAmount) > 0.01) {
    errors.push('Payment leg amounts do not add up to the order gross amount.');
  }
  return errors;
}

export function getOrderStatus(order: Transaction): OrderStatus {
  const legs = order.legs;
  if (!legs.length || legs.every((leg) => leg.status === 'failed')) return 'failed';
  const collected = sum(legs.filter((leg) => isCollected(leg.status)).map((leg) => amountOf(leg.amount)));
  const refunds = sum(legs.map((leg) => Math.min(amountOf(leg.refundedAmount), amountOf(leg.amount))));
  if (collected > 0 && refunds >= collected - 0.01) return 'refunded';
  if (legs.some((leg) => leg.status === 'failed')) return 'partial_failure';
  if (legs.every(isSettled)) return 'complete';
  if (legs.some(isCollected)) return 'processing';
  return 'pending';
}

export function calculateOrder(order: Transaction): OrderCalculation {
  const legs = order.legs;
  const collectedAmount = sum(legs.filter((leg) => isCollected(leg.status)).map((leg) => amountOf(leg.amount)));
  const pendingAmount = sum(legs.filter((leg) => leg.status === 'pending' || leg.status === 'authorized').map((leg) => amountOf(leg.amount)));
  const failedAmount = sum(legs.filter((leg) => leg.status === 'failed').map((leg) => amountOf(leg.amount)));
  const capturedAmount = sum(legs.filter((leg) => leg.status === 'captured').map((leg) => amountOf(leg.amount)));
  const settledLegs = legs.filter((leg) => isSettled(leg.status));
  const settledGross = sum(settledLegs.map((leg) => amountOf(leg.amount)));
  const estimatedFees = sum(legs.filter(isCollected).map((leg) => amountOf(leg.amount) * rateOf(leg.feeRate)));
  const settledFees = sum(settledLegs.map((leg) => amountOf(leg.amount) * rateOf(leg.feeRate)));
  const refunds = sum(legs.map((leg) => Math.min(amountOf(leg.refundedAmount), amountOf(leg.amount))));
  const settledRefunds = sum(settledLegs.map((leg) => Math.min(amountOf(leg.refundedAmount), amountOf(leg.amount))));
  const retainedCollected = Math.max(0, collectedAmount - refunds);
  const netSettlement = Math.max(0, settledGross - settledFees - settledRefunds);
  const outstandingAmount = pendingAmount;

  return {
    status: getOrderStatus(order), grossAmount: amountOf(order.grossAmount), collectedAmount,
    pendingAmount, failedAmount, capturedAmount, settledGross, estimatedFees, settledFees,
    refunds, retainedCollected, netSettlement, outstandingAmount,
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
      grossSales: sum(totals.map((item) => item.grossAmount)),
      collected: sum(totals.map((item) => item.retainedCollected)),
      pending: sum(totals.map((item) => item.pendingAmount)),
      failed: sum(totals.map((item) => item.failedAmount)),
      settledGross: sum(totals.map((item) => item.settledGross)),
      fees: sum(totals.map((item) => item.settledFees)),
      refunds: sum(totals.map((item) => item.refunds)),
      netSettlement: sum(totals.map((item) => item.netSettlement)),
    };
  });
}

export function calculateProcessorMetrics(orders: Transaction[]) {
  const legs = orders.flatMap((order) => order.legs);
  const groups = new Map<string, { processor: string; method: string; currency: Transaction['currency']; totalLegs: number; failedLegs: number; settledGross: number; settledFees: number; refunds: number }>();
  legs.forEach((leg) => {
    const key = [leg.processor, leg.method, leg.currency].join('|');
    const current = groups.get(key) ?? { processor: leg.processor, method: leg.method, currency: leg.currency, totalLegs: 0, failedLegs: 0, settledGross: 0, settledFees: 0, refunds: 0 };
    current.totalLegs += 1;
    if (leg.status === 'failed') current.failedLegs += 1;
    if (isSettled(leg.status)) {
      current.settledGross += amountOf(leg.amount);
      current.settledFees += amountOf(leg.amount) * rateOf(leg.feeRate);
      current.refunds += Math.min(amountOf(leg.refundedAmount), amountOf(leg.amount));
    }
    groups.set(key, current);
  });
  return [...groups.values()].map((item) => ({
    ...item,
    failureRate: item.totalLegs ? item.failedLegs / item.totalLegs : 0,
    netSettlement: Math.max(0, item.settledGross - item.settledFees - item.refunds),
  })).sort((a, b) => b.totalLegs - a.totalLegs);
}

export function formatMoney(amount: number, currency: Transaction['currency']) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}