import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import Robot, { RobotDefs } from './RobotAgent';
import { MAU_ROBOT, MAU_MAC_DINH } from './robot';
import { layTrangThaiAi, datMauRobotAi, SU_KIEN_DOI_MAU_ROBOT } from '../../services/aiService';

// Khối "Robot Agent MES THLA" ở Thông tin cá nhân (19/11/2026): mỗi người tự chọn Vàng Nắng (mặc định) / Vàng Kem.
// Lưu theo tài khoản (BE `PUT /api/ai/mau-robot` ⇒ `nguoi_dung.ai_mau_robot`) ⇒ đổi máy vẫn giữ.
// Tự ẩn với người không có vai trò AI. Lưu xong phát sự kiện để robot đang mở (`AgentLoader`) đổi hình ngay.

export default function ChonMauRobot({ onThongBao }) {
  const [tt, setTt] = useState(null);
  const [dangLuu, setDangLuu] = useState('');

  useEffect(() => {
    let huy = false;
    layTrangThaiAi().then((r) => { if (!huy) setTt(r.data || null); }).catch(() => {});
    return () => { huy = true; };
  }, []);

  if (!tt || !tt.co_quyen) return null;
  const hienTai = tt.mau_robot || MAU_MAC_DINH;

  const chon = async (m) => {
    if (m.ma === hienTai || dangLuu) return;
    setDangLuu(m.ma);
    try {
      await datMauRobotAi(m.ma);
      setTt((t) => ({ ...t, mau_robot: m.ma }));
      window.dispatchEvent(new CustomEvent(SU_KIEN_DOI_MAU_ROBOT, { detail: m.ma }));
      if (onThongBao) onThongBao(`Đã đổi robot thành ${m.ten}`);
    } catch (e) {
      if (onThongBao) onThongBao((e && e.message) || 'Đổi hình robot thất bại', 'error');
    } finally {
      setDangLuu('');
    }
  };

  return (
    <div className="card p-6">
      <RobotDefs />
      <h2 className="text-sm font-semibold text-ink">Robot Agent MES THLA</h2>
      <p className="mt-1 text-sm text-ink-soft">Chọn hình robot trợ lý AI của bạn. Áp dụng ngay, trên mọi máy bạn đăng nhập.</p>
      <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Hình robot">
        {MAU_ROBOT.map((m) => {
          const on = m.ma === hienTai;
          return (
            <button
              key={m.ma}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!dangLuu}
              onClick={() => chon(m)}
              className={`relative flex flex-col items-center gap-1.5 rounded-control border-2 p-3 text-center transition disabled:opacity-70 ${
                on ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-line hover:border-amber-300'}`}
            >
              {on && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-amber-950">
                  <Check size={13} />
                </span>
              )}
              <Robot mau={m.ma} trangThai={on ? 'vui' : 'chao'} className="w-[92px]" />
              <span className="text-sm font-semibold text-ink">
                {m.ten}{m.ma === MAU_MAC_DINH ? ' (mặc định)' : ''}
              </span>
              <span className="text-[11.5px] leading-snug text-ink-soft">{m.mo_ta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
