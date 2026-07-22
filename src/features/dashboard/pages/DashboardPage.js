import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, Legend, ReferenceLine } from 'recharts';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import KcsBreakdown from '../../../components/common/KcsBreakdown';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getActivity, getStageCounts, getBang2, getTinhTrangPhanIn, getHoanThanhHomNay, getChartDetail, getDieuPhoi, getFlow, getFlowOwners } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';
import { fmtDur } from '../../../utils/sla';

// Trạm cho các biểu đồ theo trạm (nghẽn / tổng chưa giao / gộp). keys = stage của stageCounts; trams = ma_tram (bản đồ nghẽn).
const STATION_BUCKETS = [
  { label: 'READY', keys: ['READY_KT', 'READY_QA'], trams: ['READY'], color: '#0058be' },
  { label: 'Release 1', keys: ['RELEASE_1'], trams: ['RELEASE_1'], color: '#6366f1' },
  { label: 'Test Run', keys: ['TESTRUN_CNSP', 'TESTRUN_QA'], trams: ['TEST_RUN'], color: '#8b5cf6' },
  { label: 'Release 2', keys: ['RELEASE_2'], trams: ['RELEASE_2'], color: '#0ea5e9' },
  { label: 'Sản xuất', keys: ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO', 'KCS', 'SUA'], trams: ['SAN_XUAT', 'CHO_KHO', 'KIEM', 'SUA'], color: '#f59e0b' },
  { label: 'OQC', keys: ['GIA_CONG', 'OQC'], trams: ['OQC'], color: '#a855f7' },
  { label: 'Giao', keys: ['DANG_GIAO'], trams: ['FINISH'], color: '#22c55e' }, // "chưa giao" = DANG_GIAO (loại DA_GIAO)
];

const NUM_LABEL = { fontSize: 11, fill: '#374151', fontWeight: 600 };
const AXIS_TICK = { fontSize: 11, fill: '#6b7280' };

// Card chứa 1 biểu đồ.
function ChartCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

// Biểu đồ cột 1 chuỗi (có số trên đầu cột). data: [{name, value, color?}].
function SingleBar({ data, height = 300, color = '#0058be', unit = '', angle = -20 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={angle} textAnchor="end" height={62} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} />
        <Tooltip formatter={(v) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, '']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color || color} />)}
          <LabelList dataKey="value" position="top" style={NUM_LABEL} formatter={fmtNum} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Biểu đồ cột 1 chuỗi + đường ngang vàng (tổng phần in).
