import { Platform, Share } from 'react-native';
import type { Expense, Subscription, FinancialGoal, Budget, AppMode } from '@/types';
import { convertToALL } from '@/constants/currencies';

// ── Types ───────────────────────────────────────────────────────────────────

export type ExportPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'all_time' | 'custom';
export type ExportFormat = 'pdf' | 'csv';

export interface ExportOptions {
  period: ExportPeriod;
  customStart?: string;
  customEnd?: string;
  includeExpenses: boolean;
  includeBudget: boolean;
  includeSubscriptions: boolean;
  includeGoals: boolean;
  expenseMode: 'personal' | 'business' | 'both';
  format: ExportFormat;
}

export interface ExportData {
  expenses: Expense[];
  budget: Budget;
  subscriptions: Subscription[];
  goals: FinancialGoal[];
  userEmail: string | null;
  userName: string | null;
  mode: AppMode;
}

export interface ExportResult {
  success: boolean;
  error?: string;
  method?: 'download' | 'share' | 'print';
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_NAMES: Record<string, string> = {
  ushqim: 'Ushqim',
  transport: 'Transport',
  faturat: 'Faturat',
  shopping: 'Shopping',
  shendet: 'Shëndet',
  argetime: 'Argëtim',
  biznes: 'Biznes',
  tjera: 'Të tjera',
  furnitor: 'Furnitor',
  inventar: 'Inventar',
  marketing_biz: 'Marketing',
  zyre: 'Zyrë',
  transport_biz: 'Transport (Biz)',
  punonjes: 'Punonjës',
  taksa: 'Taksa',
  sherbime: 'Shërbime',
};

const CATEGORY_COLORS: Record<string, string> = {
  ushqim: '#22C55E',
  transport: '#3B82F6',
  faturat: '#F59E0B',
  shopping: '#EC4899',
  shendet: '#EF4444',
  argetime: '#8B5CF6',
  biznes: '#06B6D4',
  tjera: '#64748B',
  furnitor: '#F97316',
  inventar: '#10B981',
  marketing_biz: '#A855F7',
  zyre: '#0EA5E9',
  transport_biz: '#6366F1',
  punonjes: '#E11D48',
  taksa: '#CA8A04',
  sherbime: '#0891B2',
};

const FREQ_NAMES: Record<string, string> = {
  weekly: 'Javore',
  monthly: 'Mujore',
  yearly: 'Vjetore',
};

// ── Date range ───────────────────────────────────────────────────────────────

export function getDateRange(
  period: ExportPeriod,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start,
      end,
      label: `Muaji ${now.toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' })}`,
    };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start,
      end,
      label: `Muaji i kaluar (${start.toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' })})`,
    };
  }
  if (period === 'last_3_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start, end: now, label: '3 muajt e fundit' };
  }
  if (period === 'custom' && customStart && customEnd) {
    return {
      start: new Date(customStart),
      end: new Date(customEnd),
      label: `${customStart} — ${customEnd}`,
    };
  }
  return { start: new Date('2020-01-01'), end: now, label: 'Gjithë kohën' };
}

export function filterExpensesByRange(
  expenses: Expense[],
  start: Date,
  end: Date
): Expense[] {
  const s = start.getTime();
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  const eTime = e.getTime();
  return expenses.filter((exp) => {
    const d = new Date(exp.date).getTime();
    return d >= s && d <= eTime;
  });
}

// ── CSV generation ───────────────────────────────────────────────────────────

