import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Button from '../../../components/common/Button';
import { loginThunk, selectAuth, selectIsAuthenticated, clearError } from '../../../store/authSlice';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useSelector(selectAuth);
  const isAuth = useSelector(selectIsAuthenticated);

  const [tenDangNhap, setTenDangNhap] = useState('');
  const [matKhau, setMatKhau] = useState('');

  const from = location.state?.from || '/';

  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
  }, [isAuth, from, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginThunk({ tenDangNhap: tenDangNhap.trim(), matKhau }));
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-card bg-primary text-2xl font-extrabold text-white">
            T
          </div>
          <h1 className="text-2xl font-bold text-ink">THLA MES</h1>
          <p className="text-sm text-ink-soft">Hệ thống điều hành sản xuất</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold text-ink">Đăng nhập</h2>

          {error && (
            <div className="mb-4 rounded-control border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
              {error}
            </div>
          )}

          <label className="mb-1.5 block text-sm font-medium text-ink">Tên đăng nhập</label>
          <input
            className="mb-4 h-12 w-full rounded-input border border-line px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            value={tenDangNhap}
            onChange={(e) => setTenDangNhap(e.target.value)}
            placeholder="admin"
            autoFocus
          />

          <label className="mb-1.5 block text-sm font-medium text-ink">Mật khẩu</label>
          <input
            type="password"
            className="mb-6 h-12 w-full rounded-input border border-line px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            placeholder="••••••••"
          />

          <Button
            type="submit"
            className="w-full"
            loading={status === 'loading'}
            disabled={!tenDangNhap || !matKhau}
          >
            Đăng nhập
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-soft">
          © 2026 THLA — Manufacturing Execution System
        </p>
      </div>
    </div>
  );
}