function SingleBarRef({ data, refValue, height = 300, color = '#22c55e', unit = '' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={62} />
        {/* Ép trần trục Y ≥ giá trị đường vàng để đường luôn nằm trong miền vẽ (không bị cắt). */}
        <YAxis allowDecimals={false} tick={AXIS_TICK}
          domain={[0, refValue != null ? (dataMax) => Math.max(dataMax, refValue) : 'auto']} />
        <Tooltip formatter={(v) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, '']} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]}>
          <LabelList dataKey="value" position="top" style={NUM_LABEL} formatter={fmtNum} />
        </Bar>
        {refValue != null && (
          <ReferenceLine y={refValue} stroke="#f59e0b" strokeWidth={2} ifOverflow="extendDomain"
            label={{ value: `Tổng ${fmtNum(refValue)}`, position: 'right', fill: '#b45309', fontSize: 11, fontWeight: 700 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Biểu đồ cột nhiều chuỗi (mỗi nhóm N cột). series: [{key,label,color}]. onBarClick(datum) để drill.
// refLine: { value, label } → vẽ đường ngang (vd tổng phần in — màu vàng).
function GroupBar({ data, series, height = 320, unit = '', onBarClick, refLine }) {
  const click = onBarClick ? (d) => onBarClick(d?.payload || d) : undefined;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={62} />
        {/* Ép trần trục Y ≥ giá trị đường vàng để đường luôn nằm trong miền vẽ (không bị cắt). */}
        <YAxis allowDecimals={false} tick={AXIS_TICK}
          domain={[0, refLine != null ? (dataMax) => Math.max(dataMax, refLine.value) : 'auto']} />
        <Tooltip formatter={(v, n) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]}
            onClick={click} cursor={onBarClick ? 'pointer' : undefined}>
            <LabelList dataKey={s.key} position="top" style={NUM_LABEL} formatter={fmtNum} />
          </Bar>
        ))}
        {/* Đường tham chiếu vẽ SAU các cột → luôn nổi trên (không bị cột che). */}
        {refLine != null && (
          <ReferenceLine y={refLine.value} stroke="#f59e0b" strokeWidth={2} ifOverflow="extendDomain"
            label={{ value: refLine.label ?? refLine.value, position: 'right', fill: '#b45309', fontSize: 11, fontWeight: 700 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Biểu đồ CỘT CHỒNG (khép kín): các mảng cộng lại = Tổng (hiện nhãn Tổng trên đỉnh). onBarClick(payload, seriesKey).
function StackedBar({ data, series, height = 340, unit = '', onBarClick, totalKey = 'tong' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={62} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} />
        <Tooltip formatter={(v, n) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, idx) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId="a"
            onClick={onBarClick ? (d) => onBarClick(d?.payload || d, s.key) : undefined}
            cursor={onBarClick ? 'pointer' : undefined}>
            <LabelList dataKey={s.key} position="center"
              style={{ fontSize: 10, fontWeight: 700, fill: s.labelFill || '#fff' }}
              formatter={(v) => (v > 0 ? fmtNum(v) : '')} />
            {idx === series.length - 1 && (
              <LabelList dataKey={totalKey} position="top" style={NUM_LABEL} formatter={fmtNum} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

// Gộp các lượt xác nhận HÔM NAY theo PHẦN IN (1 phần in nhiều checklist/tem → 1 dòng, gộp các mục xác nhận).
function groupConfirm(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const key = r.phan_in_id || r.doi_tuong;
    let g = map.get(key);
    if (!g) {
      g = { key, phan_in_id: r.phan_in_id, ma_phan: r.ma_phan, doi_tuong: r.doi_tuong,
        mau_vai: r.mau_vai, ma_hang: r.ma_hang, dois: new Set(), items: [], tg: r.tg };
      map.set(key, g);
    }
    if (!g.ma_phan && r.ma_phan) g.ma_phan = r.ma_phan;
    if (r.doi_tuong) g.dois.add(r.doi_tuong); // mã đối tượng (LSX ở Test Run / tem ở KCS-OQC…)
    if (r.tg && (!g.tg || r.tg > g.tg)) g.tg = r.tg;
    g.items.push({ nhom: r.nhom, nguoi: r.nguoi, tg: r.tg }); // từng lượt xác nhận (checklist/tem) + giờ riêng
  });
  const out = [...map.values()];
  out.forEach((g) => { g.n = g.items.length; g.items.sort((a, b) => (a.tg > b.tg ? 1 : -1)); });
  return out.sort((a, b) => (b.tg > a.tg ? 1 : -1));
}

// Danh sách "đã xác nhận hôm nay" đã gộp theo phần in. onPick(phanIn) khi bấm (nếu có phan_in_id).
function ConfirmList({ rows, onPick }) {
  const groups = groupConfirm(rows);
  return (
    <div className="space-y-1.5">
      {groups.map((g) => {
        const label = g.ma_phan || g.doi_tuong || '—';
        // Mã đối tượng khác code phần (LSX ở Test Run / mã tem ở KCS-OQC…).
        const maList = [...(g.dois || [])].filter((d) => d && d !== g.ma_phan);
        const subLine = [g.ma_hang, ...maList].filter(Boolean).join(' · ');
        const clickable = !!g.phan_in_id;
        const inner = (
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-ink">{label}{g.mau_vai ? ` · ${g.mau_vai}` : ''}</div>
              {g.n > 1 && <span className="shrink-0 rounded bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{g.n} xác nhận</span>}
            </div>
            {subLine && <div className="font-mono text-[11px] text-ink-soft">{subLine}</div>}
            {/* Từng lượt xác nhận (checklist/tem) — mỗi dòng có giờ riêng */}
            <div className="mt-1 space-y-0.5 border-t border-line/50 pt-1">
              {g.items.map((it, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span className="break-words text-ink">{it.nhom || '—'}{it.nguoi ? ` · ${it.nguoi}` : ''}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">{fmtTime(it.tg)}</span>
                </div>
              ))}
            </div>
          </div>
        );
        return clickable ? (
          <button key={g.key} type="button" onClick={() => onPick && onPick({ id: g.phan_in_id, ma_phan: g.ma_phan })}
            className="block w-full rounded-control border border-line px-3 py-2 text-left hover:shadow-card">{inner}</button>
        ) : (
          <div key={g.key} className="rounded-control border border-line px-3 py-2">{inner}</div>
        );
      })}
    </div>
  );
}

const LOAI_CLS = {
  'Xác nhận': 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  Release: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  'Bắt đầu SX': 'bg-primary/15 text-primary',
  KCS: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  Sửa: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  OQC: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  'QC in-line': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
  Giao: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const TIER1_CELLS = [
  { key: 'so_don', label: 'Đơn hàng', type: 'total' },
  { key: 'so_ma', label: 'Mã hàng', type: 'total' },
  { key: 'so_phan_in', label: 'Phần in', type: 'total' },
  { label: 'READY', sub: ['READY_KT', 'READY_QA'], trams: ['READY'], hn: ['Khuôn', 'Film', 'Mực', 'QC xác nhận'] },
  { label: 'Release 1', sub: ['RELEASE_1'], trams: ['RELEASE_1'] },
  { label: 'Test Run', sub: ['TESTRUN_CNSP', 'TESTRUN_QA'], trams: ['TEST_RUN'], hn: ['CNSP xác nhận test', 'QA xác nhận test'] },
  { label: 'Release 2', sub: ['RELEASE_2'], trams: ['RELEASE_2'] },
  { label: 'Sản xuất', sub: ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO', 'KCS', 'SUA'], trams: ['SAN_XUAT', 'CHO_KHO', 'KIEM', 'SUA'], pcs: true, hn: ['KCS', 'Sửa'] },
  { label: 'OQC', sub: ['GIA_CONG', 'OQC'], trams: ['OQC'], pcs: true, hn: ['OQC'] },
  { label: 'Giao', sub: ['DANG_GIAO', 'DA_GIAO'], trams: ['FINISH'], pcs: true, hn: ['Giao'] },
];

const STAGE_CELLS = [
  { key: 'READY_KT', label: 'READY Kỹ thuật', trams: ['READY'], hn: ['Khuôn', 'Film', 'Mực'] },
  { key: 'READY_QA', label: 'READY QA', hn: ['QC xác nhận'] },
  { key: 'RELEASE_1', label: 'Release 1', trams: ['RELEASE_1'] },
  // Test Run gộp về QA (bỏ màn/khung CNSP): 1 khung "Test Run" cộng cả TESTRUN_CNSP + TESTRUN_QA
  // (luồng gộp: phần in chờ test nằm ở TESTRUN_CNSP, TESTRUN_QA gần như luôn rỗng).
  { key: 'TESTRUN_QA', keys: ['TESTRUN_CNSP', 'TESTRUN_QA'], label: 'Test Run', trams: ['TEST_RUN'], hn: ['QA xác nhận test'] },
  { key: 'RELEASE_2', label: 'Release 2', trams: ['RELEASE_2'] },
  { key: 'CHO_SAN_XUAT', label: 'Chờ sản xuất' },
  { key: 'SAN_XUAT', label: 'Đang sản xuất', trams: ['SAN_XUAT'] },
  { key: 'CHO_KHO', label: 'Chờ khô', trams: ['CHO_KHO'] },
  { key: 'KCS', label: 'KCS', trams: ['KIEM'], hn: ['KCS'] },
  { key: 'SUA', label: 'Sửa', trams: ['SUA'], hn: ['Sửa'] },
  { key: 'OQC', label: 'OQC', trams: ['OQC'], hn: ['OQC'] },
  { key: 'DANG_GIAO', label: 'Đang chờ giao', trams: ['FINISH'] },
  { key: 'DA_GIAO', label: 'Đã giao', hn: ['Giao'] },
];

function CellBadges({ nghen, sap, homNay }) {
  if (!nghen && !sap && !homNay) return null;
  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
      {homNay > 0 && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">✓{fmtNum(homNay)}</span>}
      {sap > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">⏳{fmtNum(sap)}</span>}
      {nghen > 0 && <span className="rounded-md bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">⚠{fmtNum(nghen)}</span>}
    </div>
  );
}

function PhanInJourney({ id }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getTinhTrangPhanIn(id).then((r) => { if (alive) { setD(r.data); setLoading(false); } }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, [id]);
  if (loading) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;
  if (!d) return <div className="py-10 text-center text-ink-soft">Không có dữ liệu.</div>;
  const ts = d.tem_summary || {};
  const sp = d.stage_pcs || {};
  return (
    <div className="space-y-4">
      <div className="rounded-control border border-line p-3 text-sm">
        <div className="font-semibold text-ink">{d.phan_in.ma_phan} · {d.phan_in.ten_khach_hang}</div>
        <div className="text-xs text-ink-soft">{d.phan_in.ma_don_hang} · {d.phan_in.ma_hang} · {[d.phan_in.mau_vai, d.phan_in.kich_vai, d.phan_in.kich_phim].filter(Boolean).join(' · ')}</div>
        {(ts.pcs_in > 0 || sp.sl_release > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sp.sl_release > 0 && <Badge tone="info">Release {fmtNum(sp.sl_release)}</Badge>}
            {ts.pcs_in > 0 && <Badge tone="default">In xong {fmtNum(ts.pcs_in)} pcs · {fmtNum(ts.so_tem)} tem</Badge>}
            {ts.sl_dat > 0 && <Badge tone="success">Đạt {fmtNum(ts.sl_dat)}</Badge>}
            {ts.sl_sua > 0 && <Badge tone="warning">Sửa {fmtNum(ts.sl_sua)}</Badge>}
            {sp.oqc_dat > 0 && <Badge tone="success">OQC đạt {fmtNum(sp.oqc_dat)}</Badge>}
            {sp.sua_dat > 0 && <Badge tone="warning">OQC qua sửa {fmtNum(sp.sua_dat)}</Badge>}
          </div>
        )}
        {d.kcs_by_dot?.dot?.length > 0 && (
          <div className="mt-2 border-t border-line pt-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">KCS theo đợt vải</div>
            <KcsBreakdown data={d.kcs_by_dot} />
          </div>
        )}
      </div>
      {(d.dot_vai || []).map((dv) => (
        <div key={dv.id} className="rounded-control border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{dv.ma_dot_vai}</span>
            {dv.current && (
              <Badge tone={dv.current.sla_status === 'NGHEN' ? 'danger' : dv.current.sla_status === 'SAP_NGHEN' ? 'warning' : 'info'}>{dv.current.ten_tram}</Badge>
            )}
          </div>
          <div className="text-xs text-ink-soft">SL vải {fmtNum(dv.so_luong_vai_ve)} · hạn giao {dv.han_giao_hang ? new Date(dv.han_giao_hang).toLocaleDateString('vi-VN') : '—'}</div>
          {dv.timeline?.length > 0 && (
            <ol className="relative mt-2 space-y-2 border-l border-line pl-4">
              {dv.timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="text-xs text-ink">{t.tu_ten ? <span className="text-ink-soft">{t.tu_ten} → </span> : ''}<b>{t.den_ten}</b></div>
                  <div className="text-[11px] text-ink-soft">{fmtTime(t.tg_kt)}{t.phut != null ? ` · ${fmtDur(t.phut)}` : ''} · {t.nguoi || '—'}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

// Hàng phần in bấm được (mở hành trình).
function PhanInRow({ p, tone, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center justify-between rounded-control border border-line px-3 py-2 text-left hover:shadow-card ${tone || ''}`}>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{p.ma_phan}{p.ten_khach_hang ? ` · ${p.ten_khach_hang}` : ''}</div>
        <div className="truncate text-xs text-ink-soft">{[p.ma_hang, p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' · ')}</div>
      </div>
      {p.phut_da_o != null && (
        <div className="shrink-0 text-right text-xs tabular-nums text-ink-soft">{fmtDur(p.phut_da_o)}{p.sla_phut ? ` / ${fmtDur(p.sla_phut)}` : ''}</div>
      )}
    </button>
  );
}

// Panel chi tiết 1 giai đoạn (bấm ô Tổng quan / Chi tiết giai đoạn).
function StageDetailPanel({ stage, bang2, hoanThanhDetail, chartDetail, onClose }) {
  const [phanIn, setPhanIn] = useState(null);
  const collect = (groups) => (groups || []).filter((g) => stage.trams?.includes(g.ma_tram)).flatMap((g) => g.phan_ins || []);
  const nghen = collect(bang2?.nhom_nghen);
  const sap = collect(bang2?.nhom_sap);
  const homNay = (hoanThanhDetail || []).filter((r) => stage.hn?.includes(r.nhom));
  const empty = nghen.length === 0 && sap.length === 0 && homNay.length === 0;

  // Chi tiết OQC / READY (đưa vào drill thay vì để ngoài dashboard chính).
  const isOqc = stage.label === 'OQC';
  const isReady = /READY/i.test(stage.label);
  const o = chartDetail?.oqc || {};
  const rd = chartDetail?.ready || {};
  const oqcChart = [
    { name: 'Tem KCS (chờ)', value: o.kcs_cho || 0, color: '#38bdf8' },
    { name: 'KCS đã XN', value: o.kcs_dat || 0, color: '#0284c7' },
    { name: 'Tem Sửa (chờ)', value: o.sua_cho || 0, color: '#fbbf24' },
    { name: 'Sửa đã XN', value: o.sua_dat || 0, color: '#d97706' },
    { name: 'Tổng (chờ)', value: o.tong_cho || 0, color: '#a78bfa' },
    { name: 'Tổng đã XN', value: o.tong_dat || 0, color: '#7c3aed' },
  ];
  const readyChart = [
    { name: 'Film', so_phan_in: rd.tong || 0, da_xn: rd.FILM || 0 },
    { name: 'Khuôn', so_phan_in: rd.tong || 0, da_xn: rd.KHUON || 0 },
    { name: 'Mực', so_phan_in: rd.tong || 0, da_xn: rd.MUC || 0 },
    { name: 'QA', so_phan_in: rd.tong || 0, da_xn: rd.QA || 0 },
  ];

  return (
    <SidePanel open onClose={onClose} width="max-w-2xl"
      title={phanIn ? `Phần in ${phanIn.ma_phan}` : stage.label}
      subtitle={phanIn ? undefined : 'Chi tiết giai đoạn'}>
      {phanIn ? (
        <>
          <button type="button" onClick={() => setPhanIn(null)} className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Icon name="chevron-left" size={14} /> Quay lại
          </button>
          <PhanInJourney id={phanIn.id} />
        </>
      ) : (
        <div className="space-y-4">
          {isOqc && (
            <div className="rounded-control border border-line p-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Chi tiết OQC (pcs) — nguồn KCS / Sửa</div>
              <SingleBar data={oqcChart} height={240} unit="pcs" />
            </div>
          )}
          {isReady && (
            <div className="rounded-control border border-line p-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">READY — số phần in & đã xác nhận từng mục</div>
              <GroupBar data={readyChart} height={240} unit="phần in" series={[
                { key: 'so_phan_in', label: 'Số phần in (ở READY)', color: '#94a3b8' },
                { key: 'da_xn', label: 'Đã xác nhận', color: '#0058be' },
              ]} />
            </div>
          )}
          {nghen.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-danger">Đang nghẽn ({nghen.length})</div>
              <div className="space-y-1.5">{nghen.map((p) => <PhanInRow key={p.phan_in_id} p={p} tone="bg-rose-50 dark:bg-rose-950/30" onClick={() => setPhanIn({ id: p.phan_in_id, ma_phan: p.ma_phan })} />)}</div>
            </div>
          )}
          {sap.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-warning">Sắp nghẽn ({sap.length})</div>
              <div className="space-y-1.5">{sap.map((p) => <PhanInRow key={p.phan_in_id} p={p} tone="bg-amber-50 dark:bg-amber-950/30" onClick={() => setPhanIn({ id: p.phan_in_id, ma_phan: p.ma_phan })} />)}</div>
            </div>
          )}
          {homNay.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600">Đã xác nhận hôm nay ({new Set(homNay.map((r) => r.phan_in_id || r.doi_tuong)).size})</div>
              <ConfirmList rows={homNay} onPick={setPhanIn} />
            </div>
          )}
          {empty && !isOqc && !isReady && <p className="text-sm text-ink-soft">Giai đoạn này chưa có phần in nghẽn/sắp nghẽn hay xác nhận hôm nay.</p>}
        </div>
      )}
    </SidePanel>
  );
}

// Drill toàn cục từ 3 chip tiêu đề.
function Bang2Panel({ kind, data, hoanThanhDetail, onClose }) {
  const [group, setGroup] = useState(null);
  const [htGroup, setHtGroup] = useState(null);
  const [phanIn, setPhanIn] = useState(null);
  const isHT = kind === 'hoan_thanh';
  const groups = kind === 'NGHEN' ? data.nhom_nghen : kind === 'SAP_NGHEN' ? data.nhom_sap : [];
  const rowTone = kind === 'NGHEN' ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-amber-50 dark:bg-amber-950/30';
  const baseTitle = isHT ? 'Hoàn thành hôm nay' : kind === 'NGHEN' ? 'Phần in nghẽn' : 'Phần in sắp nghẽn';

  let title = baseTitle; let back = null;
  if (phanIn) { title = `Phần in ${phanIn.ma_phan}`; back = () => setPhanIn(null); }
  else if (group) { title = group.ten_tram; back = () => setGroup(null); }
  else if (htGroup) { title = htGroup; back = () => setHtGroup(null); }

  const htItems = htGroup ? (hoanThanhDetail || []).filter((r) => r.nhom === htGroup) : [];

  return (
    <SidePanel open onClose={onClose} title={title} width="max-w-2xl" subtitle={back ? undefined : baseTitle}>
      {back && (
        <button type="button" onClick={back} className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Icon name="chevron-left" size={14} /> Quay lại
        </button>
      )}
      {phanIn ? <PhanInJourney id={phanIn.id} />
        : isHT && htGroup ? <ConfirmList rows={htItems} onPick={setPhanIn} />
        : isHT ? (
          <div className="space-y-2">
            {(data.nhom_hoan_thanh || []).length === 0 && <p className="text-sm text-ink-soft">Hôm nay chưa có xác nhận nào.</p>}
            {(data.nhom_hoan_thanh || []).map((g) => (
              <button key={g.nhom} type="button" onClick={() => setHtGroup(g.nhom)}
                className="flex w-full items-center justify-between rounded-control border border-line px-3 py-2 text-left hover:shadow-card">
                <div>
                  <div className="text-sm font-medium text-ink">{g.nhom}</div>
                  <div className="text-xs text-ink-soft">Gần nhất: {fmtTime(g.last_tg)} · {g.last_nguoi || '—'}</div>
                </div>
                <div className="flex items-center gap-2"><Badge tone="success">{fmtNum(g.n)} lượt</Badge><Icon name="chevron-right" size={16} className="text-ink-soft" /></div>
              </button>
            ))}
          </div>
        )
        : group ? (
          <div>
            <div className="space-y-1.5">
              {group.phan_ins.map((p) => (
                <PhanInRow key={p.phan_in_id} p={p} tone={rowTone} onClick={() => setPhanIn({ id: p.phan_in_id, ma_phan: p.ma_phan })} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
              <span className="text-ink-soft">SLA checkpoint: <b className="text-ink">{group.sla_phut ? fmtDur(group.sla_phut) : '—'}</b></span>
              <span className="text-right text-ink-soft">
                {group.owner_trach_nhiem && <div>Chịu trách nhiệm: <b className="text-ink">{group.owner_trach_nhiem}</b></div>}
                {group.owner_xu_ly && <div>Xử lý: <b className="text-ink">{group.owner_xu_ly}</b></div>}
                {!group.owner_trach_nhiem && !group.owner_xu_ly && 'Chưa gán owner'}
              </span>
            </div>
          </div>
        )
        : (
          <div className="space-y-2">
            {groups.length === 0 && <p className="text-sm text-ink-soft">Không có phần in {kind === 'NGHEN' ? 'nghẽn' : 'sắp nghẽn'}.</p>}
            {groups.map((g) => (
              <button key={g.ma_tram} type="button" onClick={() => setGroup(g)}
                className="flex w-full items-center justify-between rounded-control border border-line px-3 py-2.5 text-left hover:shadow-card">
                <div>
                  <div className="text-sm font-medium text-ink">{g.ten_tram}</div>
                  <div className="text-xs text-ink-soft">SLA {g.sla_phut ? fmtDur(g.sla_phut) : '—'}{g.owner_xu_ly ? ` · Xử lý: ${g.owner_xu_ly}` : ''}</div>
                </div>
                <div className="flex items-center gap-2"><Badge tone={kind === 'NGHEN' ? 'danger' : 'warning'}>{fmtNum(g.count)} phần in</Badge><Icon name="chevron-right" size={16} className="text-ink-soft" /></div>
              </button>
            ))}
          </div>
        )}
    </SidePanel>
  );
}

// Panel Trễ hạn giao: nhóm theo trạm đang kẹt → phần in (đã trễ N ngày / hạn giao) → hành trình.
function TreHanPanel({ data, initKind, initTram, onClose }) {
  const [kind, setKind] = useState(initKind || 'qua'); // qua | sap
  const [tram, setTram] = useState(initTram || null);
  const [phanIn, setPhanIn] = useState(null);
  const byTram = data?.by_tram || [];
  const kindOf = (p) => p.kind;
  const groups = byTram
    .map((g) => ({ ...g, list: (g.phan_ins || []).filter((p) => kindOf(p) === kind) }))
    .filter((g) => g.list.length);
  const curGroup = tram ? groups.find((g) => g.ma_tram === tram) : null;

  let title = kind === 'qua' ? 'Trễ hạn giao (đã quá hạn)' : 'Sắp đến hạn giao';
  let back = null;
  if (phanIn) { title = `Phần in ${phanIn.ma_phan}`; back = () => setPhanIn(null); }
  else if (curGroup) { title = curGroup.ten_tram || curGroup.ma_tram; back = () => setTram(null); }

  const Row = (p) => (
    <button key={p.phan_in_id} type="button" onClick={() => setPhanIn({ id: p.phan_in_id, ma_phan: p.ma_phan })}
      className="flex w-full items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-left hover:shadow-card">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{p.ma_phan}{p.ten_khach_hang ? ` · ${p.ten_khach_hang}` : ''}</div>
        <div className="truncate text-xs text-ink-soft">{[p.ma_hang, p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums">
        {p.kind === 'qua'
          ? <span className="font-semibold text-rose-600">Trễ {fmtNum(p.tre_ngay)} ngày</span>
          : <span className="font-semibold text-amber-600">Hạn {p.han_giao_hang ? new Date(p.han_giao_hang).toLocaleDateString('vi-VN') : '—'}</span>}
        <div className="text-ink-soft">{p.han_giao_hang ? new Date(p.han_giao_hang).toLocaleDateString('vi-VN') : ''}</div>
      </div>
    </button>
  );

  return (
    <SidePanel open onClose={onClose} title={title} width="max-w-2xl"
      subtitle={back ? undefined : 'Theo trạm đang kẹt — ưu tiên đẩy hàng'}>
      {!phanIn && (
        <div className="mb-3 flex gap-1.5">
          <button type="button" onClick={() => { setKind('qua'); setTram(null); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === 'qua' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
            Đã trễ ({fmtNum(data?.qua_han || 0)})
          </button>
          <button type="button" onClick={() => { setKind('sap'); setTram(null); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === 'sap' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
            Sắp đến hạn ({fmtNum(data?.sap_han || 0)})
          </button>
        </div>
      )}
      {back && (
        <button type="button" onClick={back} className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Icon name="chevron-left" size={14} /> Quay lại
        </button>
      )}
      {phanIn ? <PhanInJourney id={phanIn.id} />
        : curGroup ? <div className="space-y-1.5">{curGroup.list.map(Row)}</div>
        : groups.length === 0 ? <p className="text-sm text-ink-soft">Không có phần in {kind === 'qua' ? 'trễ hạn' : 'sắp đến hạn'}.</p>
        : (
          <div className="space-y-2">
            {groups.map((g) => (
              <button key={g.ma_tram} type="button" onClick={() => setTram(g.ma_tram)}
                className="flex w-full items-center justify-between rounded-control border border-line px-3 py-2.5 text-left hover:shadow-card">
                <div className="text-sm font-medium text-ink">{g.ten_tram || g.ma_tram}</div>
                <div className="flex items-center gap-2">
                  <Badge tone={kind === 'qua' ? 'danger' : 'warning'}>{fmtNum(g.list.length)} phần in</Badge>
                  <Icon name="chevron-right" size={16} className="text-ink-soft" />
                </div>
              </button>
            ))}
          </div>
        )}
    </SidePanel>
  );
}

// Drill "Tiến độ phần in theo checkpoint" — trả lời KẸT GÌ · VÌ SAO · AI CHỊU TRÁCH NHIỆM · AI XỬ LÝ TIẾP.
const SEG_LABEL = { da_xong: 'Đã đi qua', dung_sla: 'Đang xử lý (đúng SLA)', sap: 'Sắp nghẽn', nghen: 'Nghẽn' };
const SLA_TONE = { NGHEN: 'danger', SAP_NGHEN: 'warning', OK: 'success' };
const SLA_TEXT = { NGHEN: 'Nghẽn', SAP_NGHEN: 'Sắp nghẽn', OK: 'Đúng SLA' };
function CheckpointDrillPanel({ drill, flow, tramToBucket, bucketOrder, bucketOwners, onClose }) {
  if (!drill) return null;
  const { name, seg } = drill;
  const bIdx = bucketOrder[name] ?? 99;
  const cpOwner = (bucketOwners || {})[name] || {}; // owner mức checkpoint (gộp bucket)
  const reason = (r) => {
    const ton = `tồn ${fmtDur(r.phut_da_o || 0)}${r.sla_phut ? ` / định mức ${fmtDur(r.sla_phut)}` : ''}`;
    if (r.sla_status === 'NGHEN') return `Quá SLA — ${ton}`;
    if (r.sla_status === 'SAP_NGHEN') return `Sắp quá SLA (trong ngưỡng cảnh báo) — ${ton}`;
    return `Đang xử lý trong SLA — ${ton}`;
  };
  let items;
  if (seg === 'da_xong') {
    items = (flow || []).filter((r) => (bucketOrder[tramToBucket[r.ma_tram]] ?? -1) > bIdx);
  } else {
    const atBucket = (flow || []).filter((r) => tramToBucket[r.ma_tram] === name);
    const wantSla = seg === 'nghen' ? 'NGHEN' : seg === 'sap' ? 'SAP_NGHEN' : seg === 'dung_sla' ? 'OK' : null;
    items = wantSla ? atBucket.filter((r) => r.sla_status === wantSla) : atBucket;
  }
  items = [...items].sort((a, b) => (b.phut_da_o || 0) - (a.phut_da_o || 0));
  const title = `${name}${seg ? ` · ${SEG_LABEL[seg] || ''}` : ''}`;
  return (
    <SidePanel open onClose={onClose} title={title} width="max-w-2xl"
      subtitle={seg === 'da_xong' ? 'Đã đi qua checkpoint — đang ở các trạm sau' : 'Kẹt gì · vì sao · ai chịu trách nhiệm · ai xử lý tiếp'}>
      {/* Owner mức CHECKPOINT (cấu hình ở Hệ thống > Owner) */}
      <div className="mb-3 rounded-control border border-line bg-surface-muted/50 px-3 py-2 text-xs">
        <div className="mb-1 font-semibold text-ink">Owner checkpoint "{name}"</div>
        <div className="grid grid-cols-2 gap-x-3">
          <div><span className="text-ink-soft">Chịu trách nhiệm: </span><b className="text-ink">{cpOwner.tn || '—'}</b></div>
          <div><span className="text-ink-soft">Xử lý tiếp: </span><b className="text-ink">{cpOwner.xl || '—'}</b></div>
        </div>
        {!cpOwner.tn && !cpOwner.xl && (
          <div className="mt-1 text-[11px] text-amber-600">Chưa gán owner cho checkpoint này — vào Hệ thống → Owner checkpoint/checklist.</div>
        )}
      </div>
      <div className="mb-3 text-xs text-ink-soft">{items.length} mục</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">Không có mục nào{seg === 'da_xong' && name === 'Giao' ? ' (đã giao xong = ra khỏi dòng chảy theo dõi).' : '.'}</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.dot_vai_ve_id} className="rounded-control border border-line p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{r.ma_phan}{r.ten_khach_hang ? ` · ${r.ten_khach_hang}` : ''}</div>
                  <div className="text-xs text-ink-soft">{[r.ma_don_hang && `Đơn ${r.ma_don_hang}`, r.ma_hang && `Mã ${r.ma_hang}`, [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}</div>
                </div>
                <Badge tone={SLA_TONE[r.sla_status] || 'default'}>{SLA_TEXT[r.sla_status] || '—'}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {seg === 'da_xong' && <div><span className="text-ink-soft">Hiện ở: </span><b className="text-ink">{r.ten_tram}</b></div>}
                <div><span className="text-ink-soft">Ngày giao: </span><b className="text-ink">{r.han_giao_hang ? new Date(r.han_giao_hang).toLocaleDateString('vi-VN') : '—'}</b></div>
                <div><span className="text-ink-soft">Thời gian tồn: </span><b className="text-ink">{fmtDur(r.phut_da_o || 0)}{r.sla_phut ? ` / ${fmtDur(r.sla_phut)}` : ''}</b></div>
                <div className="col-span-2"><span className="text-ink-soft">Nguyên nhân: </span><span className="text-ink">{reason(r)}</span></div>
                <div><span className="text-ink-soft">Chịu trách nhiệm: </span><b className="text-ink">{r.owner_trach_nhiem || cpOwner.tn || '—'}</b></div>
                <div><span className="text-ink-soft">Xử lý tiếp: </span><b className="text-ink">{r.owner_xu_ly || cpOwner.xl || '—'}</b></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SidePanel>
  );
}

export default function DashboardPage() {
  const { toast, show } = useToast();
  const [stages, setStages] = useState(null);
  const [activity, setActivity] = useState([]);
  const [bang2, setBang2] = useState(null);
  const [htDetail, setHtDetail] = useState([]);
  const [chartDetail, setChartDetail] = useState(null); // OQC + READY breakdown
  const [dieuPhoi, setDieuPhoi] = useState(null); // trễ hạn + chờ duyệt + chuyền
  const [flow, setFlow] = useState([]);           // dòng chảy per đợt vải (drill checkpoint)
  const [owners, setOwners] = useState(null);     // owner theo trạm/checklist (Hệ thống > Owner)
  const [drill, setDrill] = useState(null);       // chip toàn cục
  const [treHan, setTreHan] = useState(null);     // panel trễ hạn giao
  const [stageDetail, setStageDetail] = useState(null); // ô giai đoạn
  const [cpDrill, setCpDrill] = useState(null);   // drill "Tiến độ phần in theo checkpoint" (kẹt gì/ai xử lý)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sc, act, b2, ht, cd, dp, fl, ow] = await Promise.allSettled([
      getStageCounts(), getActivity(), getBang2(), getHoanThanhHomNay(), getChartDetail(), getDieuPhoi(), getFlow({}), getFlowOwners(),
    ]);
    if (sc.status === 'fulfilled') setStages(sc.value.data);
    else show(sc.reason?.message || 'Lỗi tải giai đoạn', 'error');
    if (act.status === 'fulfilled') setActivity(act.value.data);
    if (b2.status === 'fulfilled') setBang2(b2.value.data);
    if (ht.status === 'fulfilled') setHtDetail(ht.value.data);
    if (cd.status === 'fulfilled') setChartDetail(cd.value.data);
    if (dp.status === 'fulfilled') setDieuPhoi(dp.value.data);
    if (fl.status === 'fulfilled') setFlow(fl.value.data || []);
    if (ow.status === 'fulfilled') setOwners(ow.value.data || null);
    setLoading(false);
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);

  const nghenByTram = useMemo(() => Object.fromEntries((bang2?.nhom_nghen || []).map((g) => [g.ma_tram, g.count])), [bang2]);
  const sapByTram = useMemo(() => Object.fromEntries((bang2?.nhom_sap || []).map((g) => [g.ma_tram, g.count])), [bang2]);

  // Đã xác nhận tại trạm: cột 1 = số phần in HOÀN TẤT trạm hôm nay (qua trạm sau) — chỉ đếm CHECKLIST CUỐI
  //   (READY→QC xác nhận, Test Run→QA; KCS/Sửa/OQC/Giao mỗi lần xác nhận là đã đẩy tem qua trạm sau).
  //   cột 2 = đã xác nhận tại trạm & phần in CHƯA GIAO (BE).
  const confirmStationData = useMemo(() => {
    // 7 trạm KHỚP với "Tổng quan giai đoạn". hn = mốc "chuyển đi" hôm nay (checklist cuối / sự kiện qua trạm).
    const CONFIRM_STATIONS = [
      { label: 'READY', key: 'ready', hn: ['QC xác nhận'], keys: ['READY_KT', 'READY_QA'] },
      { label: 'Release 1', key: 'release_1', hn: ['Release 1'], keys: ['RELEASE_1'] },
      { label: 'Test Run', key: 'test', hn: ['QA xác nhận test'], keys: ['TESTRUN_CNSP', 'TESTRUN_QA'] },
      { label: 'Release 2', key: 'release_2', hn: ['Release 2'], keys: ['RELEASE_2'] },
      { label: 'Sản xuất', key: 'san_xuat', hn: ['KCS', 'Sửa'], keys: ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO', 'KCS', 'SUA'] },
      { label: 'OQC', key: 'oqc', hn: ['OQC'], keys: ['GIA_CONG', 'OQC'] },
      { label: 'Giao', key: 'giao', hn: ['Giao'], keys: ['DANG_GIAO'] },
    ];
    const sc = chartDetail?.station_confirmed || {};
    return CONFIRM_STATIONS.map((s) => {
      const seen = new Set();
      (htDetail || []).forEach((r) => { if (s.hn.includes(r.nhom)) seen.add(r.phan_in_id || r.doi_tuong); });
      const dang_o = s.keys.reduce((a, k) => a + (stages?.stages?.[k]?.phan_in || 0), 0);
      return { name: s.label, dang_o, hom_nay: seen.size, chua_giao: sc[s.key] || 0 };
    });
  }, [chartDetail, htDetail, stages]);

  // Nghẽn & Sắp nghẽn theo trạm (từ bản đồ nghẽn của bang-2).
  const nghenSapData = useMemo(() => STATION_BUCKETS.map((b) => ({
    name: b.label,
    nghen: b.trams.reduce((a, t) => a + (nghenByTram[t] || 0), 0),
    sap: b.trams.reduce((a, t) => a + (sapByTram[t] || 0), 0),
  })), [nghenByTram, sapByTram]);

  // Tổng số phần in đang theo dõi (= Σ phần in mọi giai đoạn) → đường vàng của biểu đồ tiến độ.
  const tongPhanIn = useMemo(() => {
    const s = stages?.stages || {};
    return Object.values(s).reduce((a, v) => a + (v?.phan_in || 0), 0);
  }, [stages]);

  // Biểu đồ "Tiến độ phần in theo checkpoint" — PHÂN RÃ KHÉP KÍN: mỗi checkpoint
  //   Tổng = Đã đi qua + Đang xử lý (đúng SLA) + Sắp nghẽn + Nghẽn.
  //   • Đã đi qua  = phần in đã qua checkpoint & còn trong dòng chảy (chưa giao) — station_confirmed;
  //                  riêng GIAO = đã giao (DA_GIAO).
  //   • Đang tại checkpoint (dominant, stageCounts) tách theo SLA: Nghẽn (quá SLA) / Sắp nghẽn (trong ngưỡng
  //     cảnh báo trước SLA) / Đúng SLA (còn lại). Nghẽn & Sắp lấy theo trạm (bản đồ nghẽn); Đúng SLA = phần dư.
  const checkpointProgressData = useMemo(() => {
    const nsByName = Object.fromEntries(nghenSapData.map((x) => [x.name, x]));
    const daGiao = stages?.stages?.DA_GIAO?.phan_in || 0;
    return confirmStationData.map((c) => {
      const da_xong = c.name === 'Giao' ? daGiao : c.chua_giao;
      const dang_o = c.dang_o;
      const ns = nsByName[c.name] || {};
      // Clamp để nghẽn + sắp ≤ đang tại trạm (đơn vị đếm có thể lệch nhẹ giữa dominant & bản đồ nghẽn).
      const nghen = Math.min(ns.nghen || 0, dang_o);
      const sap = Math.min(ns.sap || 0, Math.max(0, dang_o - nghen));
      const dung_sla = Math.max(0, dang_o - nghen - sap); // đang xử lý đúng SLA
      return { name: c.name, da_xong, dung_sla, sap, nghen, dang_o, tong: da_xong + dang_o };
    });
  }, [confirmStationData, nghenSapData, stages]);

  // Map trạm (ma_tram của flowRows) → tên checkpoint (bucket) trên biểu đồ, để drill lọc đúng nhóm.
  const tramToBucket = useMemo(() => {
    const m = {};
    STATION_BUCKETS.forEach((b) => b.trams.forEach((t) => { m[t] = b.label; }));
    // flowRows dùng KIEM cho KCS, FINISH cho chờ giao — đã có trong STATION_BUCKETS. CHO_SAN_XUAT → Sản xuất.
    m.CHO_SAN_XUAT = 'Sản xuất';
    return m;
  }, []);
  const bucketOrder = useMemo(() => Object.fromEntries(STATION_BUCKETS.map((b, i) => [b.label, i])), []);

  // Owner mức CHECKPOINT (gộp owner mọi trạm trong bucket) — nguồn Hệ thống > Owner, độc lập với dòng chảy.
  const bucketOwners = useMemo(() => {
    const tramMap = owners?.tram || {};
    const out = {};
    STATION_BUCKETS.forEach((b) => {
      const tn = new Set(); const xl = new Set();
      b.trams.forEach((t) => {
        (tramMap[t]?.chiu_trach_nhiem || []).forEach((x) => tn.add(x));
        (tramMap[t]?.xu_ly || []).forEach((x) => xl.add(x));
      });
      out[b.label] = { tn: [...tn].join(', ') || null, xl: [...xl].join(', ') || null };
    });
    return out;
  }, [owners]);

  // Chi tiết READY: Film/Khuôn/Mực — 3 cột Tổng (ở READY) / Đã xác nhận / Nghẽn (giống biểu đồ tiến độ).
  const readySubData = useMemo(() => {
    const rd = chartDetail?.ready || {};
    const tong = rd.tong || 0;
    const totalNghen = nghenByTram.READY || 0;
    // Nghẽn THEO TỪNG CHECKLIST = số phần in NGHẼN nhưng CHƯA xác nhận mục đó (mục đã xác nhận không tính nghẽn).
    // Giới hạn theo "chưa xác nhận" của từng mục (tong − đã xác nhận), thay vì áp tổng nghẽn READY cho cả 3.
    const nghenFor = (dat) => Math.min(totalNghen, Math.max(0, tong - (dat || 0)));
    return [
      { name: 'Film', tong, da_xong: rd.FILM || 0, nghen: nghenFor(rd.FILM) },
      { name: 'Khuôn', tong, da_xong: rd.KHUON || 0, nghen: nghenFor(rd.KHUON) },
      { name: 'Mực', tong, da_xong: rd.MUC || 0, nghen: nghenFor(rd.MUC) },
    ];
  }, [chartDetail, nghenByTram]);

  // Chi tiết Sản xuất: Chờ SX/Sản xuất/KCS/Sửa — Đã xong = phần in đã qua giai đoạn (đang ở giai đoạn sau).
  const sanXuatSubData = useMemo(() => {
    const p = (k) => stages?.stages?.[k]?.phan_in || 0;
    const FLOW = ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO', 'KCS', 'SUA', 'OQC', 'DANG_GIAO', 'DA_GIAO'];
    const downstream = (k) => { const i = FLOW.indexOf(k); return i < 0 ? 0 : FLOW.slice(i + 1).reduce((a, x) => a + p(x), 0); };
    const items = [
      { name: 'Chờ sản xuất', key: 'CHO_SAN_XUAT', tram: null },
      { name: 'Sản xuất', key: 'SAN_XUAT', tram: 'SAN_XUAT' },
      { name: 'KCS', key: 'KCS', tram: 'KIEM' },
      { name: 'Sửa', key: 'SUA', tram: 'SUA' },
    ];
    return items.map((it) => {
      const dangO = p(it.key); const daXong = downstream(it.key);
      return { name: it.name, tong: dangO + daXong, da_xong: daXong, nghen: it.tram ? (nghenByTram[it.tram] || 0) : 0 };
    });
  }, [stages, nghenByTram]);

  // Tải sản xuất (WIP) — phần in đang ở từng khâu sản xuất.
  const wipData = useMemo(() => {
    const p = (k) => stages?.stages?.[k]?.phan_in || 0;
    return [
      { name: 'Chờ chạy', value: p('CHO_SAN_XUAT'), color: '#0ea5e9' },
      { name: 'Đang chạy', value: p('SAN_XUAT'), color: '#f59e0b' },
      { name: 'Chờ khô', value: p('CHO_KHO'), color: '#64748b' },
      { name: 'Kiểm', value: p('KCS'), color: '#3b82f6' },
      { name: 'Sửa', value: p('SUA'), color: '#f97316' },
    ];
  }, [stages]);

  // Trễ hạn giao theo trạm (BE /dieu-phoi).
  const treHanData = useMemo(() => (dieuPhoi?.tre_han?.by_tram || []).map((g) => ({
    name: g.ten_tram || g.ma_tram, ma_tram: g.ma_tram, qua_han: g.qua_han, sap_han: g.sap_han,
  })), [dieuPhoi]);

  if (loading) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;

  const sumBy = (arr, map) => (arr || []).reduce((a, k) => a + (map[k] || 0), 0);
  // ✓ hôm nay = số PHẦN IN distinct đã xác nhận trong giai đoạn (không cộng dồn từng lượt checklist).
  const homNayDistinct = (hn) => {
    if (!hn?.length) return 0;
    const set = new Set(hn);
    const seen = new Set();
    (htDetail || []).forEach((r) => { if (set.has(r.nhom)) seen.add(r.phan_in_id || r.doi_tuong); });
    return seen.size;
  };
  const cellMetrics = (c) => ({ nghen: sumBy(c.trams, nghenByTram), sap: sumBy(c.trams, sapByTram), homNay: homNayDistinct(c.hn) });
  const sumSub = (subs, field) => (subs || []).reduce((a, k) => a + (stages?.stages?.[k]?.[field] || 0), 0);
  const openStage = (c) => setStageDetail({ label: c.label, trams: c.trams, hn: c.hn });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-soft">Theo dõi dòng chảy sản xuất theo thời gian thực</p>
        </div>
        <Badge tone="success"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Realtime</Badge>
      </div>

      {/* ===== DẢI KPI ĐIỀU PHỐI (bấm để xem chi tiết) ===== */}
      {(() => {
        const release2 = stages?.stages?.RELEASE_2?.phan_in || 0;
        const cd = dieuPhoi?.cho_duyet || {};
        const choDuyet = release2 + (cd.qc_tra_ve || 0) + (cd.oqc_khong_dat || 0);
        const ch = dieuPhoi?.chuyen || {};
        const KpiCard = ({ tone, icon, label, value, sub, onClick }) => {
          const T = {
            rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
            amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
            violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
            sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
            emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
          }[tone];
          return (
            <button type="button" onClick={onClick} disabled={!onClick}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-card border px-3 py-2.5 text-left transition ${T} ${onClick ? 'hover:brightness-95' : 'cursor-default'}`}>
              <span className="text-lg">{icon}</span>
              <div className="min-w-0">
                <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
                <div className="mt-0.5 truncate text-[11px] font-medium opacity-90">{label}</div>
                {sub && <div className="truncate text-[10px] opacity-80">{sub}</div>}
              </div>
            </button>
          );
        };
        return (
          <div className="mb-5 flex flex-wrap gap-2.5">
            <KpiCard tone="rose" icon="🔴" label="Trễ hạn giao" value={fmtNum(dieuPhoi?.tre_han?.qua_han || 0)}
              sub="đã quá hạn, chưa giao" onClick={() => setTreHan({ kind: 'qua' })} />
            <KpiCard tone="amber" icon="🟡" label="Sắp đến hạn" value={fmtNum(dieuPhoi?.tre_han?.sap_han || 0)}
              sub="hôm nay & ngày mai" onClick={() => setTreHan({ kind: 'sap' })} />
            <KpiCard tone="rose" icon="⚠" label="Nghẽn (quá SLA)" value={fmtNum(bang2?.nghen || 0)} onClick={() => setDrill('NGHEN')} />
            <KpiCard tone="amber" icon="⏳" label="Sắp nghẽn" value={fmtNum(bang2?.sap_nghen || 0)} onClick={() => setDrill('SAP_NGHEN')} />
            <KpiCard tone="violet" icon="📝" label="Chờ duyệt / xử lý" value={fmtNum(choDuyet)}
              sub={`Release 2: ${fmtNum(release2)} · QC trả về: ${fmtNum(cd.qc_tra_ve || 0)} · OQC lỗi: ${fmtNum(cd.oqc_khong_dat || 0)}`} />
            <KpiCard tone="sky" icon="🏭" label="Chuyền đang chạy" value={`${fmtNum(ch.dang_chay || 0)}/${fmtNum(ch.tong || 0)}`}
              sub={`Rảnh: ${fmtNum(ch.ranh || 0)} chuyền`} />
            <KpiCard tone="emerald" icon="✅" label="Hoàn tất hôm nay" value={fmtNum(bang2?.hoan_thanh_hom_nay || 0)} onClick={() => setDrill('hoan_thanh')} />
          </div>
        );
      })()}

      {/* Tầng 1 — tổng quan giai đoạn */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Tổng quan giai đoạn</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {TIER1_CELLS.map((c) => {
          if (c.type === 'total') {
            return (
              <div key={c.key} className="card p-3 text-center">
                <div className="text-2xl font-bold text-ink tabular-nums">{fmtNum(stages?.totals?.[c.key] || 0)}</div>
                <div className="text-xs text-ink-soft">{c.label}</div>
              </div>
            );
          }
          return (
            <button key={c.label} type="button" onClick={() => openStage(c)} className="card p-3 text-center transition hover:shadow-card-hover">
              <div className="text-2xl font-bold text-primary tabular-nums">{fmtNum(sumSub(c.sub, 'phan_in'))}</div>
              <div className="text-xs font-medium text-ink">{c.label}</div>
              {c.pcs ? <div className="text-[11px] text-ink-soft">{fmtNum(sumSub(c.sub, 'pcs'))} pcs</div> : null}
              <CellBadges {...cellMetrics(c)} />
            </button>
          );
        })}
      </div>

      {/* Tầng 2 — chi tiết theo giai đoạn */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Chi tiết theo giai đoạn</div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STAGE_CELLS.map((c) => {
          // c.keys → gộp số nhiều stage (vd Test Run = TESTRUN_CNSP + TESTRUN_QA); mặc định theo c.key.
          const st = c.keys
            ? c.keys.reduce((a, k) => {
                const s = stages?.stages?.[k] || {};
                a.phan_in += s.phan_in || 0; a.ma += s.ma || 0; a.pcs += s.pcs || 0;
                return a;
              }, { phan_in: 0, ma: 0, pcs: 0 })
            : (stages?.stages?.[c.key] || { phan_in: 0, ma: 0, pcs: 0 });
          const showTem = st.so_tem != null;
          return (
            <button key={c.key} type="button" onClick={() => openStage(c)} className="card p-3 text-center transition hover:shadow-card-hover">
              <div className="text-2xl font-bold text-primary tabular-nums">{fmtNum(st.phan_in)}</div>
              <div className="text-xs font-medium text-ink">{c.label}</div>
              <div className="text-[11px] text-ink-soft">
                {fmtNum(st.ma)} mã{showTem ? ` · ${fmtNum(st.so_tem)} tem` : ''}{st.pcs ? ` · ${fmtNum(st.pcs)} pcs` : ''}
              </div>
              <CellBadges {...cellMetrics(c)} />
            </button>
          );
        })}
      </div>

      {/* ===== CHI TIẾT 2 CHECKPOINT: READY & SẢN XUẤT — mỗi mục 3 cột Tổng/Đã xong/Nghẽn (đường vàng = tổng phần in) ===== */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title={`Chi tiết READY (Film / Khuôn / Mực) · đường vàng = tổng phần in (${fmtNum(tongPhanIn)})`}>
          <GroupBar data={readySubData} unit="phần in" height={320}
            refLine={{ value: tongPhanIn, label: `Tổng ${fmtNum(tongPhanIn)}` }}
            series={[
              { key: 'tong', label: 'Tổng (ở READY)', color: '#94a3b8' },
              { key: 'da_xong', label: 'Đã xác nhận', color: '#22c55e' },
              { key: 'nghen', label: 'Nghẽn', color: '#ef4444' },
            ]} />
        </ChartCard>

        <ChartCard title={`Chi tiết Sản xuất (Chờ SX / Sản xuất / KCS / Sửa) · đường vàng = tổng phần in (${fmtNum(tongPhanIn)})`}>
          <GroupBar data={sanXuatSubData} unit="phần in" height={320}
            refLine={{ value: tongPhanIn, label: `Tổng ${fmtNum(tongPhanIn)}` }}
            series={[
              { key: 'tong', label: 'Tổng (đã xong + đang ở)', color: '#94a3b8' },
              { key: 'da_xong', label: 'Đã xong (đã qua giai đoạn)', color: '#22c55e' },
              { key: 'nghen', label: 'Nghẽn', color: '#ef4444' },
            ]} />
        </ChartCard>
      </div>

      {/* ===== BẢNG ĐIỀU PHỐI — 4 biểu đồ hành động (2/hàng); Hoạt động gần đây cuối cùng ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Tiến độ phần in theo checkpoint  ·  Tổng = Đã đi qua + Đúng SLA + Sắp nghẽn + Nghẽn (bấm mảng để xem chi tiết)">
          <StackedBar data={checkpointProgressData} unit="phần in" height={340}
            onBarClick={(d, seg) => setCpDrill({ name: d?.name, seg })}
            series={[
              { key: 'da_xong', label: 'Đã đi qua', color: '#94a3b8' },
              { key: 'dung_sla', label: 'Đang xử lý (đúng SLA)', color: '#22c55e', labelFill: '#052e16' },
              { key: 'sap', label: 'Sắp nghẽn', color: '#f59e0b', labelFill: '#442c04' },
              { key: 'nghen', label: 'Nghẽn (quá SLA)', color: '#ef4444' },
            ]} />
          <div className="mt-2 space-y-0.5 text-[11px] text-ink-soft">
            <div><b className="text-ink">Đã đi qua</b>: đã qua checkpoint & còn trong dòng chảy (Giao = đã giao). <b className="text-ink">Đúng SLA</b>: đang tại checkpoint, còn trong định mức.</div>
            <div><b className="text-ink">Sắp nghẽn</b>: trong ngưỡng cảnh báo trước SLA. <b className="text-ink">Nghẽn</b>: quá SLA. Bấm từng mảng để xem PO/mã/phần, thời gian tồn, nguyên nhân, owner & người xử lý tiếp.</div>
          </div>
        </ChartCard>

        {/* Biểu đồ CŨ (cột nhóm) — giữ lại theo yêu cầu; bấm cột mở StageDetailPanel. */}
        <ChartCard title={`Tiến độ phần in theo checkpoint (cột nhóm)  ·  đường vàng = tổng phần in (${fmtNum(tongPhanIn)})`}>
          <GroupBar data={checkpointProgressData} unit="phần in" height={340}
            refLine={{ value: tongPhanIn, label: `Tổng ${fmtNum(tongPhanIn)}` }}
            onBarClick={(d) => { const b = STATION_BUCKETS.find((x) => x.label === d?.name); if (b) setStageDetail({ label: b.label, trams: b.trams, hn: [] }); }}
            series={[
              { key: 'tong', label: 'Tổng (đã xong + đang ở)', color: '#94a3b8' },
              { key: 'da_xong', label: 'Đã xong', color: '#22c55e' },
              { key: 'nghen', label: 'Nghẽn', color: '#ef4444' },
            ]} />
        </ChartCard>

        <ChartCard title={`Phần in đã xong theo checkpoint  ·  đường vàng = tổng phần in (${fmtNum(tongPhanIn)})`}>
          <SingleBarRef data={checkpointProgressData.map((d) => ({ name: d.name, value: d.da_xong }))}
            refValue={tongPhanIn} unit="phần in" />
        </ChartCard>

        <ChartCard title="Nghẽn & Sắp nghẽn theo trạm  ·  bấm cột để xem chi tiết">
          <GroupBar data={nghenSapData} unit="phần in" onBarClick={() => setDrill('NGHEN')} series={[
            { key: 'nghen', label: 'Nghẽn (quá SLA)', color: '#ef4444' },
            { key: 'sap', label: 'Sắp nghẽn', color: '#f59e0b' },
          ]} />
        </ChartCard>

        <ChartCard title="Trễ hạn giao theo trạm đang kẹt  ·  bấm cột để xem đơn">
          <GroupBar data={treHanData} unit="phần in"
            onBarClick={(d) => setTreHan({ kind: 'qua', maTram: d?.ma_tram })} series={[
              { key: 'qua_han', label: 'Đã trễ hạn', color: '#e11d48' },
              { key: 'sap_han', label: 'Sắp đến hạn', color: '#f59e0b' },
            ]} />
        </ChartCard>

        <ChartCard title="Tải sản xuất — phần in đang ở từng khâu">
          <SingleBar data={wipData} unit="phần in" angle={0} />
        </ChartCard>

        <ChartCard title="Nhịp độ hôm nay theo trạm">
          <GroupBar data={confirmStationData} unit="phần in" series={[
            { key: 'hom_nay', label: 'Hoàn tất hôm nay', color: '#22c55e' },
            { key: 'chua_giao', label: 'Đã qua, chưa giao', color: '#0058be' },
          ]} />
        </ChartCard>

        <ChartCard title="Đang ở trạm vs Đã chuyển đi hôm nay">
          <GroupBar data={confirmStationData} unit="phần in" series={[
            { key: 'dang_o', label: 'Đang ở trạm', color: '#0058be' },
            { key: 'hom_nay', label: 'Đã chuyển đi hôm nay', color: '#22c55e' },
          ]} />
        </ChartCard>

        <ChartCard title="Hoạt động gần đây">
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {activity.length === 0 && <p className="text-sm text-ink-soft">Chưa có hoạt động.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${LOAI_CLS[a.loai] || 'bg-surface-muted text-ink-soft'}`}>{a.loai}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{a.mo_ta || '—'}</div>
                  <div className="text-xs text-ink-soft">{a.nguoi || '—'} · {fmtTime(a.tg)}</div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {drill && bang2 && <Bang2Panel kind={drill} data={bang2} hoanThanhDetail={htDetail} onClose={() => setDrill(null)} />}
      {stageDetail && <StageDetailPanel stage={stageDetail} bang2={bang2} hoanThanhDetail={htDetail} chartDetail={chartDetail} onClose={() => setStageDetail(null)} />}
      {treHan && dieuPhoi && <TreHanPanel data={dieuPhoi.tre_han} initKind={treHan.kind} initTram={treHan.maTram} onClose={() => setTreHan(null)} />}
      {cpDrill && <CheckpointDrillPanel drill={cpDrill} flow={flow} tramToBucket={tramToBucket} bucketOrder={bucketOrder} bucketOwners={bucketOwners} onClose={() => setCpDrill(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
