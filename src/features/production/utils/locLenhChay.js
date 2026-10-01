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
