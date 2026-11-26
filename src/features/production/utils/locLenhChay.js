import { khop, khopNhieu } from '../../../utils/timKiem';
import { trongKhoangNgay } from '../../../utils/format';
import { hopChipChuyen } from '../../../utils/khuChuyen';
import { khoaNgcLenh } from '../../../utils/nhaGiaCong';
// Mig 126: lệnh IN và lệnh ÉP ỦI của cùng phần in 2 công đoạn KHÔNG gom chung 1 dòng (khóa thêm công đoạn).
import { khoaCongDoan } from '../../../utils/luongSanXuat';

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

// ─────────────────────────────────────────────────────────────────────────────
// GOM DÒNG CHỜ CHẠY THEO CODE PHẦN (13/10/2026, người dùng chốt: "có 2 code phần trùng nhau thì gom số lượng
// release lại"). 1 phần in có 2–3 lệnh chờ chạy (mỗi đợt vải release ra 1 lệnh) ⇒ bảng Chờ chạy hiện 1 DÒNG, SL
// release = TỔNG các lệnh. Chỉ là cách HIỆN: mỗi lệnh vẫn là 1 lệnh riêng (`_lenh` giữ đủ) — tích / xác nhận chạy
// / trả về của dòng gom áp cho MỌI lệnh trong `_lenh`.
//   · Chỉ gom lệnh ĐÚNG 1 phần in; lệnh gom set cũ (nhiều phần in) đứng riêng.
//   · 22/10/2026 (người dùng: "code phần giống nhau và cùng chuyền kế hoạch thì gom 1 hàng"): khóa = phần in + CHUYỀN
//     KẾ HOẠCH của lệnh (`chuyen_id`) — cùng code phần nhưng kế hoạch 2 chuyền khác nhau là 2 dòng. Dòng gom hiện như
//     1 phần (1 số SL release tổng, không badge / dòng tách — như bảng Đang chạy).
//   · Thứ tự: dòng gom đứng ở vị trí lệnh ĐẦU của nó. Dòng trả về luôn có `_lenh` (dòng lẻ = mảng 1 phần tử).
//   · Số gộp: SL release · đã in trước đó · số đợt vải = tổng; ngày SX KH · hạn giao = SỚM nhất; mã lệnh · tên
//     chuyền · nhà gia công = danh sách không trùng. `ma_chuyen` / `ma_loai_chuyen` / `id` giữ của lệnh đầu.
const tongCot = (ds, k) => ds.reduce((a, r) => a + (Number(r[k]) || 0), 0);

