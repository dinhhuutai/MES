import { useEffect, useState, useCallback, useMemo } from 'react';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import DataTable from '../../../components/common/DataTable';
import DateRangePicker from '../../../components/common/DateRangePicker';
import KcsBreakdown from '../../../components/common/KcsBreakdown';
import { Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getLichSuNghen, getTinhTrangPhanIn } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';
import { fmtDur, slaRowClass, SLA_BADGE } from '../../../utils/sla';
import { ChartCard, KpiCard, Bar1, TrendComposed } from '../components/charts';

const pad = (n) => String(n).padStart(2, '0');
// Ngày VN dạng YYYY-MM-DD, cách N ngày so với hôm nay.
const vnDay = (offset = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const ddmm = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; };

// Trạm trong dòng chảy (khớp bảng tram) — cho ô lọc theo checkpoint.
const STATIONS = [
  ['READY', 'Chuẩn bị kỹ thuật'], ['RELEASE_1', 'Release 1'], ['TEST_RUN', 'Test Run'],
  ['RELEASE_2', 'Release 2'], ['SAN_XUAT', 'Sản xuất'], ['CHO_KHO', 'Chờ khô'],
  ['KIEM', 'KCS / Kiểm'], ['SUA', 'Sửa'], ['OQC', 'OQC'], ['FINISH', 'Hoàn tất'],
];

