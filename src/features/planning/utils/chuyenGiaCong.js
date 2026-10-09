// ─────────────────────────────────────────────────────────────────────────────
// CHUYỀN GIA CÔNG (09/10/2026) — nhận diện để CẢNH BÁO trước khi xác nhận: release / xác nhận kế hoạch tạm / tạo
// đợt SX / lập lại kế hoạch lên chuyền loại `GIA_CONG` ⇒ lệnh vào thẳng *Kế hoạch › Gia công* (không Test Run,
// không Sản xuất). Ca thật 09/10: 32 phần in kế hoạch tạm lập trên GIABAO được bấm "Xác nhận Release 1" mà
// người bấm không biết là sẽ vào gia công (hộp xác nhận cũ chỉ ghi "theo chuyền đã lập kế hoạch tạm").
// `chuyen` = danh mục `GET /catalog/chuyen` ({ id, ma_chuyen, ten_chuyen, loai_chuyen, ma_loai_chuyen }).
// BE cũ chưa trả `ma_loai_chuyen` ⇒ lùi về so TÊN loại ("Gia công").
// ─────────────────────────────────────────────────────────────────────────────
import { khongDau } from '../../../utils/timKiem';

export function timChuyen(chuyen, id) {
  return id ? (chuyen || []).find((c) => c.id === id) || null : null;
}

export function laChuyenGiaCong(chuyen, id) {
  const c = timChuyen(chuyen, id);
  if (!c) return false;
  if (c.ma_loai_chuyen) return c.ma_loai_chuyen === 'GIA_CONG';
  return /gia\s*cong/.test(khongDau(c.loai_chuyen || ''));
}

export const tenChuyen = (chuyen, id) => {
  const c = timChuyen(chuyen, id);
  return c ? (c.ten_chuyen || c.ma_chuyen || '') : '';
};
