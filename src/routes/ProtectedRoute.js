import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated, selectAuth, fetchMeThunk } from '../store/authSlice';
import usePresenceTracker from '../hooks/usePresenceTracker';

export default function ProtectedRoute() {
  const dispatch = useDispatch();
  const location = useLocation();
  const isAuth = useSelector(selectIsAuthenticated);
  const { token, user } = useSelector(selectAuth);

  // Theo dõi online + lịch sử điều hướng (chỉ chạy khi đã đăng nhập).
  usePresenceTracker();

  // Có token nhưng chưa có thông tin user (vd sau reload) → nạp lại.
  useEffect(() => {
    if (token && !user) dispatch(fetchMeThunk());
  }, [token, user, dispatch]);

  if (!isAuth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
