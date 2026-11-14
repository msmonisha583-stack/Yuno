import { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, Coffee, Download, Filter, LayoutDashboard, Search, Wallet, X, BarChart3, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { mockTransactions } from './data/mockTransactions';
import { calculateOrder, calculateProcessorMetrics, calculateSummary, formatMoney, validateOrder } from './utils/reconciliation';
import type { OrderStatus, Transaction } from './types/payment';

type View = 'overview' | 'analytics' | 'settlements';
const statusLabels: Record<OrderStatus, string> = {
  complete: 'Complete', partial_failure: 'Partial failure', pending: 'Pending',
  processing: 'Processing', refunded: 'Refunded', failed: 'Failed',
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
function exportOrders(orders: Transaction[]) {
  const headers = ['Order ID', 'Date', 'Customer', 'Country', 'Location', 'Currency', 'Gross', 'Collected', 'Pending', 'Failed', 'Estimated fees', 'Settled fees', 'Refunds', 'Net settlement', 'Status', 'Payment legs'];
  const rows = orders.map((order) => {
    const calc = calculateOrder(order);
    return [order.id, order.createdAt, order.customer, order.country, order.location, order.currency, calc.grossAmount, calc.collectedAmount, calc.pendingAmount, calc.failedAmount, calc.estimatedFees, calc.settledFees, calc.refunds, calc.netSettlement, statusLabels[calc.status], order.legs.map((leg) => `${leg.method}: ${leg.status}`).join('; ')];
  });
  downloadCsv('cafehub-reconciliation.csv', headers, rows);
}
const dateKey = (value: string) => format(parseISO(value), 'dd MMM');
const currencyOptions = ['NGN', 'GHS', 'KES'] as const;

function App() {
  const [view, setView] = useState<View>('overview');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('All countries');
  const [status, setStatus] = useState('All statuses');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [currency, setCurrency] = useState<(typeof currencyOptions)[number]>('NGN');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-11-14');

  const filtered = useMemo(() => mockTransactions.filter((order) => {
    const calc = calculateOrder(order);
    const term = search.toLowerCase();
    const timestamp = new Date(order.createdAt).getTime();
    const from = fromDate ? startOfDay(new Date(`${fromDate}T00:00:00`)).getTime() : -Infinity;
    const to = toDate ? endOfDay(new Date(`${toDate}T00:00:00`)).getTime() : Infinity;
    return (!term || order.id.toLowerCase().includes(term) || order.customer.toLowerCase().includes(term))
      && (country === 'All countries' || order.country === country)
      && (status === 'All statuses' || calc.status === status)
      && timestamp >= from && timestamp <= to;
  }), [search, country, status, fromDate, toDate]);

  const currencyOrders = filtered.filter((order) => order.currency === currency);
  const summary = calculateSummary(currencyOrders)[0];
  const processorMetrics = calculateProcessorMetrics(currencyOrders);
  const validationIssues = currencyOrders.reduce((count, order) => count + validateOrder(order).length, 0);
  const trendData = useMemo(() => {
    const groups = new Map<string, { date: string; gross: number; net: number; orders: number }>();
    currencyOrders.forEach((order) => {
      const key = format(parseISO(order.createdAt), 'yyyy-MM-dd');
      const current = groups.get(key) ?? { date: dateKey(order.createdAt), gross: 0, net: 0, orders: 0 };
      const calc = calculateOrder(order);
      current.gross += calc.grossAmount; current.net += calc.netSettlement; current.orders += 1;
      groups.set(key, current);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item);
  }, [currencyOrders]);
  const methodData = processorMetrics.map((item) => ({
    name: item.method.length > 13 ? item.method.slice(0, 12) + '…' : item.method,
    failureRate: Number((item.failureRate * 100).toFixed(1)),
    legs: item.totalLegs,
    net: Math.round(item.netSettlement),
  }));
  const kpis = summary ? [
    { label: 'Gross sales', value: formatMoney(summary.grossSales, currency), note: `${summary.orderCount} orders in range`, icon: Wallet },
    { label: 'Net settlement', value: formatMoney(summary.netSettlement, currency), note: 'Settled gross less fees & refunds', icon: ArrowDownRight },
    { label: 'Pending payments', value: formatMoney(summary.pending, currency), note: 'Pending and authorized legs', icon: CalendarDays },
    { label: 'Failed payments', value: formatMoney(summary.failed, currency), note: 'Failed tender legs only', icon: CircleAlert },
  ] : [];

  const resetFilters = () => { setSearch(''); setCountry('All countries'); setStatus('All statuses'); setFromDate('2026-10-01'); setToDate('2026-11-14'); };
  const exportSettlements = () => downloadCsv('cafehub-settlement-report.csv',
    ['Processor', 'Payment method', 'Currency', 'Total legs', 'Failed legs', 'Failure rate', 'Settled gross', 'Settled fees', 'Refunds', 'Net settlement'],
    processorMetrics.map((item) => [item.processor, item.method, item.currency, item.totalLegs, item.failedLegs, (item.failureRate * 100).toFixed(2) + '%', item.settledGross, item.settledFees, item.refunds, item.netSettlement]));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Coffee size={19} /></div><div><strong>CaféHub</strong><span>FINANCE CONSOLE</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <button className={`nav-link ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}><LayoutDashboard size={17} /> Overview</button>
          <button className="nav-link" onClick={() => setView('overview')}><Activity size={17} /> Transactions <span className="nav-count">{filtered.length}</span></button>
          <button className="nav-link" onClick={() => { setView('overview'); setStatus('partial_failure'); }}><CircleAlert size={17} /> Exceptions <span className="nav-count alert-count">{mockTransactions.filter((order) => calculateOrder(order).status === 'partial_failure').length}</span></button>
          <button className={`nav-link ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}><BarChart3 size={17} /> Analytics</button>
          <button className={`nav-link ${view === 'settlements' ? 'active' : ''}`} onClick={() => setView('settlements')}><FileSpreadsheet size={17} /> Settlement reports</button>
        </nav>
        <div className="sidebar-bottom"><div className="live-dot" /> Demo environment <span>v1.1</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="eyebrow">WEST AFRICA OPERATIONS</div><h1>{view === 'overview' ? 'Overview' : view === 'analytics' ? 'Payment analytics' : 'Settlement reports'}</h1></div>
          <div className="topbar-actions"><span className="date-chip"><CalendarDays size={15} /> {fromDate ? format(new Date(fromDate + 'T00:00:00'), 'dd MMM') : 'Any'} – {toDate ? format(new Date(toDate + 'T00:00:00'), 'dd MMM yyyy') : 'Any date'}</span><div className="avatar">FH</div></div>
        </header>

        <section className="welcome-row">
          <div><h2>{view === 'overview' ? 'Good afternoon, Finance team' : view === 'analytics' ? 'Understand payment performance' : 'Settlement reconciliation'} <span>✦</span></h2><p>{view === 'overview' ? 'Here’s what’s happening across your payment network.' : view === 'analytics' ? 'Track tender mix, processor reliability and settlement trends.' : 'Review settled amounts, fees and refunds by processor and method.'}</p></div>
          <button className="primary-button" onClick={() => view === 'settlements' ? exportSettlements() : exportOrders(currencyOrders)}><Download size={16} /> Export {view === 'settlements' ? 'settlements' : 'report'}</button>
        </section>

        <section className="filter-bar panel">
          <div className="filter-heading"><span className="section-kicker">REPORT FILTERS</span><button className="clear-button" onClick={resetFilters}><RotateCcw size={13} /> Reset filters</button></div>
          <div className="filter-grid">
            <label className="date-filter">From date<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="date-filter">To date<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
            <label className="date-filter">Country<select value={country} onChange={(event) => setCountry(event.target.value)}><option>All countries</option><option>Nigeria</option><option>Ghana</option><option>Kenya</option></select></label>
            <label className="date-filter">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>{currencyOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="date-filter">Order status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option value="complete">Complete</option><option value="partial_failure">Partial failure</option><option value="processing">Processing</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></label>
          </div>
        </section>

        <section className="kpi-grid">
          {kpis.map(({ label, value, note, icon: Icon }) => <article className="kpi-card" key={label}>
            <div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={17} /></span></div>
            <strong className="kpi-value">{value}</strong><div className="kpi-foot"><span>{note}</span><span className="trend good">{currency}</span></div>
          </article>)}
        </section>

        {view === 'overview' && <section className="panel transaction-panel">
          <div className="panel-heading"><div><h3>Payment transactions</h3><p>Search orders and inspect individual tender legs.</p></div><span className="result-count">{filtered.length} orders</span></div>
          <div className="filters">
            <div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID or customer..." /></div>
            <button className="clear-button" onClick={() => setSearch('')}>Clear search</button>
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
        </section>}

        {view === 'analytics' && <div className="analytics-grid">
          <section className="panel chart-panel"><div className="panel-heading"><div><h3>Gross sales vs net settlement</h3><p>Daily totals in {currency}, using the selected date range.</p></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#829087' }} /><YAxis tick={{ fontSize: 10, fill: '#829087' }} /><Tooltip formatter={(value) => formatMoney(Number(value), currency)} /><Legend /><Line type="monotone" dataKey="gross" name="Gross sales" stroke="#769b55" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="net" name="Net settlement" stroke="#334f42" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></section>
          <section className="panel chart-panel"><div className="panel-heading"><div><h3>Failed leg rate by method</h3><p>Failed payment legs ÷ all legs for each method.</p></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={methodData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#829087' }} /><YAxis unit="%" tick={{ fontSize: 10, fill: '#829087' }} /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="failureRate" name="Failure rate" fill="#d18b6e" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></section>
          <section className="panel chart-panel wide-chart"><div className="panel-heading"><div><h3>Daily order volume</h3><p>Orders created per day, selected currency scope.</p></div></div><div className="chart-area short-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#829087' }} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#829087' }} /><Tooltip /><Bar dataKey="orders" name="Orders" fill="#9ab879" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></section>
        </div>}

        {view === 'settlements' && <section className="panel transaction-panel">
          <div className="panel-heading"><div><h3>Processor settlement breakdown</h3><p>Settled gross less settled fees and refunds. Pending and captured legs are excluded.</p></div><span className="result-count">{processorMetrics.length} processor / method groups</span></div>
          <div className="table-wrap"><table><thead><tr><th>PROCESSOR</th><th>PAYMENT METHOD</th><th>LEGS</th><th>FAILED</th><th>FAILURE RATE</th><th>SETTLED GROSS</th><th>SETTLED FEES</th><th>REFUNDS</th><th>NET SETTLEMENT</th></tr></thead><tbody>
            {processorMetrics.map((item) => <tr key={item.processor + item.method}><td><strong>{item.processor}</strong></td><td>{item.method}</td><td>{item.totalLegs}</td><td>{item.failedLegs}</td><td><span className={item.failureRate > .1 ? 'status-badge partial_failure' : 'status-badge complete'}>{(item.failureRate * 100).toFixed(1)}%</span></td><td className="amount">{formatMoney(item.settledGross, item.currency)}</td><td className="amount">{formatMoney(item.settledFees, item.currency)}</td><td className="amount">{formatMoney(item.refunds, item.currency)}</td><td className="amount"><strong>{formatMoney(item.netSettlement, item.currency)}</strong></td></tr>)}
          </tbody></table>{processorMetrics.length === 0 && <div className="empty-state">No settlement data for the selected filters.</div>}</div>
          <div className="settlement-note"><strong>Reconciliation checks:</strong> {validationIssues === 0 ? 'All selected orders have payment legs that reconcile to their gross amount.' : `${validationIssues} validation issue(s) found across selected orders.`} Captured amounts are collected but not included in settled bank funds.</div>
        </section>}

        <footer className="page-footer"><span>© 2026 CaféHub Finance Console</span><span>Demo data only · Currency totals are never combined across countries</span></footer>
      </main>

      {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><span className="section-kicker">TRANSACTION DETAILS</span><h2>{selected.id}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} /></button></div>
        <div className="drawer-customer"><div className="customer-avatar">{selected.customer.split(' ').map((part) => part[0]).join('')}</div><div><strong>{selected.customer}</strong><span>{selected.location} · {selected.country}</span></div></div>
        <div className="drawer-total"><span>Order gross amount</span><strong>{formatMoney(selected.grossAmount, selected.currency)}</strong><span className={`status-badge ${calculateOrder(selected).status}`}>{statusLabels[calculateOrder(selected).status]}</span></div>
        <div className="drawer-section"><h3>Payment breakdown <span>{selected.legs.length} legs</span></h3>
          {selected.legs.map((leg) => <div className="payment-leg" key={leg.id}><div className="payment-method-icon">{leg.method === 'Visa' ? 'V' : leg.method === 'Mastercard' ? 'M' : leg.method === 'M-Pesa' ? 'P' : '₵'}</div><div className="payment-method"><strong>{leg.method}</strong><span>{leg.processor} · {(leg.feeRate * 100).toFixed(2)}% fee</span><small>{leg.id}</small></div><div className="payment-leg-amount"><strong>{formatMoney(leg.amount, leg.currency)}</strong><span className={`mini-status ${leg.status}`}>{leg.status}</span>{leg.refundedAmount > 0 && <small>Refund: {formatMoney(leg.refundedAmount, leg.currency)}</small>}</div></div>)}
        </div>
        <div className="drawer-section"><h3>Reconciliation summary</h3>{Object.entries({ 'Collected amount': calculateOrder(selected).collectedAmount, 'Pending amount': calculateOrder(selected).pendingAmount, 'Failed amount': calculateOrder(selected).failedAmount, 'Estimated fees': calculateOrder(selected).estimatedFees, 'Settled gross': calculateOrder(selected).settledGross, 'Settled fees': calculateOrder(selected).settledFees, 'Refunds': calculateOrder(selected).refunds, 'Net settlement': calculateOrder(selected).netSettlement }).map(([label, amount]) => <div className="summary-line" key={label}><span>{label}</span><strong>{formatMoney(amount, selected.currency)}</strong></div>)}</div>
      </aside></div>}
    </div>
  );
}

export default App;