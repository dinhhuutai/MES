import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import {
  listRelease1Candidates, createRelease1, listChuyen,
} from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

export default function Release1Page() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState({}); // dot_vai_id -> row
  const [chuyen, setChuyen] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRelease1Candidates({ search, page, limit: 50 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const tongVai = useMemo(
    () => selectedList.reduce((s, r) => s + (Number(r.so_luong_vai_ve) || 0), 0),
    [selectedList]
  );

  const toggle = (row) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[row.dot_vai_id]) delete next[row.dot_vai_id];
      else next[row.dot_vai_id] = row;
      return next;
    });

  const openModal = () => {
    setForm({ chuyenId: chuyen[0]?.id || '', soLuongRelease: String(tongVai || ''), ngayKeHoach: '' });
    setModalOpen(true);
  };

  const doRelease = async () => {
    setSaving(true);
    try {
      await createRelease1({
        dotVaiIds: selectedList.map((r) => r.dot_vai_id),
        chuyenId: form.chuyenId,
        soLuongRelease: form.soLuongRelease ? Number(form.soLuongRelease) : null,
        ngayKeHoach: form.ngayKeHoach || null,
      });
      show('Đã Release 1 — tạo lệnh sản xuất');
      setSelected({});
      setModalOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Release thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'sel', header: '', className: 'w-10', render: (r) => (
      <input type="checkbox" checked={!!selected[r.dot_vai_id]} onChange={() => toggle(r)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => <Badge tone="info">{r.ma_phan}</Badge> },
    { key: 'mau_vai', header: 'Màu vải', className: 'font-medium text-ink' },
    { key: 'ten_khach_hang', header: 'Khách hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'ma_dot_vai', header: 'Đợt vải' },
    { key: 'so_luong_vai_ve', header: 'SL vải về', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
  ];

  return (
    <div>
      <Toolbar title="Release 1" subtitle="Phần in đã READY — chọn đợt vải & chuyền để release test"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, màu, khách...">
        <Badge tone="info">{meta.total} đợt vải</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading}
        rowKey="dot_vai_id" emptyText="Không có đợt vải nào sẵn sàng Release 1" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {selectedList.length > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
          <span className="text-sm text-ink">
            Đã chọn <b>{selectedList.length}</b> đợt vải · Tổng SL vải về <b>{fmtNum(tongVai)}</b>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected({})}>Bỏ chọn</Button>
            <Button onClick={openModal}>Release 1</Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Release 1 — tạo lệnh sản xuất"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={doRelease} loading={saving} disabled={!form.chuyenId}>Xác nhận Release 1</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {selectedList.length} đợt vải · Tổng SL vải về {fmtNum(tongVai)}
        </div>
        <Field label="Chuyền sản xuất" required>
          <Select value={form.chuyenId} onChange={(e) => setForm({ ...form, chuyenId: e.target.value })}>
            <option value="">— Chọn chuyền —</option>
            {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Số lượng release">
            <Input type="number" value={form.soLuongRelease}
              onChange={(e) => setForm({ ...form, soLuongRelease: e.target.value })} />
          </Field>
          <Field label="Ngày kế hoạch">
            <Input type="date" value={form.ngayKeHoach}
              onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
