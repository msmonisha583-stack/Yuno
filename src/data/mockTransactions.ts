import type { Country, Currency, PaymentLeg, PaymentMethod, PaymentStatus, Transaction } from '../types/payment';

const locations: Record<Country, string[]> = {
  Nigeria: ['Lagos - Victoria Island', 'Lagos - Ikeja', 'Abuja - Wuse', 'Port Harcourt - GRA'],
  Ghana: ['Accra - Osu', 'Accra - Airport City', 'Kumasi - Adum', 'Tema - Community 1'],
  Kenya: ['Nairobi - Westlands', 'Nairobi - Kilimani', 'Mombasa - Nyali', 'Kisumu - CBD'],
};
const currencyByCountry: Record<Country, Currency> = { Nigeria: 'NGN', Ghana: 'GHS', Kenya: 'KES' };
const methods: PaymentMethod[] = ['Visa', 'Mastercard', 'MTN Mobile Money', 'Airtel Money', 'M-Pesa', 'Bank Transfer'];
const feeRates: Record<PaymentMethod, number> = {
  Visa: 0.022, Mastercard: 0.02, 'MTN Mobile Money': 0.012,
  'Airtel Money': 0.015, 'M-Pesa': 0.013, 'Bank Transfer': 0.008,
};
const processors: Record<PaymentMethod, string> = {
  Visa: 'Paystack', Mastercard: 'Flutterwave', 'MTN Mobile Money': 'MTN MoMo',
  'Airtel Money': 'Airtel Money', 'M-Pesa': 'Safaricom', 'Bank Transfer': 'Interswitch',
};
const customers = ['Amara Okafor', 'Kwame Mensah', 'Wanjiku Njoroge', 'Tunde Adeyemi', 'Ama Boateng', 'Akinyi Otieno', 'Chidi Eze', 'Kofi Asante', 'Nia Kamau', 'Zainab Bello'];
const statuses: PaymentStatus[] = ['settled', 'settled', 'settled', 'captured', 'pending', 'authorized', 'failed'];
const round = (value: number) => Math.round(value);

function makeLeg(orderIndex: number, legIndex: number, amount: number, currency: Currency, country: Country): PaymentLeg {
  const method = methods[(orderIndex * 3 + legIndex * 2 + (country === 'Kenya' ? 2 : country === 'Ghana' ? 1 : 0)) % methods.length];
  let status = statuses[(orderIndex * 5 + legIndex * 3) % statuses.length];
  // Deterministic exception cohort: 18 orders have one failed leg and one settled leg.
  if (orderIndex < 18 && legIndex === 1) status = 'failed';
  if (orderIndex < 18 && legIndex === 0) status = 'settled';
  if (orderIndex % 29 === 0 && legIndex === 0) status = 'refunded';
  const created = new Date(Date.UTC(2026, 9, 1 + (orderIndex % 45), 8 + (orderIndex % 10), (orderIndex * 7) % 60));
  const delayDays = (orderIndex + legIndex * 2) % 6;
  const settlement = new Date(created.getTime() + delayDays * 86400000);
  const refundedAmount = status === 'refunded' ? round(amount * 0.35) : 0;
  return {
    id: `LEG-${String(orderIndex + 1).padStart(4, '0')}-${legIndex + 1}`,
    method, processor: processors[method], amount, currency, status, feeRate: feeRates[method],
    createdAt: created.toISOString(), settlementDate: status === 'settled' || status === 'refunded' ? settlement.toISOString() : null,
    refundedAmount,
  };
}

export const mockTransactions: Transaction[] = Array.from({ length: 200 }, (_, index) => {
  const country = (['Nigeria', 'Ghana', 'Kenya'] as Country[])[index % 3];
  const currency = currencyByCountry[country];
  const grossAmount = round((country === 'Nigeria' ? 18000 : country === 'Ghana' ? 220 : 2600) + ((index * 7919) % (country === 'Nigeria' ? 125000 : country === 'Ghana' ? 900 : 18000)));
  const split = index % 100 < 65;
  const legCount = split ? 2 + (index % 3 === 0 ? 1 : 0) : 1;
  const weights = Array.from({ length: legCount }, (_, leg) => leg + 2);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  const legs = weights.map((weight, legIndex) => {
    const amount = legIndex === legCount - 1 ? grossAmount - allocated : round(grossAmount * weight / weightTotal);
    allocated += amount;
    return makeLeg(index, legIndex, amount, currency, country);
  });
  const createdAt = new Date(Date.UTC(2026, 9, 1 + (index % 45), 8 + (index % 10), (index * 7) % 60)).toISOString();
  return {
    id: `CH-${String(26000 + index).padStart(6, '0')}`,
    customer: customers[index % customers.length], country,
    location: locations[country][Math.floor(index / 3) % locations[country].length],
    createdAt, grossAmount, currency, legs,
  };
});