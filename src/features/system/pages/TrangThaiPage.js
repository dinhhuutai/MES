import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listStatuses, createStatus, updateStatus, setStatusActive } from '../../../services/wfconfigService';

const empty = { maTrangThai: '', tenTrangThai: '', nhomTrangThai: '', ghiChu: '' };

export default function TrangThaiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('STATUS_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // row đang sửa, null = tạo mới
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listStatuses({ search })).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ maTrangThai: r.ma_trang_thai, tenTrangThai: r.ten_trang_thai, nhomTrangThai: r.nhom_trang_thai || '', ghiChu: r.ghi_chu || '' });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await updateStatus(editing.id, form); show('Đã cập nhật'); }
      else { await createStatus(form); show('Đã tạo trạng thái'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (r) => {
    try { await setStatusActive(r.id, !r.dang_hoat_dong); show('Đã cập nhật'); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'ma_trang_thai', header: 'Mã', className: 'font-mono text-xs font-medium text-ink' },
    { key: 'ten_trang_thai', header: 'Tên trạng thái', className: 'text-ink' },
    { key: 'nhom_trang_thai', header: 'Nhóm', render: (r) => r.nhom_trang_thai ? <Badge tone="info">{r.nhom_trang_thai}</Badge> : '—' },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => r.ghi_chu || '—' },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) => r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggle(r)}>{r.dang_hoat_dong ? 'Tắt' : 'Bật'}</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Quản lý trạng thái" subtitle="Danh mục trạng thái (nhóm CHECKPOINT, NGHEN...)"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm trạng thái...">
        {canManage && <Button icon="settings" onClick={openCreate}>Thêm trạng thái</Button>}
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có trạng thái" />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa trạng thái' : 'Thêm trạng thái'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.maTrangThai || !form.tenTrangThai}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Mã trạng thái" required>
            <Input value={form.maTrangThai} disabled={!!editing}
              onChange={(e) => setForm({ ...form, maTrangThai: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Nhóm">
            <Input value={form.nhomTrangThai} onChange={(e) => setForm({ ...form, nhomTrangThai: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <Field label="Tên trạng thái" required>
          <Input value={form.tenTrangThai} onChange={(e) => setForm({ ...form, tenTrangThai: e.target.value })} />
        </Field>
        <Field label="Ghi chú">
          <Input value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
