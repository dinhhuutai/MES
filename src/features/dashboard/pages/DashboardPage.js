import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import OwnerHint from '../../../components/common/OwnerHint';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import useNow from '../../../hooks/useNow';
import { getSummary, getActivity, getStageCounts, getFlow, getSlaOverview, getFlowTimeline } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';
import { evalSla, SLA_BADGE, fmtDur } from '../../../utils/sla';

const TEM_STAGES = [
  { key: 'IN', label: 'Chờ phơi', color: '#f59e0b' },
  { key: 'DANG_PHOI', label: 'Đang phơi', color: '#0058be' },
  { key: 'DA_KHO', label: 'Đã khô', color: '#0ea5e9' },
  { key: 'CHO_SUA', label: 'Chờ sửa', color: '#f43f5e' },
  { key: 'CHO_OQC', label: 'Chờ OQC', color: '#8b5cf6' },
  { key: 'OQC_DAT', label: 'OQC đạt', color: '#22c55e' },
  { key: 'DA_GIAO', label: 'Đã giao', color: '#16a34a' },
  { key: 'LOAI', label: 'Loại', color: '#9ca3af' },
];

function StatCard({ icon, label, value, sub, tone = 'text-primary bg-primary-wash' }) {
  return (
    <div className="card p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-control ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-sm text-ink-soft">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

// Tổng quan mặc định — để trang KHÔNG kẹt "Đang tải" nếu 1 API lỗi/chậm (hiển thị phần còn lại).
const EMPTY_SUMMARY = {
  don_hang: { total: 0, by_trang_thai: {} },
  phan_in: { total: 0, ready: 0 },
  lenh: {}, tem: {},
  xe_phoi: { dang_phoi: 0 },
  giao_hang: { by_trang_thai: {}, tong_sl_da_giao: 0 },
  chat_luong: { so_kcs: 0, oqc_dat: 0, oqc_khong_dat: 0 },
  nghen: { dang_nghen: 0 },
};

function FlowTimelinePanel({ dotVaiId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getFlowTimeline(dotVaiId).then((r) => { if (alive) { setData(r.data); setLoading(false); } }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, [dotVaiId]);
  return (
    <SidePanel open onClose={onClose} title="Dòng chảy đợt vải" subtitle={data?.current ? `Hiện ở: ${data.current.ten_tram}` : ''} width="max-w-lg">
      {loading ? <div className="py-10 text-center text-ink-soft">Đang tải...</div> : (
        <div className="space-y-4">
          {data?.current && (
            <div className="rounded-control border border-primary/30 bg-primary-wash p-3">
              <div className="text-xs text-ink-soft">Checkpoint hiện tại</div>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-ink">{data.current.ten_tram}</div>
                {data.current.sla_status && <Badge tone={SLA_BADGE[data.current.sla_status]?.tone}>{SLA_BADGE[data.current.sla_status]?.label}</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-ink-soft">Đã ở {fmtDur(data.current.phut_da_o)} · vào lúc {fmtTime(data.current.tg_vao)}</div>
              <OwnerHint tram={data.current.ma_tram} className="mt-1.5" />
            </div>
          )}
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Lịch sử luân chuyển</div>
            {(!data?.timeline || data.timeline.length === 0) && <p className="text-sm text-ink-soft">Chưa có lịch sử luân chuyển.</p>}
            <ol className="relative space-y-3 border-l border-line pl-4">
              {data?.timeline?.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm text-ink">
                    {t.tu_ten ? <span className="text-ink-soft">{t.tu_ten} → </span> : ''}<b>{t.den_ten}</b>
                  </div>
                  <div className="text-xs text-ink-soft">{fmtTime(t.tg_kt)}{t.phut != null ? ` · ở checkpoint trước ${fmtDur(t.phut)}` : ''}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </SidePanel>
  );
}

function FlowBoard({ show }) {
  const now = useNow(1000);
  const [rows, setRows] = useState([]);
  const [overview, setOverview] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const [f, o] = await Promise.all([getFlow({ filter }), getSlaOverview()]);
      setRows(f.data); setOverview(o.data);
    } catch (e) { show(e.message || 'Lỗi tải dòng chảy', 'error'); }
  }, [filter, show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);
  useSocketEvent('production:updated', load);
  useSocketEvent('workflow:updated', load);

  const filters = [
    ['all', 'Tất cả'],
    ['NGHEN', 'Đang nghẽn'],
    ['SAP_NGHEN', 'Sắp nghẽn'],
  ];

  return (
    <div className="mt-6">
      {/* Tổng quan BGĐ */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon="activity" label="Đợt vải đang chạy" value={fmtNum(overview?.tong?.dang_chay || 0)} />
        <StatCard icon="alert-triangle" label="Đang nghẽn" value={fmtNum(overview?.tong?.nghen || 0)}
          tone={(overview?.tong?.nghen || 0) > 0 ? 'text-rose-600 bg-rose-50' : 'text-ink-soft bg-surface-muted'} />
        <StatCard icon="clock" label="Sắp nghẽn" value={fmtNum(overview?.tong?.sap_nghen || 0)}
          tone={(overview?.tong?.sap_nghen || 0) > 0 ? 'text-amber-600 bg-amber-50' : 'text-ink-soft bg-surface-muted'} />
        <StatCard icon="git-branch" label="Checkpoint có việc" value={fmtNum(overview?.trams?.length || 0)} tone="text-primary bg-primary-wash" />
      </div>

      {/* Nghẽn theo checkpoint (BGĐ) */}
      {overview?.trams?.length > 0 && (
        <div className="mb-4 card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Nghẽn theo checkpoint</h3>
          <div className="flex flex-wrap gap-2">
            {overview.trams.map((t) => (
              <div key={t.ma_tram} className="rounded-control border border-line px-3 py-2 text-center">
                <div className="text-xs font-medium text-ink">{t.ten_tram}</div>
                <div className="mt-1 flex items-center justify-center gap-2 text-xs">
                  <span className="text-ink-soft">{t.tong} đợt</span>
                  {t.nghen > 0 && <span className="font-semibold text-danger">{t.nghen} nghẽn</span>}
                  {t.sap_nghen > 0 && <span className="font-semibold text-warning">{t.sap_nghen} sắp</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board dòng chảy */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Dòng chảy đợt vải theo checkpoint</h3>
          <div className="flex gap-1.5">
            {filters.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-control px-3 py-1.5 text-xs font-medium ${filter === k ? 'bg-primary text-white' : 'border border-line text-ink-soft hover:bg-surface-muted'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className="py-2 pr-3">Khách · Đơn</th>
                <th className="py-2 pr-3">Mã hàng · Code phần</th>
                <th className="py-2 pr-3">Màu · Kích</th>
                <th className="py-2 pr-3 text-right">SL pcs</th>
                <th className="py-2 pr-3">Checkpoint hiện tại</th>
                <th className="py-2 pr-3">Ở checkpoint</th>
                <th className="py-2 pr-3">SLA</th>
                <th className="py-2 pr-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-ink-soft">Không có đợt vải trong dòng chảy.</td></tr>
              )}
              {rows.map((r) => {
                const { phut, status } = evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now);
                const b = SLA_BADGE[status];
                return (
                  <tr key={r.id} onClick={() => setSelected(r.dot_vai_ve_id)}
                    className="cursor-pointer border-b border-line/60 hover:bg-surface-muted">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_don_hang || ''}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-ink">{r.ma_hang || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_phan || ''}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-ink-soft">{[r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.pcs ? `${fmtNum(r.pcs)}` : '—'}</td>
                    <td className="py-2 pr-3"><Badge tone="info">{r.ten_tram}</Badge></td>
                    <td className={`py-2 pr-3 tabular-nums ${status === 'NGHEN' ? 'font-semibold text-danger' : status === 'SAP_NGHEN' ? 'text-warning' : 'text-ink'}`}>
                      {fmtDur(phut)}{r.sla_phut ? <span className="text-ink-soft"> / {fmtDur(r.sla_phut)}</span> : ''}
                    </td>
                    <td className="py-2 pr-3"><Badge tone={b.tone}>{b.label}</Badge></td>
                    <td className="py-2 pr-3 text-xs text-ink-soft">
                      {r.owner_xu_ly && <div>Xử lý: {r.owner_xu_ly}</div>}
                      {r.owner_trach_nhiem && <div>TN: {r.owner_trach_nhiem}</div>}
                      {!r.owner_xu_ly && !r.owner_trach_nhiem && '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <FlowTimelinePanel dotVaiId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// TẦNG 1 — tổng quan giai đoạn lớn. Mỗi ô gộp nhiều giai đoạn chi tiết (sub).
const TIER1_CELLS = [
  { key: 'so_don', label: 'Đơn hàng', type: 'total' },
  { key: 'so_ma', label: 'Mã hàng', type: 'total' },
  { key: 'so_phan_in', label: 'Phần in', type: 'total' },
  { label: 'READY', sub: ['READY_KT', 'READY_QA'] },
  { label: 'Release 1', sub: ['RELEASE_1'] },
  { label: 'Test Run', sub: ['TESTRUN_CNSP', 'TESTRUN_QA'] },
  { label: 'Release 2', sub: ['RELEASE_2', 'CHO_SAN_XUAT'] },
  { label: 'Sản xuất', sub: ['SAN_XUAT', 'CHO_KHO'], pcs: true },
  { label: 'OQC', sub: ['KCS', 'SUA', 'OQC'] },
  { label: 'Giao', sub: ['DANG_GIAO', 'DA_GIAO'] },
];

// TẦNG 2 — chi tiết theo từng giai đoạn (từ READY Kỹ thuật đến Đã giao xong).
const STAGE_CELLS = [
  { key: 'READY_KT', label: 'READY Kỹ thuật' },
  { key: 'READY_QA', label: 'READY QA' },
  { key: 'RELEASE_1', label: 'Release 1' },
  { key: 'TESTRUN_CNSP', label: 'Test Run CNSP' },
  { key: 'TESTRUN_QA', label: 'Test Run QA' },
  { key: 'RELEASE_2', label: 'Release 2' },
  { key: 'CHO_SAN_XUAT', label: 'Chờ sản xuất' },
  { key: 'SAN_XUAT', label: 'Đang sản xuất' },
  { key: 'CHO_KHO', label: 'Chờ khô' },
  { key: 'KCS', label: 'KCS' },
  { key: 'SUA', label: 'Sửa' },
  { key: 'OQC', label: 'OQC' },
  { key: 'DANG_GIAO', label: 'Đang giao' },
  { key: 'DA_GIAO', label: 'Đã giao xong' },
];

function Tier1Grid({ data }) {
  if (!data) return null;
  const sum = (subs, field) => subs.reduce((a, k) => a + (data.stages?.[k]?.[field] || 0), 0);
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {TIER1_CELLS.map((c) => {
        if (c.type === 'total') {
          return (
            <div key={c.key} className="card p-3 text-center">
              <div className="text-2xl font-bold text-ink tabular-nums">{fmtNum(data.totals?.[c.key] || 0)}</div>
              <div className="text-xs text-ink-soft">{c.label}</div>
            </div>
          );
        }
        return (
          <div key={c.label} className="card p-3 text-center">
            <div className="text-2xl font-bold text-primary tabular-nums">{fmtNum(sum(c.sub, 'phan_in'))}</div>
            <div className="text-xs font-medium text-ink">{c.label}</div>
            {c.pcs ? <div className="text-[11px] text-ink-soft">{fmtNum(sum(c.sub, 'pcs'))} pcs</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function StageGrid({ data }) {
  if (!data) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {STAGE_CELLS.map((c) => {
        const st = data.stages?.[c.key] || { phan_in: 0, ma: 0, pcs: 0 };
        return (
          <div key={c.key} className="card p-3 text-center">
            <div className="text-2xl font-bold text-primary tabular-nums">{fmtNum(st.phan_in)}</div>
            <div className="text-xs font-medium text-ink">{c.label}</div>
            <div className="text-[11px] text-ink-soft">{fmtNum(st.ma)} mã{st.pcs ? ` · ${fmtNum(st.pcs)} pcs` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { toast, show } = useToast();
  const [s, setS] = useState(EMPTY_SUMMARY);
  const [stages, setStages] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // allSettled: 1 API lỗi/chậm KHÔNG làm hỏng cả trang (trước đây kẹt "Đang tải" nếu summary lỗi).
    const [sum, act, sc] = await Promise.allSettled([getSummary(), getActivity(), getStageCounts()]);
    if (sum.status === 'fulfilled') setS(sum.value.data);
    else show(sum.reason?.message || 'Lỗi tải tổng quan', 'error');
    if (act.status === 'fulfilled') setActivity(act.value.data);
    if (sc.status === 'fulfilled') setStages(sc.value.data);
    setLoading(false);
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);

  if (loading) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;

  const tem = s.tem || {};
  const chartData = TEM_STAGES.map((st) => ({ name: st.label, value: tem[st.key] || 0, color: st.color }));
  const temTotal = Object.values(tem).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-soft">Theo dõi dòng chảy sản xuất theo thời gian thực</p>
        </div>
        <Badge tone="success"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Realtime</Badge>
      </div>

      {/* Tầng 1 — tổng quan giai đoạn lớn */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Tổng quan giai đoạn</div>
      <Tier1Grid data={stages} />

      {/* Tầng 2 — chi tiết từng giai đoạn */}
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Chi tiết theo giai đoạn</div>
      <StageGrid data={stages} />

      {/* Dòng chảy + SLA + nghẽn (theo dõi chủ động) */}
      <FlowBoard show={show} />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-ink">Tem theo trạng thái ({fmtNum(temTotal)} tem)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Hoạt động gần đây</h3>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-ink-soft">Chưa có hoạt động.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2.5">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <div className="text-sm text-ink">{a.ly_do || a.trang_thai_moi || 'Cập nhật'}</div>
                  <div className="text-xs text-ink-soft">{a.nguoi || '—'} · {fmtTime(a.tg_thuc_hien)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Pipeline lệnh sản xuất</h3>
        <div className="flex flex-wrap gap-3">
          {[['RELEASE_1', 'Release 1'], ['SAN_XUAT', 'Đang SX'], ['RELEASE_2', 'Release 2']].map(([k, label]) => (
            <div key={k} className="flex-1 rounded-control border border-line p-3 text-center">
              <div className="text-xl font-bold text-ink">{fmtNum(s.lenh[k] || 0)}</div>
              <div className="text-xs text-ink-soft">{label}</div>
            </div>
          ))}
          <div className="flex-1 rounded-control border border-line p-3 text-center">
            <div className="text-xl font-bold text-ink">{fmtNum(s.giao_hang.by_trang_thai?.DA_GIAO || 0)}</div>
            <div className="text-xs text-ink-soft">Phiếu đã giao</div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
