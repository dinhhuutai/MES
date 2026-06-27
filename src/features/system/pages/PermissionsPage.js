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
import {
  listPermissions, createPermission, updatePermission, setPermissionActive,
} from '../../../services/permissionService';

const empty = { maPermission: '', tenPermission: '', module: '', action: '', moTa: '' };

export default function PermissionsPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('PERM_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPermissions({ search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ maPermission: p.ma_permission, tenPermission: p.ten_permission, module: p.module || '', action: p.action || '', moTa: p.mo_ta || '' });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await updatePermission(editing.id, form); show('Đã cập nhật'); }
      else { await createPermission(form); show('Đã tạo permission'); }
      setModalOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      await setPermissionActive(p.id, !p.dang_hoat_dong);
      show('Đã cập nhật');
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'ma_permission', header: 'Mã', className: 'font-mono text-xs font-medium text-ink' },
    { key: 'ten_permission', header: 'Tên', className: 'text-ink' },
    { key: 'module', header: 'Module', render: (r) => r.module ? <Badge tone="info">{r.module}</Badge> : '—' },
    { key: 'action', header: 'Action', render: (r) => r.action || '—' },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) =>
      r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && r.ma_permission !== '*' && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggleActive(r)}>
          {r.dang_hoat_dong ? 'Tắt' : 'Bật'}
        </Button>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Quản lý permission" subtitle="Danh mục quyền chi tiết"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm permission...">
        {canManage && <Button icon="settings" onClick={openCreate}>Thêm permission</Button>}
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có permission" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sửa permission' : 'Thêm permission'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={save} loading={saving} disabled={!form.maPermission || !form.tenPermission}>Lưu</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Mã permission" required>
            <Input value={form.maPermission} disabled={!!editing}
              onChange={(e) => setForm({ ...form, maPermission: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tên" required>
            <Input value={form.tenPermission} onChange={(e) => setForm({ ...form, tenPermission: e.target.value })} />
          </Field>
          <Field label="Module">
            <Input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Action">
            <Input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <Field label="Mô tả">
          <Input value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
