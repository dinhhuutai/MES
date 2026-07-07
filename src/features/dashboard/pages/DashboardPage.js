import { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getActivity, getStageCounts, getBang2, getTinhTrangPhanIn, getHoanThanhHomNay } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';
import { fmtDur } from '../../../utils/sla';

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
  { label: 'Release 2', sub: ['RELEASE_2', 'CHO_SAN_XUAT'], trams: ['RELEASE_2'] },
  { label: 'Sản xuất', sub: ['SAN_XUAT', 'CHO_KHO'], trams: ['SAN_XUAT', 'CHO_KHO'], pcs: true },
  { label: 'OQC', sub: ['KCS', 'SUA', 'OQC'], trams: ['KIEM', 'SUA', 'OQC'], hn: ['KCS', 'Sửa', 'OQC'] },
  { label: 'Giao', sub: ['DANG_GIAO', 'DA_GIAO'], trams: ['FINISH'], hn: ['Giao'] },
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
  { key: 'DANG_GIAO', label: 'Đang giao', trams: ['FINISH'] },
  { key: 'DA_GIAO', label: 'Đã giao xong', hn: ['Giao'] },
];

const CHART_BUCKETS = [
  { label: 'READY', keys: ['READY_KT', 'READY_QA'], color: '#0058be' },
  { label: 'RELEASE 1', keys: ['RELEASE_1'], color: '#6366f1' },
  { label: 'TEST RUN', keys: ['TESTRUN_CNSP', 'TESTRUN_QA'], color: '#8b5cf6' },
  { label: 'RELEASE 2', keys: ['RELEASE_2'], color: '#0ea5e9' },
  { label: 'SẢN XUẤT', keys: ['CHO_SAN_XUAT', 'SAN_XUAT', 'CHO_KHO'], color: '#f59e0b' },
  { label: 'OQC', keys: ['KCS', 'SUA', 'OQC'], color: '#a855f7' },
  { label: 'GIAO', keys: ['DANG_GIAO', 'DA_GIAO'], color: '#22c55e' },
];

function CellBadges({ nghen, sap, homNay }) {
  if (!nghen && !sap && !homNay) return null;
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-1">
      {homNay > 0 && <span className="rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">✓{fmtNum(homNay)}</span>}
      {sap > 0 && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">⏳{fmtNum(sap)}</span>}
      {nghen > 0 && <span className="rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">⚠{fmtNum(nghen)}</span>}
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
  return (
    <div className="space-y-4">
      <div className="rounded-control border border-line p-3 text-sm">
        <div className="font-semibold text-ink">{d.phan_in.ma_phan} · {d.phan_in.ten_khach_hang}</div>
        <div className="text-xs text-ink-soft">{d.phan_in.ma_don_hang} · {d.phan_in.ma_hang} · {[d.phan_in.mau_vai, d.phan_in.kich_vai, d.phan_in.kich_phim].filter(Boolean).join(' · ')}</div>
        {ts.pcs_in > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="default">{fmtNum(ts.pcs_in)} pcs · {fmtNum(ts.so_tem)} tem</Badge>
            {ts.sl_dat > 0 && <Badge tone="success">Đạt {fmtNum(ts.sl_dat)}</Badge>}
            {ts.sl_sua > 0 && <Badge tone="warning">Sửa {fmtNum(ts.sl_sua)}</Badge>}
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
function StageDetailPanel({ stage, bang2, hoanThanhDetail, onClose }) {
  const [phanIn, setPhanIn] = useState(null);
  const collect = (groups) => (groups || []).filter((g) => stage.trams?.includes(g.ma_tram)).flatMap((g) => g.phan_ins || []);
  const nghen = collect(bang2?.nhom_nghen);
  const sap = collect(bang2?.nhom_sap);
  const homNay = (hoanThanhDetail || []).filter((r) => stage.hn?.includes(r.nhom));
  const empty = nghen.length === 0 && sap.length === 0 && homNay.length === 0;

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
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600">Đã xác nhận hôm nay ({homNay.length})</div>
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
          {empty && <p className="text-sm text-ink-soft">Giai đoạn này chưa có phần in nghẽn/sắp nghẽn hay xác nhận hôm nay.</p>}
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

export default function DashboardPage() {
  const { toast, show } = useToast();
  const [stages, setStages] = useState(null);
  const [activity, setActivity] = useState([]);
  const [bang2, setBang2] = useState(null);
  const [htDetail, setHtDetail] = useState([]);
  const [drill, setDrill] = useState(null);       // chip toàn cục
  const [stageDetail, setStageDetail] = useState(null); // ô giai đoạn
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sc, act, b2, ht] = await Promise.allSettled([getStageCounts(), getActivity(), getBang2(), getHoanThanhHomNay()]);
    if (sc.status === 'fulfilled') setStages(sc.value.data);
    else show(sc.reason?.message || 'Lỗi tải giai đoạn', 'error');
    if (act.status === 'fulfilled') setActivity(act.value.data);
    if (b2.status === 'fulfilled') setBang2(b2.value.data);
    if (ht.status === 'fulfilled') setHtDetail(ht.value.data);
    setLoading(false);
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);

  const nghenByTram = useMemo(() => Object.fromEntries((bang2?.nhom_nghen || []).map((g) => [g.ma_tram, g.count])), [bang2]);
  const sapByTram = useMemo(() => Object.fromEntries((bang2?.nhom_sap || []).map((g) => [g.ma_tram, g.count])), [bang2]);
  const homNayByNhom = useMemo(() => Object.fromEntries((bang2?.nhom_hoan_thanh || []).map((g) => [g.nhom, g.n])), [bang2]);

  const chartData = useMemo(() => CHART_BUCKETS.map((c) => ({
    name: c.label, color: c.color,
    value: c.keys.reduce((a, k) => a + (stages?.stages?.[k]?.phan_in || 0), 0),
  })), [stages]);

  if (loading) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;

  const sumBy = (arr, map) => (arr || []).reduce((a, k) => a + (map[k] || 0), 0);
  const cellMetrics = (c) => ({ nghen: sumBy(c.trams, nghenByTram), sap: sumBy(c.trams, sapByTram), homNay: sumBy(c.hn, homNayByNhom) });
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

      {/* Tầng 1 — tổng quan giai đoạn */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Tổng quan giai đoạn</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setDrill('hoan_thanh')} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:brightness-95 dark:bg-emerald-950/40 dark:text-emerald-300">✓ Hôm nay {fmtNum(bang2?.hoan_thanh_hom_nay || 0)}</button>
          <button type="button" onClick={() => setDrill('SAP_NGHEN')} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:brightness-95 dark:bg-amber-950/40 dark:text-amber-300">⏳ Sắp nghẽn {fmtNum(bang2?.sap_nghen || 0)}</button>
          <button type="button" onClick={() => setDrill('NGHEN')} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:brightness-95 dark:bg-rose-950/40 dark:text-rose-300">⚠ Nghẽn {fmtNum(bang2?.nghen || 0)}</button>
        </div>
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

      {/* Trái: biểu đồ phần in theo checkpoint · Phải: hoạt động gần đây */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Phần in theo checkpoint hiện tại</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip formatter={(v) => [`${fmtNum(v)} phần in`, '']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Hoạt động gần đây</h3>
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
        </div>
      </div>

      {drill && bang2 && <Bang2Panel kind={drill} data={bang2} hoanThanhDetail={htDetail} onClose={() => setDrill(null)} />}
      {stageDetail && <StageDetailPanel stage={stageDetail} bang2={bang2} hoanThanhDetail={htDetail} onClose={() => setStageDetail(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
