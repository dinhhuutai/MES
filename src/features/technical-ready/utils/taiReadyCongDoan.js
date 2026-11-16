// ─────────────────────────────────────────────────────────────────────────────
// READY THEO CÔNG ĐOẠN (14/11/2026, người dùng chốt — BE `utils/readyCongDoan.js`): phần in 2 công đoạn ra 2 DÒNG từ
// READY — dòng công đoạn in (bộ gốc) + dòng công đoạn Ép/Logo (`giai_doan` 'EP_UI', bộ KHUON_EP/FILM_EP/MUC_EP/QC_EP).
// Màn READY / QC READY tải HẾT cả 2 bộ rồi ghép: dòng ép nằm NGAY DƯỚI các dòng in cùng phần in (không có dòng in ⇒
// cuối danh sách). Bộ ép lỗi / chưa chạy mig 131 ⇒ chỉ còn dòng in như trước.
// ─────────────────────────────────────────────────────────────────────────────
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';

export const GD_EP = 'EP_UI';
export const laDongEp = (r) => r && r.giai_doan === GD_EP;
// Tham số `giaiDoan` gửi kèm thao tác trên 1 dòng.
export const gdCuaDong = (r) => (laDongEp(r) ? GD_EP : undefined);

export function ghepDong(dsIn, dsEp) {
  if (!dsEp.length) return dsIn;
  const theoPin = new Map();
  dsEp.forEach((r) => { const a = theoPin.get(r.id) || []; a.push(r); theoPin.set(r.id, a); });
  const out = [];
  dsIn.forEach((r, i) => {
    out.push(r);
    const cuoiCuaPin = i === dsIn.length - 1 || dsIn[i + 1].id !== r.id;
    if (cuoiCuaPin && theoPin.has(r.id)) { out.push(...theoPin.get(r.id)); theoPin.delete(r.id); }
  });
  theoPin.forEach((a) => out.push(...a));
  return out;
}

// `fetcher(params)` = listReadyCandidates / listReadyQcCandidates.
export default async function taiReadyCongDoan(fetcher, search) {
  const [a, b] = await Promise.all([
    taiHetTrang((p) => fetcher({ search, ...p }), { limit: LIMIT_TAI_LON }),
    taiHetTrang((p) => fetcher({ search, giaiDoan: GD_EP, ...p }), { limit: LIMIT_TAI_LON })
      .catch(() => ({ items: [], total: 0, thieu: false })),
  ]);
  return { items: ghepDong(a.items || [], b.items || []), total: (a.total || 0) + (b.total || 0), thieu: !!(a.thieu || b.thieu) };
}