// ─────────────────────────────────────────────────────────────────────────────
// SỐ LƯỢNG / BỔ SUNG (26/11/2026, người dùng: "Xác nhận chạy tách 2 dòng nếu là bổ sung và số lượng — đang gộp số lượng vào
//   nhau; thêm badge cạnh khách hàng để biết là số lượng hay bổ sung"). BE trả `sl_release_bs` (phần SL release thuộc đợt mã
//   loại `BO_SUNG`) + `da_in_truoc_bs` (Chờ chạy) / `printed_bs` · `so_tem_bs` (Đang chạy) = SL bổ sung CỦA TEM đã in.
//   · `loaiSlBs(r, cotSl)` = 'SL' (không phần bổ sung) · 'BS' (toàn bổ sung) · 'MIX' (lệnh lẫn cả hai — vd đợt bổ sung "cộng
//     thẳng vào lệnh đang chạy"). Hai hàm gom dưới KHÓA THÊM loại ⇒ lệnh bổ sung và lệnh số lượng cùng code phần là 2 dòng.
//   · `dongConSlBs(r, kieu)` = 2 dòng con (dòng SL + dòng BS) cho dòng 'MIX' (bảng `subRows` — chỉ là cách HIỆN, tích / chạy /
//     mở vẫn theo cả lệnh). Thiếu trường (BE cũ) ⇒ mọi dòng 'SL', không tách.
const soN = (v) => Number(v) || 0;
export const loaiSlBs = (r, cotSl = 'so_luong_release') => {
  const t = soN(r && r[cotSl]);
  const bs = Math.min(soN(r && r.sl_release_bs), t);
  if (bs <= 0) return 'SL';
  return bs >= t ? 'BS' : 'MIX';
};
// `kieu` 'CHO' (Chờ chạy — cột SL release) · 'CHAY' (Đang chạy — đã in / SL release / số tem). Trả null nếu không tách.
export function dongConSlBs(r, kieu = 'CHO') {
  const cotSl = kieu === 'CHAY' ? 'target' : 'so_luong_release';
  if (loaiSlBs(r, cotSl) !== 'MIX') return null;
  const t = soN(r[cotSl]);
  const bs = Math.min(soN(r.sl_release_bs), t);
  if (kieu === 'CHAY') {
    const inBs = Math.min(soN(r.printed_bs), soN(r.printed));
    const temBs = Math.min(soN(r.so_tem_bs), soN(r.so_tem));
    return [
      { __loaiSl: 'SL', __thu: 0, target: t - bs, printed: soN(r.printed) - inBs, so_tem: soN(r.so_tem) - temBs },
      { __loaiSl: 'BS', __thu: 1, target: bs, printed: inBs, so_tem: temBs },
    ];
  }
  const daBs = Math.min(soN(r.da_in_truoc_bs), soN(r.da_in_truoc));
  return [
    { __loaiSl: 'SL', __thu: 0, so_luong_release: t - bs, da_in_truoc: soN(r.da_in_truoc) - daBs },
    { __loaiSl: 'BS', __thu: 1, so_luong_release: bs, da_in_truoc: daBs },
  ];
}
// ĐANG CHẠY — LỆNH LẪN SỐ LƯỢNG + BỔ SUNG THÀNH 2 DÒNG THẬT (26/11/2026, người dùng chọn "1 lệnh, 2 dòng làm riêng": Kế hoạch
//   vẫn gộp như cũ, chỉ ở Sản xuất mỗi phần 1 dòng có ô tích + nút Mở riêng; mở dòng BS ⇒ sidebar làm phần bổ sung — `RunPanel
//   phan`). Mỗi dòng mang `_khoa` (khóa tích / React: phiếu, phần BS thêm "#BS") + `__phan`; số đã in / SL release / số tem của
//   phần (như `dongConSlBs`). Dòng phần mang lại `sl_release_bs` / `printed_bs` khớp phần ⇒ `loaiSlBs` ra 'SL' / 'BS' ⇒ gom dòng
//   cùng code phần đi đúng nhóm. Lệnh gom set (nhiều phần in) không tách.
export function tachPhanSlBsChay(rows) {
  const out = [];
  (rows || []).forEach((r) => {
    const sub = !(r.phan_in_list && r.phan_in_list.length > 1) ? dongConSlBs(r, 'CHAY') : null;
    if (!sub) { out.push({ ...r, _khoa: r.phieu_id }); return; }
    const [sl, bs] = sub;
    out.push({ ...r, ...sl, __thu: undefined, _khoa: r.phieu_id, __phan: 'SL', sl_release_bs: 0, printed_bs: 0, so_tem_bs: 0 });
    out.push({ ...r, ...bs, __thu: undefined, _khoa: `${r.phieu_id}#BS`, __phan: 'BS',
      sl_release_bs: bs.target, printed_bs: bs.printed, so_tem_bs: bs.so_tem });
  });
  return out;
}

// Loại để vẽ badge của 1 dòng bảng (dòng con đã tách mang sẵn `__loaiSl`). ⚠ Máy chủ CHƯA có bản 26/11 (lệnh thiếu hẳn trường
//   `sl_release_bs`) ⇒ null = KHÔNG vẽ badge — không thì mọi dòng hiện "SL", kể cả lệnh bổ sung (người dùng thấy 26/11 khi BE chưa
//   chạy commit mới). Dòng gom đọc lệnh ĐẦU (`tongCot` của dòng gom luôn ra số).
export const loaiBadgeSlBs = (r, kieu = 'CHO') => {
  if (!r) return null;
  if (r.__loaiSl) return r.__loaiSl;
  const goc = r._lenh && r._lenh.length ? r._lenh[0] : r;
  if (goc.sl_release_bs === undefined) return null;
  return loaiSlBs(r, kieu === 'CHAY' ? 'target' : 'so_luong_release');
};
const khacNhau = (ds, k) => [...new Set(ds.map((r) => r[k]).filter(Boolean))];
const somNhat = (ds, k) => ds.map((r) => r[k]).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null;
//   · 27/10/2026 (người dùng chốt): khóa thêm NHÀ GIA CÔNG của lệnh (`khoaNgcLenh`) — đợt khác NGC không cộng chung.
export function gomTheoCodePhan(rows) {
  const nhom = new Map();
  const out = [];
  for (const r of rows || []) {
    const motPin = !(r.phan_in_list && r.phan_in_list.length > 1);
    const pin = r.phan_in_id || r.ma_phan || '';
    const k = motPin && pin ? `${pin}|${r.chuyen_id || r.ma_chuyen || ''}|${khoaNgcLenh(r)}|${khoaCongDoan(r)}|${loaiSlBs(r)}` : '';
    const g = k ? nhom.get(k) : null;
    if (g) { g._lenh.push(r); continue; }
    const moi = { ...r, _lenh: [r] };
    if (k) nhom.set(k, moi);
    out.push(moi);
  }
  return out.map((g) => {
    const ds = g._lenh;
    if (ds.length === 1) return g;
    return {
      ...g,
      so_luong_release: tongCot(ds, 'so_luong_release'),
      sl_release_bs: tongCot(ds, 'sl_release_bs'),
      da_in_truoc: tongCot(ds, 'da_in_truoc'),
      da_in_truoc_bs: tongCot(ds, 'da_in_truoc_bs'),
      sl_nhan_vai: tongCot(ds, 'sl_nhan_vai'),
      so_dot_vai: tongCot(ds, 'so_dot_vai') || g.so_dot_vai,
      ma_lenh_san_xuat: khacNhau(ds, 'ma_lenh_san_xuat').join(', '),
      ten_chuyen: khacNhau(ds, 'ten_chuyen').join(' · '),
      nha_gia_cong: khacNhau(ds, 'nha_gia_cong').join(', '),
      ngay_ke_hoach: somNhat(ds, 'ngay_ke_hoach'),
      han_giao_hang: somNhat(ds, 'han_giao_hang'),
    };
  });
}
// Các lệnh của 1 dòng bảng Chờ chạy / Đang chạy (dòng gom hoặc dòng lẻ / dòng lệnh thô).
export const lenhCuaDong = (r) => (r && r._lenh && r._lenh.length ? r._lenh : (r ? [r] : []));

