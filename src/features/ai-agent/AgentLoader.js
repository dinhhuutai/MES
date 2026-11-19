import { Suspense, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { selectAuth } from '../../store/authSlice';
import { layTrangThaiAi, SU_KIEN_DOI_MAU_ROBOT, SU_KIEN_DOI_CHE_DO_HIEN } from '../../services/aiService';
import taiLuoi from '../../utils/taiLuoi';

// Gắn ở `ProtectedRoute`: hỏi BE người này có vai trò AI không (quyền AI TƯỜNG MINH, không theo '*', đọc tươi DB
// ⇒ gán vai trò xong tối đa ~30 giây + lần tải lại / đổi tab là thấy robot). Có quyền mới tải file JS của Agent.
const AgentMesThla = taiLuoi(() => import('./AgentMesThla'));
const CHU_KY_MS = 5 * 60 * 1000;

export default function AgentLoader() {
  const { token, user } = useSelector(selectAuth);
  const { pathname } = useLocation();
  const [tt, setTt] = useState(null);

  useEffect(() => {
    if (!token) { setTt(null); return undefined; }
    let huy = false;
    const tai = () => layTrangThaiAi().then((r) => { if (!huy) setTt(r.data || null); }).catch(() => {});
    tai();
    const t = setInterval(tai, CHU_KY_MS);
    const khiHien = () => { if (document.visibilityState === 'visible') tai(); };
    document.addEventListener('visibilitychange', khiHien);
    return () => { huy = true; clearInterval(t); document.removeEventListener('visibilitychange', khiHien); };
  }, [token]);

  // Đổi hình robot ở Thông tin cá nhân ⇒ robot đang mở đổi ngay, không chờ lượt hỏi trạng thái kế tiếp.
  useEffect(() => {
    const doi = (e) => setTt((t) => (t ? { ...t, mau_robot: e.detail } : t));
    const doiHien = (e) => setTt((t) => (t ? { ...t, hien: e.detail } : t));
    window.addEventListener(SU_KIEN_DOI_MAU_ROBOT, doi);
    window.addEventListener(SU_KIEN_DOI_CHE_DO_HIEN, doiHien);
    return () => {
      window.removeEventListener(SU_KIEN_DOI_MAU_ROBOT, doi);
      window.removeEventListener(SU_KIEN_DOI_CHE_DO_HIEN, doiHien);
    };
  }, []);

  if (!tt || !tt.co_quyen) return null;
  // Chỗ hiện robot người dùng tự chọn ở Thông tin cá nhân: Ẩn ⇒ không vẽ gì; Chỉ trang chủ ⇒ chỉ vẽ ở '/'.
  if (tt.hien === 'AN') return null;
  if (tt.hien === 'TRANG_CHU' && pathname !== '/') return null;
  return (
    <Suspense fallback={null}>
      <AgentMesThla trangThai={tt} userId={user && user.id} />
    </Suspense>
  );
}
