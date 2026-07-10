import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import QrScanner from '../../../components/common/QrScanner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import usePermissions from '../../../hooks/usePermissions';
import { listSuaCandidates, recordSua, suaHistory, suaDone } from '../../../services/qualityService';
import { getTemLabel } from '../../../services/productionService';
import { printOqcTem } from '../../production/utils/printTemLabel';
import { fmtNum, baseMaTem } from '../../../utils/format';

const empty = { soLuongHuyThang: '', soLuongSua: '', soLuongSuaDat: '', soLuongSuaHuy: '' };

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])) };
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canSua = can('SUA');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [range, setRange] = useState(() => ({ from: todayStr(), to: todayStr() }));
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSuaCandidates({ search, ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtersKey, rangeKey, show]);

  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});

  const openRow = (row) => { setEditing(row); setForm({ ...empty, soLuongSuaDat: String(row.con_sua || '') }); };

  // In tem OQC (Sửa đã hoàn thành) = tem 17, bố cục y hệt tem 15. SL IN = số lượng sửa đạt (→ OQC).
  const printOqc = async (row) => {
    try {
      const res = await getTemLabel(row.tem_id);
      await printOqcTem({ ...res.data, so_luong: row.so_luong });
    } catch (e) { show(e.message || 'Không in được tem', 'error'); }
  };

  const doneColumns = [
    { key: 'ma', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone="info">{r.ma || '—'}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'so_luong', header: 'Sửa đạt', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '') },
    { key: 'in_tem', header: '', className: 'text-right', render: (r) => (
      r.tem_id ? <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => printOqc(r)}>In tem</Button> : null
    ) },
  ];

  // Quét QR (ma_tem) → tra tem đang chờ sửa → mở modal nhập.
  const onScan = async (maTem) => {
    setScanOpen(false);
    const code = baseMaTem(maTem); // QR có thể mã hóa '16-TEM...'; tách lấy mã gốc
    if (!code) return;
    try {
      const res = await listSuaCandidates({ search: code });
      const row = (res.data || []).find((r) => (r.ma_tem || '').toLowerCase() === code.toLowerCase());
      if (row) openRow(row);
      else show(`Tem ${code} không có phần chờ sửa`, 'error');
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordSua(editing.tem_id, form);
      const conLai = Number(r.data.con_sua) || 0;
      show(`Sửa ${editing.ma_tem}: đạt ${fmtNum(r.data.so_luong_sua_dat)} → OQC`
        + (conLai > 0 ? ` · còn ${fmtNum(conLai)} chờ sửa` : ' · đã sửa hết'));
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-[10px] text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-[10px] text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'ca', header: 'Ca SX', render: (r) => (r.ca ? <Badge tone="default">{r.ca}</Badge> : '—') },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'con_sua', header: 'SL cần sửa', className: 'text-right tabular-nums font-semibold',
      render: (r) => <span className="text-amber-600">{fmtNum(r.con_sua)}</span> },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canSua && <Button className="px-3 py-1.5" onClick={() => openRow(r)}>Sửa</Button> },
  ];

  const N = (f, label) => (
    <Field label={label}>
      <Input type="number" min="0" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
    </Field>
  );

  return (
    <div>
      <Toolbar title="Sửa hàng lỗi" subtitle="Xử lý tem lỗi từ KCS / OQC"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        {canSua && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ sửa</Badge>
      </Toolbar>

      {showFilters && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters}
              disabled={!activeFilters.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              <button onClick={() => setField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa">
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
        </div>
      )}

      <OwnerHint tram="SUA" className="mb-3" />

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ sửa" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận sửa</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · <b className="text-amber-600">SL cần sửa {fmtNum(editing?.con_sua)}</b> (kế thừa từ KCS)
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {N('soLuongSuaDat', 'Sửa đạt')}
          {N('soLuongSuaHuy', 'Sửa hủy')}
          {N('soLuongHuyThang', 'Hủy thẳng')}
        </div>
        <p className="text-xs text-ink-soft">Xử lý <b>từng phần</b> (sửa đạt + sửa hủy + hủy thẳng ≤ SL cần sửa). Sửa đạt → quay lại <b>OQC</b>; phần chưa xử lý giữ lại cho lần sau.</p>
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Sửa" fetcher={suaHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã sửa" maHeader="Tem" fetcher={suaDone} columns={doneColumns} />

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <Toast toast={toast} />
    </div>
  );
}
