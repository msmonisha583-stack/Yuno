export type Country = 'Nigeria' | 'Ghana' | 'Kenya';
export type Currency = 'NGN' | 'GHS' | 'KES';
export type PaymentMethod = 'Visa' | 'Mastercard' | 'MTN Mobile Money' | 'Airtel Money' | 'M-Pesa' | 'Bank Transfer';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'settled' | 'failed' | 'refunded';
export type OrderStatus = 'complete' | 'partial_failure' | 'pending' | 'processing' | 'refunded' | 'failed';

export interface PaymentLeg {
  id: string;
  method: PaymentMethod;
  processor: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  feeRate: number;
  createdAt: string;
  settlementDate: string | null;
  refundedAmount: number;
}

export interface Transaction {
  id: string;
  customer: string;
  country: Country;
  location: string;
  createdAt: string;
  grossAmount: number;
  currency: Currency;
  legs: PaymentLeg[];
}

export interface OrderCalculation {
  status: OrderStatus;
  grossAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  failedAmount: number;
  capturedAmount: number;
  settledGross: number;
  estimatedFees: number;
  settledFees: number;
  refunds: number;
  retainedCollected: number;
  netSettlement: number;
  outstandingAmount: number;
}

export interface ReconciliationSummary {
  currency: Currency;
  orderCount: number;
  grossSales: number;
  collected: number;
  pending: number;
  failed: number;
  settledGross: number;
  fees: number;
  refunds: number;
  netSettlement: number;
}