function esc(value: string | number): string {
  const s = String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function generateExpensesCSV(expenses: Expense[]): string {
  const BOM = '﻿';
  const header = 'Datë,Kategoria,Shënim,Shuma,Monedha,Shuma (ALL),Lloji';
  const rows = expenses.map((e) =>
    [
      esc(e.date.slice(0, 10)),
      esc(CATEGORY_NAMES[e.category] ?? e.category),
      esc(e.note),
      esc(e.amount),
      esc(e.currency),
      esc(Math.round(e.convertedALL ?? 0)),
      esc(e.mode === 'business' ? 'Biznes' : 'Personal'),
    ].join(',')
  );
  return BOM + [header, ...rows].join('\n');
}

export function generateSubscriptionsCSV(subs: Subscription[]): string {
  const BOM = '﻿';
  const header = 'Emri,Shuma,Monedha,Frekuenca,Data fillimit,Pagesa ardhshme,Aktiv';
  const rows = subs.map((s) =>
    [
      esc(s.name),
      esc(s.amount),
      esc(s.currency),
      esc(FREQ_NAMES[s.frequency] ?? s.frequency),
      esc(s.startDate),
      esc(s.nextPaymentDate),
      esc(s.isActive ? 'Po' : 'Jo'),
    ].join(',')
  );
  return BOM + [header, ...rows].join('\n');
}

export function generateGoalsCSV(goals: FinancialGoal[]): string {
  const BOM = '﻿';
  const header = 'Titulli,Objektivi,Kursyer,Mbetet,Progresi %,Monedha,Afati,Lloji,Arritur';
  const rows = goals.map((g) => {
    const pct = g.targetAmount > 0 ? ((g.savedAmount / g.targetAmount) * 100).toFixed(1) : '0';
    return [
      esc(g.title),
      esc(g.targetAmount),
      esc(g.savedAmount),
      esc(Math.max(g.targetAmount - g.savedAmount, 0)),
      esc(pct),
      esc(g.currency),
      esc(g.deadline ?? '—'),
      esc(g.mode === 'business' ? 'Biznes' : 'Personal'),
      esc(g.completedAt ? 'Po' : 'Jo'),
    ].join(',');
  });
  return BOM + [header, ...rows].join('\n');
}

export function buildExportedExpenses(
  data: ExportData,
  opts: ExportOptions
): Expense[] {
  const { start, end } = getDateRange(opts.period, opts.customStart, opts.customEnd);
  let filtered = filterExpensesByRange(data.expenses, start, end);
  if (opts.expenseMode === 'personal') {
    filtered = filtered.filter((e) => e.mode !== 'business');
  } else if (opts.expenseMode === 'business') {
    filtered = filtered.filter((e) => e.mode === 'business');
  }
  return filtered;
}

// ── HTML Report ──────────────────────────────────────────────────────────────

function fmtALL(n: number): string {
  return `${Math.round(n).toLocaleString('sq-AL')} L`;
}

function categoryRow(cat: string, total: number, grandTotal: number): string {
  const name = CATEGORY_NAMES[cat] ?? cat;
  const color = CATEGORY_COLORS[cat] ?? '#64748B';
  const pct = grandTotal > 0 ? Math.min((total / grandTotal) * 100, 100) : 0;
  return `
    <tr>
      <td>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
        ${name}
      </td>
      <td>
        <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-bottom:3px;">
          <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:3px;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></div>
        </div>
        <span style="font-size:10px;color:#94a3b8;">${pct.toFixed(1)}%</span>
      </td>
      <td class="amount">${fmtALL(total)}</td>
    </tr>`;
}

export function generateReportHTML(data: ExportData, opts: ExportOptions): string {
  const { start, end, label } = getDateRange(opts.period, opts.customStart, opts.customEnd);
  const filtered = buildExportedExpenses(data, opts);

  const totalALL = filtered.reduce((s, e) => s + (e.convertedALL ?? 0), 0);
  const txCount = filtered.length;
  const daysSpanned = Math.max(
    Math.ceil((end.getTime() - start.getTime()) / 86400000),
    1
  );
  const avgDaily = txCount > 0 ? totalALL / daysSpanned : 0;
  const budgetPct = data.budget.monthly > 0
    ? Math.min((totalALL / data.budget.monthly) * 100, 100)
    : 0;

  const catMap: Record<string, number> = {};
  filtered.forEach((e) => {
    catMap[e.category] = (catMap[e.category] ?? 0) + (e.convertedALL ?? 0);
  });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const today = new Date().toLocaleDateString('sq-AL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const userName = data.userName?.trim()
    || (data.userEmail?.split('@')[0].replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Valuta');

  const subMonthly = data.subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => {
      const inAll = convertToALL(s.amount, s.currency);
      if (s.frequency === 'weekly') return sum + inAll * 4.33;
      if (s.frequency === 'yearly') return sum + inAll / 12;
      return sum + inAll;
    }, 0);

  const expenseRows = filtered
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(
      (e) => `
      <tr>
        <td>${e.date.slice(0, 10)}</td>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CATEGORY_COLORS[e.category] ?? '#64748B'};margin-right:6px;vertical-align:middle;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></span>${CATEGORY_NAMES[e.category] ?? e.category}</td>
        <td>${e.note || '—'}</td>
        <td>${e.amount} ${e.currency}</td>
        <td class="amount">${fmtALL(e.convertedALL ?? 0)}</td>
        <td><span style="font-size:10px;color:#64748b;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${e.mode === 'business' ? 'Biznes' : 'Personal'}</span></td>
      </tr>`
    )
    .join('');

  const subRows = data.subscriptions.map((s) => `
    <tr>
      <td>${s.name}</td>
      <td>${s.amount} ${s.currency}</td>
      <td>${FREQ_NAMES[s.frequency] ?? s.frequency}</td>
      <td>${s.nextPaymentDate}</td>
      <td><span style="color:${s.isActive ? '#10b981' : '#94a3b8'};font-weight:700;">${s.isActive ? 'Aktiv' : 'Joaktiv'}</span></td>
    </tr>`).join('');

  const goalRows = data.goals.map((g) => {
    const pct = g.targetAmount > 0
      ? Math.min((g.savedAmount / g.targetAmount) * 100, 100)
      : 0;
    const savedALL = convertToALL(g.savedAmount, g.currency);
    const targetALL = convertToALL(g.targetAmount, g.currency);
    return `
    <tr>
      <td>${g.title}</td>
      <td>${fmtALL(savedALL)}</td>
      <td>${fmtALL(targetALL)}</td>
      <td>
        <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-bottom:3px;">
          <div style="height:100%;width:${pct.toFixed(1)}%;background:${g.color};border-radius:3px;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></div>
        </div>
        <span style="font-size:10px;color:#64748b;">${pct.toFixed(0)}%</span>
      </td>
      <td>${g.deadline ?? '—'}</td>
      <td><span style="color:${g.completedAt ? '#10b981' : '#64748b'};font-weight:700;">${g.completedAt ? 'Arritur' : 'Në progres'}</span></td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Raport Valuta — ${label}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;background:#ffffff;font-size:13px;line-height:1.5;}
  .header{background:linear-gradient(135deg,#065f46 0%,#10b981 40%,#3b82f6 100%);color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  .logo-wrap{display:flex;align-items:center;gap:14px;}
  .logo-v{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;border:1.5px solid rgba(255,255,255,0.3);}
  .logo-text{font-size:22px;font-weight:800;letter-spacing:-0.5px;}
  .logo-sub{font-size:12px;opacity:0.75;margin-top:2px;}
  .meta{text-align:right;font-size:12px;opacity:0.88;}
  .meta-label{font-size:10px;opacity:0.7;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;}
  .section{padding:20px 32px;border-bottom:1px solid #f1f5f9;}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;margin-bottom:14px;}
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  .stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;}
  .stat-value{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;margin-bottom:3px;}
  .stat-label{font-size:10px;color:#64748b;font-weight:500;}
  .progress-wrap{background:#f1f5f9;border-radius:8px;padding:14px;}
  .progress-bar{height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;margin:8px 0;}
  .progress-fill{height:100%;border-radius:5px;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  .progress-labels{display:flex;justify-content:space-between;font-size:11px;color:#64748b;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;padding:9px 10px;background:#f8fafc;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:2px solid #e2e8f0;}
  td{padding:9px 10px;border-bottom:1px solid #f8fafc;color:#334155;vertical-align:middle;}
  tr:last-child td{border-bottom:none;}
  .amount{font-weight:700;color:#0f172a;text-align:right;}
  th.amount{text-align:right;}
  .footer{padding:18px 32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;}
  @media print{
    body{font-size:11px;}
    .header{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .progress-fill{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    @page{margin:0.8cm;}
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="logo-wrap">
    <div class="logo-v">V</div>
    <div>
      <div class="logo-text">Valuta</div>
      <div class="logo-sub">Raport Financiar</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-label">Periudha</div>
    <div style="font-weight:700;font-size:13px;">${label}</div>
    <div style="margin-top:8px;opacity:0.7;">Gjeneruar ${today}</div>
    <div>${userName}</div>
  </div>
</div>

<!-- Summary -->
<div class="section">
  <div class="section-title">Përmbledhje</div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${fmtALL(totalALL)}</div>
      <div class="stat-label">Shpenzuar gjithsej</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${txCount}</div>
      <div class="stat-label">Transaksione</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${fmtALL(avgDaily)}</div>
      <div class="stat-label">Mesatare / ditë</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${budgetPct >= 80 ? '#ef4444' : budgetPct >= 50 ? '#f59e0b' : '#10b981'}">${budgetPct.toFixed(0)}%</div>
      <div class="stat-label">Buxheti i përdorur</div>
    </div>
  </div>
</div>

${opts.includeBudget && data.budget.monthly > 0 ? `
<!-- Budget -->
<div class="section">
  <div class="section-title">Buxheti Mujor</div>
  <div class="progress-wrap">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="font-weight:700;font-size:13px;">Buxheti: ${fmtALL(data.budget.monthly)}</span>
      <span style="font-weight:700;font-size:13px;color:${budgetPct >= 100 ? '#ef4444' : '#0f172a'}">${budgetPct.toFixed(0)}% i përdorur</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${budgetPct}%;background:${budgetPct >= 80 ? '#ef4444' : budgetPct >= 50 ? '#f59e0b' : 'linear-gradient(90deg,#10b981,#3b82f6)'};"></div>
    </div>
    <div class="progress-labels">
      <span>Shpenzuar: ${fmtALL(totalALL)}</span>
      <span>Mbetur: ${fmtALL(Math.max(data.budget.monthly - totalALL, 0))}</span>
    </div>
  </div>
</div>` : ''}

${catEntries.length > 0 ? `
<!-- Category Breakdown -->
<div class="section">
  <div class="section-title">Shpenzimet sipas Kategorisë</div>
  <table>
    <thead>
      <tr><th>Kategoria</th><th>Shpërndarja</th><th class="amount">Shuma (ALL)</th></tr>
    </thead>
    <tbody>
      ${catEntries.map(([cat, total]) => categoryRow(cat, total, totalALL)).join('')}
    </tbody>
  </table>
</div>` : ''}

${opts.includeExpenses && filtered.length > 0 ? `
<!-- Expenses -->
<div class="section">
  <div class="section-title">Lista e Shpenzimeve (${txCount} transaksione)</div>
  <table>
    <thead>
      <tr><th>Datë</th><th>Kategoria</th><th>Shënim</th><th>Shuma</th><th class="amount">Shuma (ALL)</th><th>Lloji</th></tr>
    </thead>
    <tbody>${expenseRows}</tbody>
  </table>
</div>` : ''}

${opts.includeSubscriptions && data.subscriptions.length > 0 ? `
<!-- Subscriptions -->
<div class="section">
  <div class="section-title">Abonimet (${data.subscriptions.filter((s) => s.isActive).length} aktive · ${fmtALL(subMonthly)}/muaj)</div>
  <table>
    <thead>
      <tr><th>Shërbimi</th><th>Shuma</th><th>Frekuenca</th><th>Pagesa ardhshme</th><th>Statusi</th></tr>
    </thead>
    <tbody>${subRows}</tbody>
  </table>
</div>` : ''}

${opts.includeGoals && data.goals.length > 0 ? `
<!-- Goals -->
<div class="section">
  <div class="section-title">Qëllimet Financiare (${data.goals.filter((g) => !g.completedAt).length} aktive)</div>
  <table>
    <thead>
      <tr><th>Titulli</th><th>Kursyer</th><th>Objektivi</th><th>Progresi</th><th>Afati</th><th>Statusi</th></tr>
    </thead>
    <tbody>${goalRows}</tbody>
  </table>
</div>` : ''}

<!-- Footer -->
<div class="footer">
  Gjeneruar nga <strong>Valuta</strong> · ${today} · Të gjitha shumat janë konvertuar në Lekë (ALL)
</div>

</body>
</html>`;
}

// ── Platform-aware export ─────────────────────────────────────────────────────

function triggerWebDownload(content: string, filename: string, mime: string): void {
  if (Platform.OS !== 'web') return;
  const g = globalThis as any;
  const blob = new g.Blob([content], { type: mime });
  const url = g.URL.createObjectURL(blob);
  const a = g.document.createElement('a');
  a.href = url;
  a.download = filename;
  g.document.body.appendChild(a);
  a.click();
  g.document.body.removeChild(a);
  g.URL.revokeObjectURL(url);
}

function triggerWebPrint(html: string, filename: string): void {
  if (Platform.OS !== 'web') return;
  const g = globalThis as any;

  // Inject a floating action bar + auto-print script into the report HTML.
  // The script fires via setTimeout so the browser has time to fully render before
  // the print dialog opens — avoiding the "about:blank print page" issue.
  const injected = `
<style>
  @media print { #valuta-bar { display: none !important; } }
</style>
<div id="valuta-bar" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(6,11,24,0.96);border-top:1px solid rgba(255,255,255,0.08);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <span style="color:#94a3b8;font-size:12px;font-weight:500;">Raport Valuta — gati</span>
  <div style="display:flex;gap:10px;">
    <button onclick="window.print()" style="background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;border:none;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;">Printo / Ruaj PDF</button>
    <a id="valuta-dl" href="#" style="background:rgba(255,255,255,0.06);color:#94a3b8;border:1px solid rgba(255,255,255,0.12);padding:9px 14px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;">Shkarko HTML</a>
  </div>
</div>
<script>
  (function() {
    var dl = document.getElementById('valuta-dl');
    if (dl) {
      try {
        var blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
        dl.href = URL.createObjectURL(blob);
        dl.download = '${filename}.html';
      } catch(e) {}
    }
    setTimeout(function() { try { window.print(); } catch(e) {} }, 900);
  })();
</script>
</body>`;

  const htmlWithActions = html.replace('</body>', injected);

  const win = g.window.open('', '_blank', 'width=1050,height=760,scrollbars=yes');
  if (!win) {
    // Popup blocked — download as an HTML file so the user still gets the report
    triggerWebDownload(htmlWithActions, `${filename}.html`, 'text/html;charset=utf-8;');
    return;
  }
  win.document.open();
  win.document.write(htmlWithActions);
  win.document.close();
}

export async function exportData(
  data: ExportData,
  opts: ExportOptions,
  filename: string
): Promise<ExportResult> {
  try {
    if (opts.format === 'csv') {
      const csvParts: string[] = [];

      if (opts.includeExpenses) {
        const filtered = buildExportedExpenses(data, opts);
        if (filtered.length > 0) {
          csvParts.push('=== SHPENZIMET ===\n' + generateExpensesCSV(filtered));
        }
      }
      if (opts.includeSubscriptions && data.subscriptions.length > 0) {
        csvParts.push('\n\n=== ABONIMET ===\n' + generateSubscriptionsCSV(data.subscriptions));
      }
      if (opts.includeGoals && data.goals.length > 0) {
        csvParts.push('\n\n=== QËLLIMET FINANCIARE ===\n' + generateGoalsCSV(data.goals));
      }

      const content = csvParts.join('') || 'Nuk ka të dhëna për periudhën e zgjedhur.';

      if (Platform.OS === 'web') {
        triggerWebDownload(content, `${filename}.csv`, 'text/csv;charset=utf-8;');
        return { success: true, method: 'download' };
      } else {
        await Share.share({
          message: content,
          title: `Valuta — ${filename}.csv`,
        });
        return { success: true, method: 'share' };
      }
    }

    // PDF
    if (opts.format === 'pdf') {
      if (Platform.OS === 'web') {
        const html = generateReportHTML(data, opts);
        triggerWebPrint(html, filename);
        return { success: true, method: 'print' };
      } else {
        // Native: PDF generation requires expo-print (not installed).
        // Fall back to sharing a summary text.
        const filtered = buildExportedExpenses(data, opts);
        const totalALL = filtered.reduce((s, e) => s + (e.convertedALL ?? 0), 0);
        const { label } = getDateRange(opts.period, opts.customStart, opts.customEnd);
        const summary = [
          `VALUTA — Raport Financiar`,
          `Periudha: ${label}`,
          `Shpenzuar: ${Math.round(totalALL).toLocaleString('sq-AL')} L`,
          `Transaksione: ${filtered.length}`,
          opts.includeBudget && data.budget.monthly > 0
            ? `Buxheti: ${Math.round((totalALL / data.budget.monthly) * 100)}% i përdorur`
            : '',
          opts.includeSubscriptions
            ? `Abonime aktive: ${data.subscriptions.filter((s) => s.isActive).length}`
            : '',
          opts.includeGoals
            ? `Qëllime aktive: ${data.goals.filter((g) => !g.completedAt).length}`
            : '',
          `\nPër PDF të plotë, hapni Valuta në browser (Web).`,
        ]
          .filter(Boolean)
          .join('\n');

        await Share.share({ message: summary, title: 'Valuta Raport' });
        return { success: true, method: 'share' };
      }
    }

    return { success: false, error: 'Format i panjohur.' };
  } catch (err: any) {
    if (err?.message === 'User did not share') {
      return { success: false, error: 'share_cancelled' };
    }
    return { success: false, error: err?.message ?? 'Gabim i panjohur.' };
  }
}

export function buildFilename(opts: ExportOptions): string {
  const { label } = getDateRange(opts.period, opts.customStart, opts.customEnd);
  const safeLabel = label.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/__+/g, '_');
  return `Valuta_Raport_${safeLabel}`;
}
