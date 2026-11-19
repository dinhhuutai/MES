import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import Robot, { RobotDefs } from './RobotAgent';
import { MAU_ROBOT, MAU_MAC_DINH } from './robot';
import {
  layTrangThaiAi, datMauRobotAi, SU_KIEN_DOI_MAU_ROBOT,
  CHE_DO_HIEN, HIEN_MAC_DINH, datCheDoHienAi, SU_KIEN_DOI_CHE_DO_HIEN,
} from '../../services/aiService';

// Khối "Robot Agent MES THLA" ở Thông tin cá nhân (19/11/2026): mỗi người tự chọn
//   · Hiện robot: Mọi trang (mặc định) / Chỉ trang chủ / Ẩn — BE `PUT /api/ai/che-do-hien` (audit_log 'ai_hien')
//   · Hình robot: Vàng Nắng (mặc định) / Vàng Kem — BE `PUT /api/ai/mau-robot` ⇒ `nguoi_dung.ai_mau_robot`
// Lưu theo tài khoản ⇒ đổi máy vẫn giữ. Tự ẩn với người không có vai trò AI (nên chọn "Ẩn" vẫn bật lại được ở đây).
// Lưu xong phát sự kiện để `AgentLoader` áp ngay, không chờ lượt hỏi trạng thái kế tiếp.

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
  const cheDo = tt.hien || HIEN_MAC_DINH;

  const chonHien = async (c) => {
    if (c.ma === cheDo || dangLuu) return;
    setDangLuu(c.ma);
    try {
      await datCheDoHienAi(c.ma);
      setTt((t) => ({ ...t, hien: c.ma }));
      window.dispatchEvent(new CustomEvent(SU_KIEN_DOI_CHE_DO_HIEN, { detail: c.ma }));
      if (onThongBao) onThongBao(c.ma === 'AN' ? 'Đã ẩn robot Agent' : `Robot Agent: hiện ở ${c.ten.toLowerCase()}`);
    } catch (e) {
      if (onThongBao) onThongBao((e && e.message) || 'Đổi chỗ hiện robot thất bại', 'error');
    } finally {
      setDangLuu('');
    }
  };

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
      <p className="mt-1 text-sm text-ink-soft">Chọn chỗ hiện và hình robot trợ lý AI của bạn. Áp dụng ngay, trên mọi máy bạn đăng nhập.</p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">Hiện robot</h3>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Chỗ hiện robot">
        {CHE_DO_HIEN.map((c) => {
          const on = c.ma === cheDo;
          return (
            <button
              key={c.ma}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!dangLuu}
              onClick={() => chonHien(c)}
              className={`relative rounded-control border-2 px-3 py-2 text-left transition disabled:opacity-70 ${
                on ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-line hover:border-amber-300'}`}
            >
              {on && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-amber-950">
                  <Check size={13} />
                </span>
              )}
              <span className="block pr-6 text-sm font-semibold text-ink">
                {c.ten}{c.ma === HIEN_MAC_DINH ? ' (mặc định)' : ''}
              </span>
              <span className="block text-[11.5px] leading-snug text-ink-soft">{c.mo_ta}</span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Hình robot</h3>
      <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Hình robot">
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
