import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Menu } from '@headlessui/react';
import Icon from '../common/Icon';
import { logout, selectAuth } from '../../store/authSlice';
import { LOGO_SRC, avatarFor } from '../../utils/brand';

export default function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(selectAuth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-header items-center justify-between border-b border-line bg-surface px-6">
      <Link to="/" className="flex items-center gap-3">
        <img src={LOGO_SRC} alt="THLA" className="h-9 w-9 object-contain" />
        <div className="leading-tight">
          <div className="text-base font-bold text-ink">THLA MES</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Manufacturing Execution
          </div>
        </div>
      </Link>

      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-muted">
          <img
            src={avatarFor(user)}
            alt={user?.hoTen || user?.tenDangNhap || 'avatar'}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-line"
          />
          <div className="hidden text-left sm:block">
            <div className="text-sm font-semibold text-ink">{user?.hoTen || user?.tenDangNhap}</div>
            <div className="text-xs text-ink-soft">{user?.chucVu || user?.phongBan || '—'}</div>
          </div>
        </Menu.Button>
        <Menu.Items className="absolute right-0 mt-2 w-52 overflow-hidden rounded-control border border-line bg-surface py-1 shadow-card-hover focus:outline-none">
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={() => navigate('/thong-tin-ca-nhan')}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink ${active ? 'bg-surface-muted' : ''}`}
              >
                <Icon name="user" size={16} /> Thông tin cá nhân
              </button>
            )}
          </Menu.Item>
          <div className="my-1 border-t border-line" />
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleLogout}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink ${active ? 'bg-surface-muted' : ''}`}
              >
                <Icon name="log-out" size={16} /> Đăng xuất
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Menu>
    </header>
  );
}