// Hành trình 1 phần in (đợt vải → trạm → timeline) — mở khi bấm 1 lượt nghẽn.
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
  return (
    <div className="space-y-4">
      <div className="rounded-control border border-line p-3 text-sm">
        <div className="font-semibold text-ink">{d.phan_in.ma_phan} · {d.phan_in.ten_khach_hang}</div>
        <div className="text-xs text-ink-soft">{d.phan_in.ma_don_hang} · {d.phan_in.ma_hang} · {[d.phan_in.mau_vai, d.phan_in.kich_vai, d.phan_in.kich_phim].filter(Boolean).join(' · ')}</div>
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

// Nút phân đoạn (segmented) cho ô lọc cấp.
function Seg({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${value === o.v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LichSuNghenPage() {
  const { toast, show } = useToast();
  const [range, setRange] = useState({ from: vnDay(-6), to: vnDay(0) });
  const [level, setLevel] = useState('all'); // all | TRAM | CHECKLIST
  const [tram, setTram] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState(null); // { level, ma } lọc bảng theo cột biểu đồ bấm vào
  const [journeyId, setJourneyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getLichSuNghen({ from: range.from, to: range.to, level, tram });
      setData(r.data);
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử nghẽn', 'error');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, level, tram, show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);

  const kpi = data?.kpi;
  const byTramChart = useMemo(() => (data?.by_tram || []).map((g) => ({ name: g.ten, value: g.tong_vuot_phut, _ma: g.ma })), [data]);
  const byCpChart = useMemo(() => (data?.by_checklist || []).map((g) => ({ name: g.ten, value: g.tong_vuot_phut, _ma: g.ma })), [data]);
  const dayChart = useMemo(() => (data?.by_day || []).map((d) => ({ name: ddmm(d.ngay), vuot_phut: d.tong_vuot_phut, so_vu: d.so_vu_nghen })), [data]);
  const gioChart = useMemo(() => (data?.by_gio || []).map((g) => ({ name: `${g.gio}h`, value: g.so_vu_nghen })), [data]);

  // Bảng lượt nghẽn: lọc theo focus (cột biểu đồ) + ô tìm kiếm.
  const episodes = useMemo(() => {
    let list = data?.episodes || [];
    if (focus) list = list.filter((e) => e.level === focus.level && e.ma === focus.ma);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => [e.ma_phan, e.ma_hang, e.ma_don_hang, e.ten_khach_hang, e.mau_vai, e.ten]
      .some((x) => (x || '').toLowerCase().includes(q)));
    return list.map((e, i) => ({ ...e, _k: i }));
  }, [data, focus, search]);

  const showTram = level !== 'CHECKLIST';
  const showCp = level !== 'TRAM';

  const cols = [
    { key: 'ten', header: 'Checkpoint / Checklist', render: (r) => (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge tone={r.level === 'TRAM' ? 'info' : 'default'}>{r.level === 'TRAM' ? 'Checkpoint' : 'Checklist'}</Badge>
          <span className="font-medium text-ink">{r.ten}</span>
        </div>
        {r.level === 'CHECKLIST' && <div className="text-xs text-ink-soft">{r.ten_tram}</div>}
      </div>
    ) },
    { key: 'phan_in', header: 'Phần in', render: (r) => (
      <div className="min-w-0">
        <div className="font-medium text-ink">{r.ma_phan}</div>
        <div className="text-xs text-ink-soft">{r.ten_khach_hang} · {r.ma_don_hang} · {r.ma_hang}</div>
      </div>
    ) },
    { key: 'mau', header: 'Màu · Kích', render: (r) => (
      <span className="text-xs text-ink-soft">{[r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</span>
    ) },
    { key: 'tg_vao', header: 'Vào lúc', render: (r) => <span className="whitespace-nowrap text-xs">{fmtTime(r.tg_vao)}</span> },
    { key: 'tg_ra', header: 'Ra lúc', render: (r) => <span className="whitespace-nowrap text-xs">{fmtTime(r.tg_ra)}</span> },
    { key: 'dwell_phut', header: 'Thời gian dừng', className: 'text-right tabular-nums', render: (r) => fmtDur(r.dwell_phut) },
    { key: 'sla_phut', header: 'SLA', className: 'text-right tabular-nums text-ink-soft', render: (r) => fmtDur(r.sla_phut) },
    { key: 'vuot_phut', header: 'Vượt SLA', className: 'text-right tabular-nums', render: (r) => (
      <b className={r.vuot_phut > 0 ? 'text-danger' : 'text-ink-soft'}>{r.vuot_phut > 0 ? fmtDur(r.vuot_phut) : '—'}</b>
    ) },
    { key: 'sla_status', header: 'Trạng thái', render: (r) => <Badge tone={SLA_BADGE[r.sla_status].tone}>{SLA_BADGE[r.sla_status].label}</Badge> },
    { key: 'owner', header: 'Chịu trách nhiệm', render: (r) => <span className="text-xs text-ink-soft">{r.owner_trach_nhiem || '—'}</span> },
  ];

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Lịch sử nghẽn</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Tổng thời gian vượt SLA của từng Checkpoint (trạm) &amp; Checklist (bước con) — đo hiệu quả, tìm điểm nghẽn.</p>
        </div>
        <Badge tone="success">Realtime</Badge>
      </div>

      {/* ===== Thanh lọc ===== */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={(v) => setRange({ from: v.from || vnDay(-6), to: v.to || vnDay(0) })} />
        <Seg value={level} onChange={(v) => { setLevel(v); setFocus(null); }} options={[
          { v: 'all', label: 'Cả hai' }, { v: 'TRAM', label: 'Checkpoint' }, { v: 'CHECKLIST', label: 'Checklist' },
        ]} />
        <Select value={tram} onChange={(e) => { setTram(e.target.value); setFocus(null); }} className="!h-10 w-48">
          <option value="">Tất cả trạm</option>
          {STATIONS.map(([ma, ten]) => <option key={ma} value={ma}>{ten}</option>)}
        </Select>
      </div>

      {loading && !data ? (
        <div className="card p-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <>
          {/* ===== KPI ===== */}
          <div className="mb-5 flex flex-wrap gap-2.5">
            <KpiCard tone="rose" icon="⏱" label="Tổng thời gian vượt SLA" value={fmtDur(kpi?.tong_vuot_phut || 0)}
              sub={`Trong khoảng ${ddmm(range.from)} – ${ddmm(range.to)}`} />
            <KpiCard tone="amber" icon="⚠" label="Số vụ nghẽn" value={fmtNum(kpi?.so_vu_nghen || 0)}
              sub={`trên ${fmtNum(kpi?.so_vu_tong || 0)} lượt`} />
            <KpiCard tone="emerald" icon="✅" label="Tuân thủ SLA" value={`${kpi?.ty_le_tuan_thu ?? 100}%`}
              sub="lượt không vượt SLA" />
            <KpiCard tone="violet" icon="⏳" label="Vụ nghẽn dài nhất" value={fmtDur(kpi?.vu_dai_nhat?.phut || 0)}
              sub={kpi?.vu_dai_nhat ? `${kpi.vu_dai_nhat.ten} · ${kpi.vu_dai_nhat.ma_phan || ''}` : '—'} />
            <KpiCard tone="slate" icon="🏭" label="Nghẽn nhất" value={kpi?.nghen_nhat?.ten || '—'}
              sub={kpi?.nghen_nhat ? `Tổng vượt ${fmtDur(kpi.nghen_nhat.tong_vuot_phut)}` : ''} />
          </div>

          {focus && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <Badge tone="info">Lọc: {focus.ten}</Badge>
              <button type="button" className="text-primary hover:underline" onClick={() => setFocus(null)}>Bỏ lọc</button>
            </div>
          )}

          {/* ===== Biểu đồ ===== */}
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {showTram && (
              <ChartCard title="Thời gian vượt SLA theo checkpoint (trạm)">
                {byTramChart.length ? (
                  <Bar1 data={byTramChart} color="#ef4444" fmt={fmtDur}
                    onBarClick={(d) => setFocus({ level: 'TRAM', ma: d._ma, ten: d.name })} />
                ) : <div className="py-10 text-center text-ink-soft">Không có dữ liệu</div>}
              </ChartCard>
            )}
            {showCp && (
              <ChartCard title="Thời gian vượt SLA theo checklist (bước con)">
                {byCpChart.length ? (
                  <Bar1 data={byCpChart} color="#f59e0b" fmt={fmtDur}
                    onBarClick={(d) => setFocus({ level: 'CHECKLIST', ma: d._ma, ten: d.name })} />
                ) : <div className="py-10 text-center text-ink-soft">Không có dữ liệu</div>}
              </ChartCard>
            )}
            <ChartCard title="Xu hướng nghẽn theo ngày">
              {dayChart.length ? <TrendComposed data={dayChart} /> : <div className="py-10 text-center text-ink-soft">Không có dữ liệu</div>}
            </ChartCard>
            <ChartCard title="Nghẽn theo giờ trong ngày (số vụ)">
              <Bar1 data={gioChart} color="#6366f1" fmt={fmtNum} angle={0} />
            </ChartCard>
          </div>

          {/* ===== Bảng lượt nghẽn ===== */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Lịch sử từng lượt nghẽn ({fmtNum(episodes.length)})</h3>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm code phần, khách, đơn, mã, màu..."
              className="h-10 w-full max-w-xs rounded-control border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </div>
          <DataTable columns={cols} rows={episodes} loading={loading} rowKey="_k"
            emptyText="Không có lượt nghẽn nào trong khoảng đã chọn"
            rowClassName={(r) => slaRowClass(r.sla_status)}
            onRowClick={(r) => setJourneyId(r.phan_in_id)} />
        </>
      )}

      <SidePanel open={!!journeyId} onClose={() => setJourneyId(null)} title="Hành trình phần in" side="right">
        {journeyId && <PhanInJourney id={journeyId} />}
      </SidePanel>
      <Toast toast={toast} />
    </div>
  );
}
