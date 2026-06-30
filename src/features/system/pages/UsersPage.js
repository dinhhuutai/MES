import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { avatarFor } from '../../../utils/brand';
import {
  listUsers, getUser, createUser, updateUser, setUserActive, resetUserPassword,
} from '../../../services/userService';
import { listPhongBan, listRoleOptions } from '../../../services/systemService';

const emptyForm = { tenDangNhap: '', matKhau: '', hoTen: '', email: '', soDienThoai: '', chucVu: '', gioiTinh: '', phongBanId: '', roleIds: [] };

export default function UsersPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('USER_MANAGE');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [phongBan, setPhongBan] = useState([]);
  const [roles, setRoles] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { user, active }
  const [resetUser, setResetUser] = useState(null);
  const [newPass, setNewPass] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({ search, page, limit: 20 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => {
    listPhongBan().then((r) => setPhongBan(r.data)).catch(() => {});
    listRoleOptions().then((r) => setRoles(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = async (u) => {
    setEditing(u);
    setForm({
      tenDangNhap: u.ten_dang_nhap, matKhau: '', hoTen: u.ho_ten || '', email: u.email || '',
      soDienThoai: u.so_dien_thoai || '', chucVu: u.chuc_vu || '', gioiTinh: u.gioi_tinh || '',
      phongBanId: u.phong_ban_id || '', roleIds: [],
    });
    setModalOpen(true);
    // Nạp sẵn vai trò hiện tại để khi lưu không xóa nhầm role.
    try {
      const res = await getUser(u.id);
      setForm((f) => ({ ...f, roleIds: res.data.role_ids || [] }));
    } catch (e) {
      show('Không tải được vai trò hiện tại của người dùng', 'error');
    }
  };

  const toggleRole = (id) =>
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((x) => x !== id) : [...f.roleIds, id],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, phongBanId: form.phongBanId || null };
      if (editing) {
        await updateUser(editing.id, payload);
        show('Đã cập nhật người dùng');
      } else {
        await createUser(payload);
        show('Đã tạo người dùng');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doToggleActive = async () => {
    try {
      await setUserActive(confirm.user.id, confirm.active);
      show('Đã cập nhật trạng thái');
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const doReset = async () => {
    try {
      await resetUserPassword(resetUser.id, newPass);
      show('Đã đặt lại mật khẩu');
      setResetUser(null);
      setNewPass('');
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'ma_user', header: 'Mã', className: 'font-medium text-ink' },
    { key: 'ho_ten', header: 'Họ tên', render: (r) => (
      <div className="flex items-center gap-3">
        <img src={avatarFor(r)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line" />
        <div>
          <div className="font-medium text-ink">{r.ho_ten}</div>
          <div className="text-xs text-ink-soft">@{r.ten_dang_nhap}</div>
        </div>
      </div>
    ) },
    { key: 'ten_phong_ban', header: 'Phòng ban', render: (r) => r.ten_phong_ban || '—' },
    { key: 'roles', header: 'Vai trò', render: (r) => (
      <div className="flex flex-wrap gap-1">
        {(r.roles || []).length ? r.roles.map((x) => <Badge key={x} tone="info">{x}</Badge>) : <span className="text-ink-soft">—</span>}
      </div>
    ) },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) =>
      r.dang_hoat_dong ? <Badge tone="success">Hoạt động</Badge> : <Badge tone="danger">Khóa</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => { setResetUser(r); setNewPass(''); }}>Đặt MK</Button>
        <Button variant={r.dang_hoat_dong ? 'danger' : 'secondary'} className="px-3 py-1.5"
          onClick={() => setConfirm({ user: r, active: !r.dang_hoat_dong })}>
          {r.dang_hoat_dong ? 'Khóa' : 'Mở'}
        </Button>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Quản lý người dùng" subtitle="Tài khoản, vai trò và phân quyền"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Tìm tên, mã, tài khoản...">
        {canManage && <Button icon="user" onClick={openCreate}>Thêm người dùng</Button>}
        <Badge tone="default">Tổng {meta.total}</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={(meta.page - 1) * 20}
        emptyText="Chưa có người dùng" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sửa người dùng' : 'Thêm người dùng'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={save} loading={saving}
              disabled={!form.hoTen || !form.tenDangNhap || (!editing && form.matKhau.length < 6)}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Tên đăng nhập" required>
            <Input value={form.tenDangNhap} disabled={!!editing}
              onChange={(e) => setForm({ ...form, tenDangNhap: e.target.value })} />
          </Field>
          {!editing && (
            <Field label="Mật khẩu" required hint="Tối thiểu 6 ký tự">
              <Input type="password" value={form.matKhau}
                onChange={(e) => setForm({ ...form, matKhau: e.target.value })} />
            </Field>
          )}
          <Field label="Họ tên" required>
            <Input value={form.hoTen} onChange={(e) => setForm({ ...form, hoTen: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Số điện thoại">
            <Input value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} />
          </Field>
          <Field label="Chức vụ">
            <Input value={form.chucVu} onChange={(e) => setForm({ ...form, chucVu: e.target.value })} />
          </Field>
          <Field label="Giới tính" hint="Quyết định avatar mặc định">
            <Select value={form.gioiTinh} onChange={(e) => setForm({ ...form, gioiTinh: e.target.value })}>
              <option value="">— Chưa xác định —</option>
              <option value="NAM">Nam</option>
              <option value="NU">Nữ</option>
            </Select>
          </Field>
          <Field label="Phòng ban">
            <Select value={form.phongBanId} onChange={(e) => setForm({ ...form, phongBanId: e.target.value })}>
              <option value="">— Chọn phòng ban —</option>
              {phongBan.map((pb) => <option key={pb.id} value={pb.id}>{pb.ten_phong_ban}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Vai trò" hint={editing ? 'Cập nhật vai trò sẽ thay thế toàn bộ vai trò hiện tại' : undefined}>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button type="button" key={r.id} onClick={() => toggleRole(r.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  form.roleIds.includes(r.id)
                    ? 'border-primary bg-primary-wash text-primary'
                    : 'border-line text-ink-soft hover:bg-surface-muted'
                }`}>
                {r.ten_role}
              </button>
            ))}
          </div>
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doToggleActive}
        title={confirm?.active ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        message={confirm ? `Xác nhận ${confirm.active ? 'mở khóa' : 'khóa'} tài khoản "${confirm.user.ho_ten}"?` : ''}
        confirmText={confirm?.active ? 'Mở khóa' : 'Khóa'}
        variant={confirm?.active ? 'primary' : 'danger'}
      />

      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title="Đặt lại mật khẩu"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetUser(null)}>Hủy</Button>
            <Button onClick={doReset} disabled={newPass.length < 6}>Đặt lại</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-soft">Mật khẩu mới cho <b>{resetUser?.ho_ten}</b>:</p>
        <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
