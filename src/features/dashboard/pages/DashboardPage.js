import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, Legend } from 'recharts';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import KcsBreakdown from '../../../components/common/KcsBreakdown';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getActivity, getStageCounts, getBang2, getTinhTrangPhanIn, getHoanThanhHomNay, getChartDetail, getDieuPhoi } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';
import { fmtDur } from '../../../utils/sla';

// Trạm cho các biểu đồ theo trạm (nghẽn / tổng chưa giao / gộp). keys = stage của stageCounts; trams = ma_tram (bản đồ nghẽn).
const STATION_BUCKETS = [
  { label: 'READY', keys: ['READY_KT', 'READY_QA'], trams: ['READY'], color: '#0058be' },
  { label: 'Release 1', keys: ['RELEASE_1'], trams: [], color: '#6366f1' },
  { label: 'Test Run', keys: ['TESTRUN_CNSP', 'TESTRUN_QA'], trams: ['TEST_RUN'], color: '#8b5cf6' },
  { label: 'Release 2', keys: ['RELEASE_2'], trams: [], color: '#0ea5e9' },
  { label: 'Sản xuất', keys: ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO', 'KCS', 'SUA'], trams: ['SAN_XUAT', 'CHO_KHO', 'KIEM', 'SUA'], color: '#f59e0b' },
  { label: 'OQC', keys: ['OQC'], trams: ['OQC'], color: '#a855f7' },
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

// Biểu đồ cột nhiều chuỗi (mỗi nhóm N cột). series: [{key,label,color}]. onBarClick(datum) để drill.
function GroupBar({ data, series, height = 320, unit = '', onBarClick }) {
  const click = onBarClick ? (d) => onBarClick(d?.payload || d) : undefined;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={62} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} />
        <Tooltip formatter={(v, n) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]}
            onClick={click} cursor={onBarClick ? 'pointer' : undefined}>
            <LabelList dataKey={s.key} position="top" style={NUM_LABEL} formatter={fmtNum} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

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
  { label: 'OQC', sub: ['OQC'], trams: ['OQC'], pcs: true, hn: ['OQC'] },
  { label: 'Giao', sub: ['DANG_GIAO', 'DA_GIAO'], trams: ['FINISH'], pcs: true, hn: ['Giao'] },
];

const STAGE_CELLS = [
  { key: 'READY_KT', label: 'READY Kỹ thuật', trams: ['READY'], hn: ['Khuôn', 'Film', 'Mực'] },
  { key: 'READY_QA', label: 'READY QA', hn: ['QC xác nhận'] },
  { key: 'RELEASE_1', label: 'Release 1', trams: ['RELEASE_1'] },
  { key: 'TESTRUN_CNSP', label: 'Test Run CNSP', trams: ['TEST_RUN'], hn: ['CNSP xác nhận test'] },
  { key: 'TESTRUN_QA', label: 'Test Run QA', hn: ['QA xác nhận test'] },
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
              <div className="space-y-1.5">
                {homNay.map((r, i) => {
                  const clickable = !!r.phan_in_id;
                  const inner = (
                    <>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{r.doi_tuong}{r.mau_vai ? ` · ${r.mau_vai}` : ''}</div>
                        <div className="truncate text-xs text-ink-soft">{r.nhom}{r.ma_hang ? ` · ${r.ma_hang}` : ''} · {r.nguoi || '—'}</div>
                      </div>
                      <div className="shrink-0 text-xs text-ink-soft tabular-nums">{fmtTime(r.tg)}</div>
                    </>
                  );
                  return clickable ? (
                    <button key={i} type="button" onClick={() => setPhanIn({ id: r.phan_in_id, ma_phan: r.ma_phan })}
                      className="flex w-full items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-left hover:shadow-card">{inner}</button>
                  ) : (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">{inner}</div>
                  );
                })}
              </div>
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
        : isHT && htGroup ? (
          <div className="space-y-1.5">
            {htItems.map((r, i) => {
              const clickable = !!r.phan_in_id;
              const inner = (
                <>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.doi_tuong}{r.mau_vai ? ` · ${r.mau_vai}` : ''}</div>
                    <div className="truncate text-xs text-ink-soft">{r.ma_hang ? `${r.ma_hang} · ` : ''}{r.nguoi || '—'}</div>
                  </div>
                  <div className="shrink-0 text-xs text-ink-soft tabular-nums">{fmtTime(r.tg)}</div>
                </>
              );
              return clickable ? (
                <button key={i} type="button" onClick={() => setPhanIn({ id: r.phan_in_id, ma_phan: r.ma_phan })}
                  className="flex w-full items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-left hover:shadow-card">{inner}</button>
              ) : (
                <div key={i} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">{inner}</div>
              );
            })}
          </div>
        )
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

export default function DashboardPage() {
  const { toast, show } = useToast();
  const [stages, setStages] = useState(null);
  const [activity, setActivity] = useState([]);
  const [bang2, setBang2] = useState(null);
  const [htDetail, setHtDetail] = useState([]);
  const [chartDetail, setChartDetail] = useState(null); // OQC + READY breakdown
  const [dieuPhoi, setDieuPhoi] = useState(null); // trễ hạn + chờ duyệt + chuyền
  const [drill, setDrill] = useState(null);       // chip toàn cục
  const [treHan, setTreHan] = useState(null);     // panel trễ hạn giao
  const [stageDetail, setStageDetail] = useState(null); // ô giai đoạn
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sc, act, b2, ht, cd, dp] = await Promise.allSettled([
      getStageCounts(), getActivity(), getBang2(), getHoanThanhHomNay(), getChartDetail(), getDieuPhoi(),
    ]);
    if (sc.status === 'fulfilled') setStages(sc.value.data);
    else show(sc.reason?.message || 'Lỗi tải giai đoạn', 'error');
    if (act.status === 'fulfilled') setActivity(act.value.data);
    if (b2.status === 'fulfilled') setBang2(b2.value.data);
    if (ht.status === 'fulfilled') setHtDetail(ht.value.data);
    if (cd.status === 'fulfilled') setChartDetail(cd.value.data);
    if (dp.status === 'fulfilled') setDieuPhoi(dp.value.data);
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
      { label: 'OQC', key: 'oqc', hn: ['OQC'], keys: ['OQC'] },
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
          const st = stages?.stages?.[c.key] || { phan_in: 0, ma: 0, pcs: 0 };
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

      {/* ===== BẢNG ĐIỀU PHỐI — 4 biểu đồ hành động (2/hàng); Hoạt động gần đây cuối cùng ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
      <Toast toast={toast} />
    </div>
  );
}
