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

  // Mỗi tem chọn = { row, qty } — qty = SL giao lần này (mặc định = còn giao). Giao TỪNG PHẦN nhiều lần.
  const toggle = (row) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[row.tem_id]) delete n[row.tem_id]; else n[row.tem_id] = { row, qty: Number(row.con_giao) || 0 };
      return n;
    });
  const setQty = (temId, v) => setSelected((s) => (s[temId] ? { ...s, [temId]: { ...s[temId], qty: v } } : s));

  const doCreate = async () => {
    setCreating(true);
    try {
      const items = selectedList.map((x) => ({ temId: x.row.tem_id, soLuong: Number(x.qty) || null }));
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
      <input type="checkbox" checked={!!selected[r.tem_id]} onChange={() => toggle(r)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.khach_list || '—'}</div>
        <div className="text-[10px] text-ink-soft">{r.don_list || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-[10px] text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_giao', header: 'Còn giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_giao) },
    { key: 'giao_qty', header: 'SL giao lần này', className: 'w-32', render: (r) => (
      selected[r.tem_id] ? (
        <Input type="number" min="1" max={r.con_giao} value={selected[r.tem_id].qty}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setQty(r.tem_id, e.target.value)} className="py-1 text-right" />
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
        <div className="text-[10px] text-ink-soft">{r.ma_don_hang || '—'}</div>
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
        {[['tao', `Tạo phiếu (${tems.length})`], ['lichsu', `Lịch sử (${history.length})`]].map(([k, label]) => (
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
          <DataTable columns={temCols} rows={tems} loading={loading} rowKey="tem_id" sttStart={0}
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
