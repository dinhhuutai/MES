import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listRoles, getRole, createRole, updateRole, setRoleActive,
} from '../../../services/roleService';
import { listPermissions } from '../../../services/permissionService';

export default function RolesPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('ROLE_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [allPerms, setAllPerms] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ maRole: '', tenRole: '', moTa: '', permissionIds: [] });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRoles({ search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    listPermissions().then((r) => setAllPerms(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const permsByModule = useMemo(() => {
    const g = {};
    for (const p of allPerms) {
      const m = p.module || 'KHÁC';
      (g[m] = g[m] || []).push(p);
    }
    return g;
  }, [allPerms]);

  const openCreate = () => {
    setEditing(null);
    setForm({ maRole: '', tenRole: '', moTa: '', permissionIds: [] });
    setModalOpen(true);
  };
  const openEdit = async (r) => {
    try {
      const res = await getRole(r.id);
      setEditing(res.data);
      setForm({
        maRole: res.data.ma_role, tenRole: res.data.ten_role, moTa: res.data.mo_ta || '',
        permissionIds: res.data.permission_ids || [],
      });
      setModalOpen(true);
    } catch (e) {
      show(e.message || 'Lỗi', 'error');
    }
  };

  const togglePerm = (id) =>
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(id)
        ? f.permissionIds.filter((x) => x !== id)
        : [...f.permissionIds, id],
    }));

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateRole(editing.id, { tenRole: form.tenRole, moTa: form.moTa, permissionIds: form.permissionIds });
        show('Đã cập nhật vai trò');
      } else {
        await createRole(form);
        show('Đã tạo vai trò');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doToggle = async () => {
    try {
      await setRoleActive(confirm.role.id, confirm.active);
      show('Đã cập nhật');
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'ma_role', header: 'Mã', className: 'font-medium text-ink' },
    { key: 'ten_role', header: 'Tên vai trò', className: 'font-medium text-ink' },
    { key: 'mo_ta', header: 'Mô tả', render: (r) => r.mo_ta || '—' },
    { key: 'so_quyen', header: 'Số quyền', render: (r) => <Badge tone="info">{r.so_quyen}</Badge> },
    { key: 'so_nguoi_dung', header: 'Người dùng', render: (r) => r.so_nguoi_dung },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) =>
      r.dang_hoat_dong ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        {r.ma_role !== 'ADMIN' && (
          <Button variant={r.dang_hoat_dong ? 'danger' : 'secondary'} className="px-3 py-1.5"
            onClick={() => setConfirm({ role: r, active: !r.dang_hoat_dong })}>
            {r.dang_hoat_dong ? 'Tắt' : 'Bật'}
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Quản lý vai trò" subtitle="Vai trò và quyền hạn"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm vai trò...">
        {canManage && <Button icon="user" onClick={openCreate}>Thêm vai trò</Button>}
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có vai trò" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Sửa vai trò: ${editing.ten_role}` : 'Thêm vai trò'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={save} loading={saving} disabled={!form.maRole || !form.tenRole}>Lưu</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Mã vai trò" required>
            <Input value={form.maRole} disabled={!!editing}
              onChange={(e) => setForm({ ...form, maRole: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tên vai trò" required>
            <Input value={form.tenRole} onChange={(e) => setForm({ ...form, tenRole: e.target.value })} />
          </Field>
        </div>
        <Field label="Mô tả">
          <Textarea rows={2} value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} />
        </Field>

        <div className="mt-2">
          <div className="mb-2 text-sm font-medium text-ink">Phân quyền ({form.permissionIds.length})</div>
          <div className="space-y-4">
            {Object.entries(permsByModule).map(([mod, perms]) => (
              <div key={mod} className="rounded-control border border-line p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{mod}</div>
                <div className="flex flex-wrap gap-2">
                  {perms.map((p) => (
                    <button type="button" key={p.id} onClick={() => togglePerm(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        form.permissionIds.includes(p.id)
                          ? 'border-primary bg-primary-wash text-primary'
                          : 'border-line text-ink-soft hover:bg-surface-muted'
                      }`} title={p.ma_permission}>
                      {p.ten_permission}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doToggle}
        title="Đổi trạng thái vai trò"
        message={confirm ? `Xác nhận ${confirm.active ? 'bật' : 'tắt'} vai trò "${confirm.role.ten_role}"?` : ''}
        confirmText={confirm?.active ? 'Bật' : 'Tắt'}
        variant={confirm?.active ? 'primary' : 'danger'}
      />
      <Toast toast={toast} />
    </div>
  );
}
