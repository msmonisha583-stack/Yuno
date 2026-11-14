import { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, Coffee, Download, Filter, LayoutDashboard, Search, Wallet, X } from 'lucide-react';
import { format } from 'date-fns';
import { mockTransactions } from './data/mockTransactions';
import { calculateOrder, calculateSummary, formatMoney } from './utils/reconciliation';
import type { OrderStatus, Transaction } from './types/payment';

const statusLabels: Record<OrderStatus, string> = {
  complete: 'Complete', partial_failure: 'Partial failure', pending: 'Pending',
  processing: 'Processing', refunded: 'Refunded', failed: 'Failed',
};

function exportCsv(orders: Transaction[]) {
  const headers = ['Order ID', 'Date', 'Customer', 'Country', 'Location', 'Currency', 'Gross', 'Collected', 'Pending', 'Failed', 'Fees', 'Refunds', 'Net settlement', 'Status', 'Payment legs'];
  const rows = orders.map((order) => {
    const calc = calculateOrder(order);
    return [order.id, order.createdAt, order.customer, order.country, order.location, order.currency, calc.grossAmount, calc.collectedAmount, calc.pendingAmount, calc.failedAmount, calc.settledFees, calc.refunds, calc.netSettlement, statusLabels[calc.status], order.legs.map((leg) => `${leg.method}: ${leg.status}`).join('; ')];
  });
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'cafehub-reconciliation.csv'; anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('All countries');
  const [status, setStatus] = useState('All statuses');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [currency, setCurrency] = useState('NGN');

  const filtered = useMemo(() => mockTransactions.filter((order) => {
    const calc = calculateOrder(order);
    const term = search.toLowerCase();
    return (!term || order.id.toLowerCase().includes(term) || order.customer.toLowerCase().includes(term))
      && (country === 'All countries' || order.country === country)
      && (status === 'All statuses' || calc.status === status);
  }), [search, country, status]);

  const summaries = calculateSummary(filtered);
  const activeSummary = summaries.find((item) => item.currency === currency) ?? summaries[0];
  const summaryCurrencies = calculateSummary(mockTransactions).map((item) => item.currency);

  const kpis = activeSummary ? [
    { label: 'Gross sales', value: formatMoney(activeSummary.grossSales, activeSummary.currency), note: 'Total order value', icon: Wallet, trend: '+8.2%', positive: true },
    { label: 'Net settlement', value: formatMoney(activeSummary.netSettlement, activeSummary.currency), note: 'After settled fees & refunds', icon: ArrowDownRight, trend: 'Reconciled', positive: true },
    { label: 'Pending payments', value: formatMoney(activeSummary.pending, activeSummary.currency), note: 'Awaiting collection', icon: CalendarDays, trend: 'In progress', positive: false },
    { label: 'Failed payments', value: formatMoney(activeSummary.failed, activeSummary.currency), note: 'Requires attention', icon: CircleAlert, trend: 'Exceptions', positive: false },
  ] : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Coffee size={19} /></div><div><strong>CaféHub</strong><span>FINANCE CONSOLE</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <a className="nav-link active"><LayoutDashboard size={17} /> Overview</a>
          <a className="nav-link"><Activity size={17} /> Transactions <span className="nav-count">200</span></a>
          <a className="nav-link"><CircleAlert size={17} /> Exceptions <span className="nav-count alert-count">18</span></a>
          <a className="nav-link"><ArrowUpRight size={17} /> Analytics</a>
          <a className="nav-link"><Wallet size={17} /> Settlement reports</a>
        </nav>
        <div className="sidebar-bottom"><div className="live-dot" /> Demo environment <span>v1.0</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="eyebrow">WEST AFRICA OPERATIONS</div><h1>Overview</h1></div>
          <div className="topbar-actions"><span className="date-chip"><CalendarDays size={15} /> Oct 2026 · Demo data</span><div className="avatar">MF</div></div>
        </header>

        <section className="welcome-row">
          <div><h2>Good afternoon, Finance team <span>✦</span></h2><p>Here’s what’s happening across your payment network.</p></div>
          <button className="primary-button" onClick={() => exportCsv(filtered)}><Download size={16} /> Export report</button>
        </section>

        <section className="toolbar">
          <div className="toolbar-title"><span className="section-kicker">FINANCIAL SNAPSHOT</span><span className="muted">Updated just now · Simulated transactions</span></div>
          <label className="currency-select">Reporting currency <select value={currency} onChange={(event) => setCurrency(event.target.value)}>{summaryCurrencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </section>

        <section className="kpi-grid">
          {kpis.map(({ label, value, note, icon: Icon, trend, positive }) => <article className="kpi-card" key={label}>
            <div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={17} /></span></div>
            <strong className="kpi-value">{value}</strong><div className="kpi-foot"><span>{note}</span><span className={positive ? 'trend good' : 'trend'}>{trend}</span></div>
          </article>)}
        </section>

        <section className="panel transaction-panel">
          <div className="panel-heading"><div><h3>Payment transactions</h3><p>Explore orders and their individual tender legs.</p></div><span className="result-count">{filtered.length} orders</span></div>
          <div className="filters">
            <div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID or customer..." /></div>
            <label className="filter-control"><Filter size={15} /><select value={country} onChange={(event) => setCountry(event.target.value)}><option>All countries</option><option>Nigeria</option><option>Ghana</option><option>Kenya</option></select></label>
            <label className="filter-control"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option value="complete">Complete</option><option value="partial_failure">Partial failure</option><option value="processing">Processing</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></label>
            <button className="clear-button" onClick={() => { setSearch(''); setCountry('All countries'); setStatus('All statuses'); }}>Clear</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>ORDER</th><th>DATE</th><th>LOCATION</th><th>PAYMENT LEGS</th><th>GROSS AMOUNT</th><th>COLLECTED</th><th>NET SETTLEMENT</th><th>STATUS</th></tr></thead>
            <tbody>{filtered.slice(0, 50).map((order) => {
              const calc = calculateOrder(order);
              return <tr key={order.id} onClick={() => setSelected(order)} className="clickable-row">
                <td><strong className="order-id">{order.id}</strong><small>{order.customer}</small></td>
                <td>{format(new Date(order.createdAt), 'dd MMM yyyy')}</td>
                <td><strong>{order.country}</strong><small>{order.location}</small></td>
                <td><div className="leg-pills">{order.legs.map((leg) => <span key={leg.id} title={leg.method} className={`leg-dot ${leg.status}`}>{leg.method === 'Visa' ? 'V' : leg.method === 'Mastercard' ? 'M' : leg.method === 'M-Pesa' ? 'P' : leg.method === 'Bank Transfer' ? 'B' : leg.method === 'MTN Mobile Money' ? 'M' : 'A'}</span>)}</div><small>{order.legs.length} tenders</small></td>
                <td className="amount">{formatMoney(order.grossAmount, order.currency)}</td><td className="amount">{formatMoney(calc.collectedAmount, order.currency)}</td><td className="amount">{formatMoney(calc.netSettlement, order.currency)}</td>
                <td><span className={`status-badge ${calc.status}`}>{statusLabels[calc.status]}</span></td>
              </tr>;
            })}</tbody></table>{filtered.length === 0 && <div className="empty-state">No transactions match these filters.</div>}{filtered.length > 50 && <div className="table-footer">Showing 50 of {filtered.length} orders</div>}</div>
        </section>
        <footer className="page-footer"><span>© 2026 CaféHub Finance Console</span><span>All amounts shown in the selected local currency · Demo data only</span></footer>
      </main>

      {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><span className="section-kicker">TRANSACTION DETAILS</span><h2>{selected.id}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} /></button></div>
        <div className="drawer-customer"><div className="customer-avatar">{selected.customer.split(' ').map((part) => part[0]).join('')}</div><div><strong>{selected.customer}</strong><span>{selected.location} · {selected.country}</span></div></div>
        <div className="drawer-total"><span>Order gross amount</span><strong>{formatMoney(selected.grossAmount, selected.currency)}</strong><span className={`status-badge ${calculateOrder(selected).status}`}>{statusLabels[calculateOrder(selected).status]}</span></div>
        <div className="drawer-section"><h3>Payment breakdown <span>{selected.legs.length} legs</span></h3>
          {selected.legs.map((leg) => <div className="payment-leg" key={leg.id}><div className="payment-method-icon">{leg.method === 'Visa' ? 'V' : leg.method === 'Mastercard' ? 'M' : leg.method === 'M-Pesa' ? 'P' : '₵'}</div><div className="payment-method"><strong>{leg.method}</strong><span>{leg.processor} · {(leg.feeRate * 100).toFixed(2)}% fee</span><small>{leg.id}</small></div><div className="payment-leg-amount"><strong>{formatMoney(leg.amount, leg.currency)}</strong><span className={`mini-status ${leg.status}`}>{leg.status}</span>{leg.refundedAmount > 0 && <small>Refund: {formatMoney(leg.refundedAmount, leg.currency)}</small>}</div></div>)}
        </div>
        <div className="drawer-section"><h3>Reconciliation summary</h3>{Object.entries({ 'Collected amount': calculateOrder(selected).collectedAmount, 'Pending amount': calculateOrder(selected).pendingAmount, 'Failed amount': calculateOrder(selected).failedAmount, 'Settled gross': calculateOrder(selected).settledGross, 'Settled fees': calculateOrder(selected).settledFees, 'Refunds': calculateOrder(selected).refunds, 'Net settlement': calculateOrder(selected).netSettlement }).map(([label, amount]) => <div className="summary-line" key={label}><span>{label}</span><strong>{formatMoney(amount, selected.currency)}</strong></div>)}</div>
      </aside></div>}
    </div>
  );
}

export default App;