import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import {
  listTemSanSang, createGiaoHang, listGiaoHang,
} from '../../../services/deliveryService';
import { Input } from '../../../components/common/controls';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { fmtNum, fmtDate } from '../../../utils/format';
import GiaoHangPanel from '../components/GiaoHangPanel';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import Icon from '../../../components/common/Icon';
import { getTemHanhTrinh } from '../../../services/qualityService';

const FILTER_FIELDS = [
  { key: 'tem', label: 'Mã tem' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])), ngayTu: 'Từ ngày', ngayDen: 'Đến ngày' };

export default function GiaoHangPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canManage = can('DELIVERY_MANAGE');

  const [tab, setTab] = useState('tao');
  const [tems, setTems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [journey, setJourney] = useState(null); // { temId, maTem } — panel hành trình theo tem
  // Mặc định lọc KHOẢNG ngày in tem = hôm nay → hôm nay (giờ máy = giờ VN).
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);
  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined };
      const [t, h] = await Promise.all([listTemSanSang(params), listGiaoHang({})]);
      setTems(t.data);
      setHistory(h.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, filtersKey, show]);

  useEffect(() => { load(); }, [load]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  // TÁCH mỗi tem theo NGUỒN: KCS (15-) + Sửa (17-) — như màn OQC, KHÔNG gộp 1 dòng.
  // _key = tem_id + nguồn; con_src = SL còn giao của đúng nguồn đó.
  const displayRows = useMemo(() => {
    const out = [];
    (tems || []).forEach((r) => {
      const kcs = Number(r.con_giao_kcs);
      const sua = Number(r.con_giao_sua);
      if (r.con_giao_kcs == null && r.con_giao_sua == null) { // backend cũ chưa tách → 1 dòng tổng
        out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: Number(r.con_giao) || 0, ma_tem_display: r.ma_tem });
        return;
      }
      if (kcs > 0) out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: kcs, ma_tem_display: `15-${r.ma_tem}` });
      if (sua > 0) out.push({ ...r, _key: `${r.tem_id}-SUA`, nguon: 'SUA', con_src: sua, ma_tem_display: `17-${r.ma_tem}` });
    });
    return out;
  }, [tems]);

  // Mỗi dòng chọn = { row, qty } — qty = SL giao lần này (mặc định = còn giao nguồn đó). Giao TỪNG PHẦN nhiều lần.
  const toggle = (row) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[row._key]) delete n[row._key]; else n[row._key] = { row, qty: Number(row.con_src) || 0 };
      return n;
    });
  const setQty = (key, v) => setSelected((s) => (s[key] ? { ...s, [key]: { ...s[key], qty: v } } : s));

  const doCreate = async () => {
    setCreating(true);
    try {
      const items = selectedList.map((x) => ({ temId: x.row.tem_id, nguon: x.row.nguon, soLuong: Number(x.qty) || null }));
      const r = await createGiaoHang({ items });
      show(`Đã tạo phiếu giao ${r.data.ma_phieu_giao}`);
      setSelected({});
      setSel(r.data.id);
      setTab('lichsu');
      load();
    } catch (e) {
      show(e.message || 'Tạo phiếu thất bại', 'error');
    } finally {
      setCreating(false);
    }
  };

  const temCols = [
    { key: 'sel', header: '', className: 'w-10', selection: true, render: (r) => (
      <input type="checkbox" checked={!!selected[r._key]} onChange={() => toggle(r)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone={r.nguon === 'SUA' ? 'warning' : 'info'}>{r.ma_tem_display || r.ma_tem}</Badge> },
    { key: 'nguon', header: 'Nguồn', render: (r) => (r.nguon === 'SUA' ? 'Sửa (17-)' : 'KCS (15-)') },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.khach_list || '—'}</div>
        <div className="text-xs text-ink-soft">{r.don_list || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_src', header: 'Còn giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_src) },
    { key: 'giao_qty', header: 'SL giao lần này', className: 'w-32', render: (r) => (
      selected[r._key] ? (
        <Input type="number" min="1" max={r.con_src} value={selected[r._key].qty}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setQty(r._key, e.target.value)} className="py-1 text-right" />
      ) : <span className="text-ink-soft">—</span>
    ) },
    { key: 'ht', header: '', className: 'text-right', render: (r) => (
      <Button variant="ghost" className="px-3 py-1.5"
        onClick={(e) => { e.stopPropagation(); setJourney({ temId: r.tem_id, maTem: r.ma_tem }); }}>Hành trình</Button>
    ) },
  ];

  const histCols = [
    { key: 'ma_phieu_giao', header: 'Mã phiếu', render: (r) => <Badge tone="info">{r.ma_phieu_giao}</Badge> },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'so_tem', header: 'Số tem', className: 'text-right' },
    { key: 'tong_sl', header: 'Tổng SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_sl) },
    { key: 'ngay_giao', header: 'Ngày giao', render: (r) => fmtDate(r.ngay_giao) },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) =>
      r.trang_thai === 'DA_GIAO' ? <Badge tone="success">Đã giao</Badge> : <Badge tone="warning">Chờ giao</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Giao hàng" subtitle="Gom tem OQC đạt thành phiếu giao → DONE DELIVERY" />

      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1">
        {[['tao', `Tạo phiếu (${displayRows.length})`], ['lichsu', `Lịch sử (${history.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-surface text-primary shadow-card' : 'text-ink-soft'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'tao' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span>Ngày in tem</span>
              <div className="w-64"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
              {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
            </div>
            <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
              onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
          </div>

          {showFilters && (
            <div className="mb-3 card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
                <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters} disabled={!activeFilters.length}>Xóa lọc</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {FILTER_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                    <input value={filters[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={`Lọc ${f.label.toLowerCase()}...`}
                      className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeFilters.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {activeFilters.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary">
                  {FIELD_LABEL[k]}: {v}
                  <button onClick={() => setField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa"><Icon name="x" size={12} /></button>
                </span>
              ))}
              <button onClick={clearFilters} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
            </div>
          )}
          <DataTable columns={temCols} rows={displayRows} loading={loading} rowKey="_key" sttStart={0}
            rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
            emptyText="Không có tem OQC đạt nào chờ giao" />
          {selectedList.length > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
              <span className="text-sm text-ink">Đã chọn <b>{selectedList.length}</b> tem · Tổng giao <b>{fmtNum(selectedList.reduce((s, x) => s + (Number(x.qty) || 0), 0))}</b></span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSelected({})}>Bỏ chọn</Button>
                {canManage && <Button onClick={doCreate} loading={creating}>Tạo phiếu giao</Button>}
              </div>
            </div>
          )}
        </>
      ) : (
        <DataTable columns={histCols} rows={history} loading={loading} onRowClick={(r) => setSel(r.id)}
          emptyText="Chưa có phiếu giao nào" />
      )}

      {sel && <GiaoHangPanel giaoHangId={sel} onClose={() => setSel(null)} onChanged={load} />}
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
