import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listInlineCandidates, listInlineLoaiLoi, recordInline, inlineHistory, inlineDone,
} from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

export default function QcInlinePage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canQc = can('QC_INLINE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [loaiLoi, setLoaiLoi] = useState([]);

  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ soLuongMau: '', soLuongLoi: '', ketQua: 'DAT', nguyenNhan: '', khacPhuc: '' });
  const [loiSel, setLoiSel] = useState({}); // loaiLoiId -> soLuong (string), có mặt = đã chọn
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listInlineCandidates({ search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => { listInlineLoaiLoi().then((r) => setLoaiLoi(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = (row) => {
    setDetail(row);
    setForm({ soLuongMau: '', soLuongLoi: '', ketQua: 'DAT', nguyenNhan: '', khacPhuc: '' });
    setLoiSel({});
  };

  const toggleLoi = (id) => setLoiSel((s) => {
    const next = { ...s };
    if (id in next) delete next[id]; else next[id] = '';
    return next;
  });

  const hasLoi = Number(form.soLuongLoi) > 0 || Object.keys(loiSel).length > 0 || form.ketQua === 'KHONG_DAT';

  const submit = async () => {
    if (!(Number(form.soLuongMau) > 0)) { show('Nhập số lượng mẫu kiểm', 'error'); return; }
    setSaving(true);
    try {
      await recordInline(detail.phieu_id, {
        soLuongMau: Number(form.soLuongMau),
        soLuongLoi: Number(form.soLuongLoi) || 0,
        ketQua: form.ketQua,
        nguyenNhan: form.nguyenNhan || null,
        khacPhuc: form.khacPhuc || null,
        loi: Object.entries(loiSel).map(([loaiLoiId, soLuong]) => ({ loaiLoiId, soLuong: Number(soLuong) || null })),
      });
      show(`Đã ghi nhận QC in-line ${detail.ma_phan || detail.ma_phieu_san_xuat}`);
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Ghi nhận thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_chuyen', header: 'Chuyền', render: (r) => <Badge tone="info">{r.ma_chuyen || '—'}</Badge> },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
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
    { key: 'progress', header: 'Tiến độ', className: 'text-right tabular-nums', render: (r) => `${fmtNum(r.printed)} / ${fmtNum(r.target)}` },
    { key: 'so_lan_kiem', header: 'Lần kiểm', className: 'text-right', render: (r) => r.so_lan_kiem },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canQc && <Button className="px-2.5 py-1 text-xs" onClick={() => open(r)}>Kiểm</Button> },
  ];

  return (
    <div>
      <Toolbar title="QC in line" subtitle="Kiểm chất lượng tại chuyền — phần in đang sản xuất"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, mã lệnh/phiếu...">
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{filtered.length} đang chạy</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} rowKey="phieu_id" onRowClick={canQc ? open : undefined}
        rowClassName={(r) => slaRowClass(statusLenh(r.lenh_id))}
        emptyText="Không có phần in nào đang sản xuất" />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `QC in-line — ${detail.ma_phan || detail.ma_phieu_san_xuat}` : 'QC in-line'}
        subtitle={detail ? `Chuyền ${detail.ma_chuyen || '—'} · ${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        width="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={submit} loading={saving} disabled={!canQc}>Ghi nhận kiểm</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="SL mẫu kiểm" required>
                <Input type="number" value={form.soLuongMau}
                  onChange={(e) => setForm({ ...form, soLuongMau: e.target.value })} placeholder="vd: 20" />
              </Field>
              <Field label="SL mẫu lỗi">
                <Input type="number" value={form.soLuongLoi}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, soLuongLoi: v, ketQua: Number(v) > 0 ? 'KHONG_DAT' : f.ketQua }));
                  }} placeholder="vd: 2" />
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Loại lỗi (chọn nhiều)</label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-control border border-line p-2">
                {loaiLoi.length === 0 && <p className="px-1 py-2 text-xs text-ink-soft">Chưa có danh mục lỗi.</p>}
                {loaiLoi.map((l) => {
                  const checked = l.id in loiSel;
                  return (
                    <div key={l.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-muted">
                      <input type="checkbox" checked={checked} onChange={() => toggleLoi(l.id)}
                        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                      <span className="flex-1 text-sm text-ink">{l.ten_loi}
                        {l.nhom_loi ? <span className="ml-1 text-xs text-ink-soft">({l.nhom_loi})</span> : null}</span>
                      {checked && (
                        <Input type="number" value={loiSel[l.id]} placeholder="SL"
                          onChange={(e) => setLoiSel((s) => ({ ...s, [l.id]: e.target.value }))}
                          className="h-8 w-20 text-sm" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Field label="Kết quả QC lần kiểm này" required>
              <Select value={form.ketQua} onChange={(e) => setForm({ ...form, ketQua: e.target.value })}>
                <option value="DAT">Đạt</option>
                <option value="KHONG_DAT">Không đạt</option>
              </Select>
            </Field>

            {hasLoi && (
              <>
                <Field label="Nguyên nhân">
                  <Textarea rows={2} value={form.nguyenNhan}
                    onChange={(e) => setForm({ ...form, nguyenNhan: e.target.value })}
                    placeholder="Nguyên nhân gây lỗi..." />
                </Field>
                <Field label="Khắc phục">
                  <Textarea rows={2} value={form.khacPhuc}
                    onChange={(e) => setForm({ ...form, khacPhuc: e.target.value })}
                    placeholder="Biện pháp khắc phục..." />
                </Field>
              </>
            )}
          </div>
        )}
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử QC in-line" fetcher={inlineHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Phiếu đã QC in-line" maHeader="Phiếu" fetcher={inlineDone} />

      <Toast toast={toast} />
    </div>
  );
}
