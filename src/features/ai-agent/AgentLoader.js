import { Suspense, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/authSlice';
import { layTrangThaiAi, SU_KIEN_DOI_MAU_ROBOT } from '../../services/aiService';
import taiLuoi from '../../utils/taiLuoi';

// Gắn ở `ProtectedRoute`: hỏi BE người này có vai trò AI không (quyền AI TƯỜNG MINH, không theo '*', đọc tươi DB
// ⇒ gán vai trò xong tối đa ~30 giây + lần tải lại / đổi tab là thấy robot). Có quyền mới tải file JS của Agent.
const AgentMesThla = taiLuoi(() => import('./AgentMesThla'));
const CHU_KY_MS = 5 * 60 * 1000;

export default function AgentLoader() {
  const { token, user } = useSelector(selectAuth);
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
    window.addEventListener(SU_KIEN_DOI_MAU_ROBOT, doi);
    return () => window.removeEventListener(SU_KIEN_DOI_MAU_ROBOT, doi);
  }, []);

  if (!tt || !tt.co_quyen) return null;
  return (
    <Suspense fallback={null}>
      <AgentMesThla trangThai={tt} userId={user && user.id} />
    </Suspense>
  );
}
