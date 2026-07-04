import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { avatarFor } from '../../../utils/brand';
import { apiChangePassword } from '../../../services/authService';
import {
  selectAuth, updateProfileThunk, uploadAvatarThunk, resetAvatarThunk,
} from '../../../store/authSlice';
import { selectTheme, setTheme } from '../../../store/uiSlice';

const GIOI_TINH_LABEL = { NAM: 'Nam', NU: 'Nữ' };
const MAX_AVATAR_MB = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector(selectAuth);
  const theme = useSelector(selectTheme);
  const { toast, show } = useToast();
  const fileRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [form, setForm] = useState({
    hoTen: user?.hoTen || '',
    email: user?.email || '',
    soDienThoai: user?.soDienThoai || '',
    chucVu: user?.chucVu || '',
    gioiTinh: user?.gioiTinh || '',
  });
  const [saving, setSaving] = useState(false);

  const [pwd, setPwd] = useState({ cu: '', moi: '', xacNhan: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPw = (k) => (e) => setPwd((p) => ({ ...p, [k]: e.target.value }));

  const changePassword = async () => {
    if (pwd.moi.length < 6) { show('Mật khẩu mới tối thiểu 6 ký tự', 'error'); return; }
    if (pwd.moi !== pwd.xacNhan) { show('Xác nhận mật khẩu không khớp', 'error'); return; }
    setPwdSaving(true);
    try {
      await apiChangePassword(pwd.cu, pwd.moi);
      show('Đã đổi mật khẩu');
      setPwd({ cu: '', moi: '', xacNhan: '' });
    } catch (e) {
      show(e?.message || 'Đổi mật khẩu thất bại', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await dispatch(updateProfileThunk(form)).unwrap();
      show('Đã cập nhật thông tin cá nhân');
    } catch (e) {
      show(e?.message || 'Cập nhật thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng file
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      show('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      show(`Ảnh vượt quá ${MAX_AVATAR_MB}MB`, 'error');
      return;
    }
    setAvatarBusy(true);
    try {
      await dispatch(uploadAvatarThunk(file)).unwrap();
      show('Đã cập nhật ảnh đại diện');
    } catch (err) {
      show(err?.message || 'Tải ảnh thất bại', 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  const resetAvatar = async () => {
    setAvatarBusy(true);
    try {
      await dispatch(resetAvatarThunk()).unwrap();
      show('Đã đặt lại ảnh mặc định');
    } catch (err) {
      show(err?.message || 'Đặt lại thất bại', 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Thông tin cá nhân</h1>
        <p className="mt-1 text-sm text-ink-soft">Xem và cập nhật thông tin tài khoản của bạn.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* CỘT TRÁI: avatar + thông tin */}
        <div className="space-y-6 lg:col-span-2">
          {/* Avatar (ngang) */}
          <div className="card flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
            <div className="relative shrink-0">
              <img
                src={avatarFor(user)}
                alt={user?.hoTen || 'avatar'}
                className="h-24 w-24 rounded-full object-cover ring-1 ring-line"
              />
              {avatarBusy && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-xs font-medium text-white">
                  Đang xử lý…
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-ink">{user?.hoTen || user?.tenDangNhap}</div>
              <div className="text-xs text-ink-soft">@{user?.tenDangNhap}</div>

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onPickFile}
              />
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button
                  variant="secondary"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  Đổi avatar
                </Button>
                {user?.avatarUrl && (
                  <Button variant="ghost" disabled={avatarBusy} onClick={resetAvatar}>
                    Đặt lại mặc định
                  </Button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                JPG, PNG, WEBP, GIF · tối đa {MAX_AVATAR_MB}MB. Mặc định theo giới tính.
              </p>
            </div>
          </div>

          {/* Thông tin */}
          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">Thông tin tài khoản</h2>

            <div className="mb-5 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Mã nhân viên">
                <Input value={user?.maUser || '—'} disabled />
              </Field>
              <Field label="Tên đăng nhập">
                <Input value={user?.tenDangNhap || ''} disabled />
              </Field>
              <Field label="Phòng ban">
                <Input value={user?.phongBan || '—'} disabled />
              </Field>
              <Field label="Vai trò">
                <div className="flex min-h-11 flex-wrap items-center gap-1.5">
                  {(user?.roles || []).length
                    ? user.roles.map((r) => <Badge key={r} tone="info">{r}</Badge>)
                    : <span className="text-sm text-ink-soft">—</span>}
                </div>
              </Field>
            </div>

            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">Thông tin cá nhân</h2>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Họ tên" required>
                <Input value={form.hoTen} onChange={set('hoTen')} />
              </Field>
              <Field label="Giới tính" hint="Quyết định avatar mặc định">
                <Select value={form.gioiTinh} onChange={set('gioiTinh')}>
                  <option value="">— Chưa xác định —</option>
                  <option value="NAM">{GIOI_TINH_LABEL.NAM}</option>
                  <option value="NU">{GIOI_TINH_LABEL.NU}</option>
                </Select>
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set('email')} />
              </Field>
              <Field label="Số điện thoại">
                <Input value={form.soDienThoai} onChange={set('soDienThoai')} />
              </Field>
              <Field label="Chức vụ">
                <Input value={form.chucVu} onChange={set('chucVu')} />
              </Field>
            </div>

            <div className="mt-2 flex justify-end">
              <Button onClick={save} loading={saving} disabled={!form.hoTen.trim()}>
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: đổi mật khẩu + giao diện */}
        <div className="space-y-6">
          {/* Đổi mật khẩu */}
          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">Đổi mật khẩu</h2>
            <div className="grid grid-cols-1 gap-x-4">
              <Field label="Mật khẩu hiện tại" required>
                <Input type="password" value={pwd.cu} onChange={setPw('cu')} autoComplete="current-password" />
              </Field>
              <Field label="Mật khẩu mới" required hint="Tối thiểu 6 ký tự">
                <Input type="password" value={pwd.moi} onChange={setPw('moi')} autoComplete="new-password" />
              </Field>
              <Field label="Xác nhận mật khẩu mới" required>
                <Input type="password" value={pwd.xacNhan} onChange={setPw('xacNhan')} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button onClick={changePassword} loading={pwdSaving}
                disabled={!pwd.cu || !pwd.moi || !pwd.xacNhan}>Đổi mật khẩu</Button>
            </div>
          </div>

          {/* Giao diện sáng/tối (lưu theo tài khoản trên thiết bị này) */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-ink">Giao diện</h2>
            <p className="mt-1 text-sm text-ink-soft">Chọn chế độ sáng hoặc tối cho tài khoản của bạn.</p>
            <div className="mt-4 flex rounded-control border border-line p-1">
              <button onClick={() => dispatch(setTheme('light'))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition ${theme === 'light' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>
                <Icon name="sun" size={16} /> Sáng
              </button>
              <button onClick={() => dispatch(setTheme('dark'))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition ${theme === 'dark' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>
                <Icon name="moon" size={16} /> Tối
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