// ─────────────────────────────────────────────────────────────────────────────
// GOM DÒNG ĐANG CHẠY THEO CODE PHẦN + CHUYỀN (21/10/2026, người dùng: "cùng code phần, cùng máy thì gom số lượng
// lại thành 1 dòng" — ca thật SL-2609-001-A17-F02-C04: 3 đợt vải release 3 lần ⇒ 3 lệnh, bấm chạy chung 1 lượt từ
// dòng gom Chờ chạy ⇒ bảng Đang chạy hiện 3 dòng). Chỉ là cách HIỆN — mỗi lệnh vẫn là 1 lệnh + 1 phiếu riêng.
//   · Khóa = phần in + CHUYỀN THỰC TẾ của phiếu (`chuyen_id`) + NHÀ GIA CÔNG (27/10/2026) — cùng code phần chạy 2 máy
//     khác nhau, hoặc 2 đợt khác nhà gia công, vẫn 2 dòng.
//   · Chỉ gom lệnh ĐÚNG 1 phần in; lệnh gom set cũ đứng riêng. Dòng trả về luôn có `_lenh`.
//   · Số gộp: đã in · SL release · số tem · vải hủy · đợt vải = tổng; ngừng = BẤT KỲ phiếu đang ngừng; xác nhận chạy ·
//     ngày SX KH · hạn giao = sớm nhất; mã lệnh = danh sách. `phieu_id` / `lenh_id` giữ của lệnh đầu (khóa dòng).
export function gomDangChayTheoCodePhan(rows) {
  const nhom = new Map();
  const out = [];
  for (const r of rows || []) {
    const motPin = !(r.phan_in_list && r.phan_in_list.length > 1);
    const pin = r.phan_in_id || r.ma_phan || '';
    const k = motPin && pin ? `${pin}|${r.chuyen_id || r.ma_chuyen || ''}|${khoaNgcLenh(r)}|${khoaCongDoan(r)}|${loaiSlBs(r, 'target')}` : '';
    const g = k ? nhom.get(k) : null;
    if (g) { g._lenh.push(r); continue; }
    const moi = { ...r, _lenh: [r] };
    if (k) nhom.set(k, moi);
    out.push(moi);
  }
  return out.map((g) => {
    const ds = g._lenh;
    if (ds.length === 1) return g;
    return {
      ...g,
      printed: tongCot(ds, 'printed'),
      printed_bs: tongCot(ds, 'printed_bs'),
      target: tongCot(ds, 'target'),
      sl_release_bs: tongCot(ds, 'sl_release_bs'),
      sl_nhan_vai: tongCot(ds, 'sl_nhan_vai'),
      so_tem: tongCot(ds, 'so_tem'),
      so_tem_bs: tongCot(ds, 'so_tem_bs'),
      sl_vai_huy: tongCot(ds, 'sl_vai_huy'),
      so_dot_vai: tongCot(ds, 'so_dot_vai') || g.so_dot_vai,
      dang_ngung: ds.some((r) => r.dang_ngung),
      ma_lenh_san_xuat: khacNhau(ds, 'ma_lenh_san_xuat').join(', '),
      nha_gia_cong: khacNhau(ds, 'nha_gia_cong').join(', '),
      tg_bd: somNhat(ds, 'tg_bd'),
      ngay_ke_hoach: somNhat(ds, 'ngay_ke_hoach'),
      han_giao_hang: somNhat(ds, 'han_giao_hang'),
    };
  });
}

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
