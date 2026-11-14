# CaféHub — Multi-Tender Split Payment Reconciliation

A demo finance console for a coffee franchise operating across Nigeria, Ghana and Kenya. CaféHub helps finance teams inspect split-tender orders, identify partial payment failures, and reconcile processor settlements, fees and refunds.

> **Demo only:** all transactions are deterministic mock data. No live payment processor, bank, customer or production data is connected.

## What’s included

- **Transaction overview:** search by order ID or customer, inspect individual payment legs, and filter by date range, country, currency and order status.
- **Split-payment visibility:** see each tender leg and its state, with order-level statuses including complete, partial failure, processing, pending, refunded and failed.
- **Reconciliation calculations:** separate collected funds, pending/authorized amounts, failed amounts, captured amounts, settled gross, estimated fees, settled fees, refunds and net settlement.
- **Analytics:** daily gross sales versus net settlement, daily order volume and failed-leg rate by payment method.
- **Settlement reporting:** processor/method/currency breakdown with settled gross, settled fees, refunds, net settlement and failed-leg counts; export reports as CSV.
- **Validation:** checks that leg amounts add up to the order gross and flags invalid amounts, fee rates, currencies and refund values.

## Demo dataset

The app generates **200 deterministic mock orders** in `src/data/mockTransactions.ts`.

| Dataset characteristic | Included |
|---|---|
| Countries and currencies | Nigeria (NGN), Ghana (GHS), Kenya (KES) |
| Split vs single tender | 65% split orders; 35% single-tender orders |
| Payment methods | Visa, Mastercard, MTN Mobile Money, Airtel Money, M-Pesa, Bank Transfer |
| Payment states | Majority settled, with captured, pending, authorized, failed and refunded exceptions |
| Partial failures | 41 split orders with a failed leg alongside a successful leg |
| Settlement timing | Settlement timestamps are generated from 0–5 days after order creation for settled/refunded legs |
| Fee assumptions | Cards: 2.0–2.2%; mobile money: 1.2–1.5%; bank transfer: 0.8% |
| Refunds | A deterministic sample of orders includes partial refunds |

The dataset is synthetic and intended to exercise reconciliation behavior, not to represent actual processor pricing or payout schedules.

## Financial definitions

CaféHub deliberately keeps payment progress and bank settlement distinct:

- **Collected:** captured, settled and refunded legs. Captured funds count as collected, but are not yet settled bank funds.
- **Pending:** pending and authorized legs. These are not counted as collected.
- **Failed:** failed legs only; a failed leg is not counted as pending or collected.
- **Estimated fees:** fee estimates on collected legs, including captured legs.
- **Settled fees:** fees calculated only on settled/refunded legs.
- **Refunds:** refund amounts recorded against legs; refunds reduce retained collections and settled net proceeds.
- **Net settlement:** settled gross less settled fees and settled refunds. Pending, authorized, captured and failed legs are excluded.
- **Partial failure:** an order with at least one failed leg and at least one non-failed leg. An order whose legs all failed is classified as failed, not partial failure.
- **Currency isolation:** NGN, GHS and KES are never added together. Choose a currency in the report filters to view comparable totals.

These are demo reconciliation rules and simplified fee assumptions; adapt them to the contractual definitions and settlement files of a real processor before production use.

## Run locally

### Requirements

- Node.js 20 or newer
- npm

### Install and start

```bash
git clone https://github.com/msmonisha583-stack/Yuno.git
cd Yuno
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

### Build and test

```bash
npm test
npm run build
npm run preview
```

- `npm test` runs the reconciliation unit tests with Vitest.
- `npm run build` runs the TypeScript project build and creates the production bundle with Vite.
- `npm run preview` serves the production build locally after a successful build.

## Tech stack

- React 18 and TypeScript
- Vite 6
- Recharts for analytics charts
- Lucide React for icons
- date-fns for date formatting
- Vitest for reconciliation tests

## Project structure

```text
src/
  App.tsx                    Dashboard, filters, charts, exports and detail drawer
  data/
    mockTransactions.ts      200 deterministic mock orders and payment legs
  types/
    payment.ts               Transaction, payment-leg and calculation types
  utils/
    reconciliation.ts        Validation, order calculations and processor metrics
    reconciliation.test.ts   Reconciliation unit tests
  index.css                  Application styles
  main.tsx                   React application entry point
```

## Five-minute demo walkthrough

1. Run `npm install` and `npm run dev`, then open the Vite URL.
2. On **Overview**, choose a currency and explore the date, country and status filters.
3. Search for an order and select a row to inspect its tender legs and reconciliation summary.
4. Select **Exceptions** in the sidebar to focus on partial failures.
5. Open **Analytics** to compare gross sales with net settlement and inspect failure rates by method.
6. Open **Settlement reports** and export the processor breakdown as CSV.

## Scope and limitations

This is a front-end assessment/demo application backed by generated mock data. It does not connect to payment APIs, ingest processor settlement files, persist user changes, authenticate users or perform real payouts. Settlement calculations use the fee rates and simplified rules documented above. A production reconciliation workflow would also need source-of-truth processor events, idempotent ingestion, payout/bank matching, timezone and cutoff handling, currency-specific rounding rules, audit history and secure access controls.
