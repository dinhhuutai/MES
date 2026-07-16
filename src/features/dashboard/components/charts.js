// Biểu đồ + thẻ KPI dùng chung cho các trang Dashboard (sao chép mẫu từ DashboardPage — KHÔNG refactor file đó).
// Định dạng thời gian bằng fmtDur (vd "45′", "2h05′"); số đếm bằng fmtNum.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, Legend,
  CartesianGrid, ComposedChart, Area, Line,
} from 'recharts';
import { fmtNum } from '../../../utils/format';
import { fmtDur } from '../../../utils/sla';

const NUM_LABEL = { fontSize: 11, fill: '#374151', fontWeight: 600 };
const AXIS_TICK = { fontSize: 11, fill: '#6b7280' };

// Card chứa 1 biểu đồ (có thể kèm action ở góc phải).
export function ChartCard({ title, action, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Thẻ KPI (icon + số lớn + nhãn + phụ đề). tone: rose|amber|violet|sky|emerald|slate.
const TONES = {
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};
export function KpiCard({ tone = 'slate', icon, label, value, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-card border px-3 py-2.5 text-left transition ${TONES[tone]} ${onClick ? 'hover:brightness-95' : 'cursor-default'}`}>
      {icon && <span className="text-lg">{icon}</span>}
      <div className="min-w-0">
        <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-0.5 truncate text-[11px] font-medium opacity-90">{label}</div>
        {sub && <div className="truncate text-[10px] opacity-80">{sub}</div>}
      </div>
    </button>
  );
}

// Biểu đồ cột 1 chuỗi. data:[{name, value, color?}]. fmt = định dạng nhãn/tooltip (mặc định fmtNum).
// onBarClick(payload) để drill.
export function Bar1({ data, height = 300, color = '#0058be', fmt = fmtNum, unit = '', onBarClick, angle = -20 }) {
  const click = onBarClick ? (d) => onBarClick(d?.payload || d) : undefined;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={angle} textAnchor="end" height={64} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} width={44} tickFormatter={(v) => fmt(v)} />
        <Tooltip formatter={(v) => [`${fmt(v)}${unit ? ` ${unit}` : ''}`, '']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={click} cursor={onBarClick ? 'pointer' : undefined}>
          {data.map((d, i) => <Cell key={i} fill={d.color || color} />)}
          <LabelList dataKey="value" position="top" style={NUM_LABEL} formatter={fmt} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Xu hướng theo ngày: vùng (thời gian vượt SLA — trục trái) + đường (số vụ nghẽn — trục phải).
// data:[{ name, vuot_phut, so_vu }].
export function TrendComposed({ data, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 8, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={52} />
        <YAxis yAxisId="l" tick={AXIS_TICK} width={44} tickFormatter={fmtDur} />
        <YAxis yAxisId="r" orientation="right" allowDecimals={false} tick={AXIS_TICK} width={30} />
        <Tooltip formatter={(v, n) => [n === 'Số vụ nghẽn' ? fmtNum(v) : fmtDur(v), n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area yAxisId="l" type="monotone" dataKey="vuot_phut" name="Thời gian vượt SLA" stroke="#ef4444" fill="#fecaca" strokeWidth={2} />
        <Line yAxisId="r" type="monotone" dataKey="so_vu" name="Số vụ nghẽn" stroke="#b45309" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
