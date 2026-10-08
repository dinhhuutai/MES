import { khop, khopNhieu } from '../../../utils/timKiem';
import { trongKhoangNgay } from '../../../utils/format';
import { hopChipChuyen } from '../../../utils/khuChuyen';

// ─────────────────────────────────────────────────────────────────────────────
// LỌC LỆNH màn Xác nhận chạy — DÙNG CHUNG bảng *Đang chạy* (trang) và modal *Chờ chạy* (01/10/2026),
// để 2 nơi cùng một luật: ô tìm · 6 ô lọc phần in · ô chuyền · chip loại chuyền/khu · khoảng ngày.
// ─────────────────────────────────────────────────────────────────────────────

export const LOC_TRONG = { khach: '', don: '', maHang: '', mauVai: '', kichVai: '', kichPhim: '', chuyenId: '' };

const dsPin = (r) => (r.phan_in_list && r.phan_in_list.length ? r.phan_in_list : [r]);

// Ô TÌM: mã lệnh · chuyền · mọi phần in của lệnh (code phần, khách, đơn, mã hàng, màu, kích) · MÃ VẠCH
// (`ma_quet` từ backend = mọi mã TDTHĐH + mã HSKT của lệnh — lệnh gom set đủ mã của từng phần in).
export function khopTimLenh(r, q) {
  if (!String(q || '').trim()) return true;
  const gt = [r.ma_lenh_san_xuat, r.ma_chuyen, r.ten_chuyen, r.phan_list, r.ma_quet];
  dsPin(r).forEach((p) => gt.push(p.ma_phan, p.ten_khach_hang, p.ma_don_hang, p.ma_hang, p.mau_vai, p.kich_vai, p.kich_phim));
  return khopNhieu(gt, q);
}

// Lệnh GOM SET: khớp khi BẤT KỲ phần in nào khớp ĐỦ 6 ô (chỉ xét `r.*` là chỉ so phần in đầu tiên).
function khopLoc(r, f, selChuyen) {
  const pin = dsPin(r).some((p) => khop(p.ten_khach_hang, f.khach) && khop(p.ma_don_hang, f.don)
    && khop(p.ma_hang, f.maHang) && khop(p.mau_vai, f.mauVai)
    && khop(p.kich_vai, f.kichVai) && khop(p.kich_phim, f.kichPhim));
  if (!pin) return false;
  if (!f.chuyenId || !selChuyen) return true;
  const ten = [selChuyen.ten_chuyen, selChuyen.ma_chuyen].filter(Boolean).map((s) => s.toLowerCase());
  return [r.ten_chuyen, r.ma_chuyen].filter(Boolean).some((v) => ten.includes(v.toLowerCase()));
}

// `ngay` = [{ cot, from, to }] — nhiều khoảng ngày chồng nhau theo AND (Đang chạy có 2 ô ngày).
// `boChip` = bỏ qua chip (để đếm số trên chip).
export function locLenhChay(rows, { search = '', loc = LOC_TRONG, chuyen = [], loai = '', ngay = [], boChip = false } = {}) {
  const selChuyen = loc.chuyenId ? (chuyen || []).find((x) => x.id === loc.chuyenId) || null : null;
  return (rows || []).filter((r) => khopTimLenh(r, search)
    && khopLoc(r, loc, selChuyen)
    && (boChip || !loai || hopChipChuyen(r, loai))
    && ngay.every((n) => trongKhoangNgay(r[n.cot], n.from, n.to)));
}

export const coLoc = (loc) => Object.values(loc || {}).some(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// QUÉT ĐỂ TÍCH (modal Chờ chạy, 08/10/2026) — đầu đọc mã vạch gõ mã + Enter vào ô tìm.
// Khớp theo 3 lượt, lượt nào ra kết quả thì dừng (cùng tinh thần thứ tự tra mã màn READY):
//   1. CHÍNH XÁC theo mã lệnh · code phần · mã vạch phần in TDTHĐH (`ma_vach_pin` — 1–1 code phần)
//   2. CHÍNH XÁC theo mã HSKT (`ma_quet` còn lại — 1 mã phủ nhiều code phần)
//   3. GẦN ĐÚNG như ô tìm thường (`khopTimLenh`)
// Rồi CHỌN lệnh để tích (`chonLenhDeTich`) — KHÔNG ĐOÁN: chỉ tự tích khi mọi lệnh khớp thuộc CÙNG phần in
// (1 phần in có thể có 2–3 lệnh chờ chạy — đo prod 08/10: 44 phần in ⇒ tích lệnh CHƯA tích đứng đầu danh
// sách, tức ngày SX KH sớm nhất; quét lại để tích lệnh kế). Khớp lệnh của NHIỀU phần in (mã HSKT phủ nhiều
// code phần, hoặc gõ tay một đoạn chữ) ⇒ không tích, để người dùng tự tích trên bảng đã lọc.
// ─────────────────────────────────────────────────────────────────────────────
const HOA = (s) => String(s || '').trim().toUpperCase();
const tachMa = (s) => String(s || '').split(/[,;\s]+/).map(HOA).filter(Boolean);

export function timLenhTheoMa(rows, ma) {
  const q = HOA(ma);
  const ds = rows || [];
  if (!q) return { luot: 0, ds: [] };
  const l1 = ds.filter((r) => HOA(r.ma_lenh_san_xuat) === q
    || dsPin(r).some((p) => HOA(p.ma_phan) === q) || tachMa(r.ma_vach_pin).includes(q));
  if (l1.length) return { luot: 1, ds: l1 };
  const l2 = ds.filter((r) => tachMa(r.ma_quet).includes(q));
  if (l2.length) return { luot: 2, ds: l2 };
  return { luot: 3, ds: ds.filter((r) => khopTimLenh(r, ma)) };
}

// Khóa "cùng phần in" của 1 lệnh (lệnh gom set cũ = bộ nhiều phần in).
export const khoaPinLenh = (r) => dsPin(r).map((p) => p.phan_in_id || p.ma_phan || '').sort().join('|');

// `daChon` = Set id lệnh đã tích. Trả { lenh, conLai, kieu }:
//   kieu 'TICH' (lenh = lệnh sẽ tích, conLai = số lệnh cùng phần in còn chưa tích sau lệnh này) ·
//   'DA_TICH' (mọi lệnh khớp đã tích — lenh = lệnh đầu) · 'NHIEU' (khớp lệnh của nhiều phần in) · 'KHONG'.
export function chonLenhDeTich(ds, daChon) {
  if (!ds.length) return { kieu: 'KHONG' };
  if (new Set(ds.map(khoaPinLenh)).size > 1) return { kieu: 'NHIEU' };
  const chua = ds.filter((r) => !daChon.has(r.id));
  if (!chua.length) return { kieu: 'DA_TICH', lenh: ds[0] };
  return { kieu: 'TICH', lenh: chua[0], conLai: chua.length - 1 };
}
