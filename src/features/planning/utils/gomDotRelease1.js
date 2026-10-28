// ─────────────────────────────────────────────────────────────────────────────
// RELEASE 1 — GOM CÁC ĐỢT VẢI CÙNG CODE PHẦN THÀNH 1 DÒNG (18/10/2026, người dùng: "1 code phần mà có nhiều đợt vải ở
// Release 1 thì tự động cho gom số lượng lại").
//
// · 1 dòng = các đợt CÙNG phần in + CÙNG tình trạng Ready (Đã Ready / Chờ Ready — release vs lưu Kế hoạch tạm khác
//   đường). 27/10/2026: mọi lệnh qua Test Run ⇒ đợt bổ sung 5I / mẫu SL 6I gom CHUNG với đợt thường (gương BE
//   `planning.service createRelease1` nhóm `nhomLenh`).
// · Cột số = TỔNG (SL vải về · đã release · còn release); ngày nhận vải / hạn giao = SỚM NHẤT; loại đợt · nhà gia công
//   · mã đợt = danh sách không trùng. `_dots` giữ đủ đợt — release / chọn / trả về đều thao tác trên MỌI đợt của dòng;
//   BE gộp các đợt cùng phần in vào 1 lệnh.
// · ⚠ 27/10/2026 (người dùng chốt): đợt KHÁC NHÀ GIA CÔNG (ERP NGC) không gom — khóa thêm `nha_gia_cong` (gương BE).
// · Giữ vị trí của đợt xuất hiện ĐẦU (không sắp lại bảng).
// Hàm thuần, không phụ thuộc React.
// ─────────────────────────────────────────────────────────────────────────────
import { khoaNgc } from '../../../utils/nhaGiaCong';

const khoaNhom = (r) => `${r.phan_in_id}|${r.qc_done ? 'R' : 'C'}|${khoaNgc(r.nha_gia_cong)}`;
const dsKhongTrung = (ds) => [...new Set(ds.filter((x) => x != null && String(x).trim() !== '').map(String))].join(', ');
const nho = (a, b) => (!a ? b : !b ? a : (String(a) <= String(b) ? a : b));
const cong = (ds, k) => ds.reduce((s, r) => s + (Number(r[k]) || 0), 0);

export function gomDotCungCodePhan(rows) {
  const nhom = new Map();
  (rows || []).forEach((r) => {
    const k = khoaNhom(r);
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push(r);
  });
  return [...nhom.entries()].map(([k, ds]) => {
    const dau = ds[0];
    if (ds.length === 1) return { ...dau, _key: dau.dot_vai_id, _dots: ds };
    return {
      ...dau,
      _key: `G:${k}`,
      _dots: ds,
      so_luong_vai_ve: cong(ds, 'so_luong_vai_ve'),
      da_release: cong(ds, 'da_release'),
      con_release: ds.reduce((s, r) => s + (Number(r.con_release ?? r.so_luong_vai_ve) || 0), 0),
      ngay_vai_ve: ds.map((r) => r.ngay_vai_ve).reduce(nho, null),
      han_giao_hang: ds.map((r) => r.han_giao_hang).reduce(nho, null),
      loai_dot_vai: dsKhongTrung(ds.map((r) => r.loai_dot_vai)),
      nha_gia_cong: dsKhongTrung(ds.map((r) => r.nha_gia_cong)) || null,
      ma_dot_vai: dsKhongTrung(ds.map((r) => r.ma_dot_vai)),
      ma_set: dau.ma_set || ds.find((r) => r.ma_set)?.ma_set || null,
      tra_ve: dau.tra_ve || ds.find((r) => r.tra_ve)?.tra_ve || null,
      tra_ve_ly_do: dau.tra_ve_ly_do || ds.find((r) => r.tra_ve_ly_do)?.tra_ve_ly_do || null,
      btp_khac_kh: ds.some((r) => r.btp_khac_kh), // BTP khác KH (mig 120) — có đợt nào có cờ
    };
  });
}

export const dotIdsCuaDong = (g) => (g?._dots || (g ? [g] : [])).map((r) => r.dot_vai_id);

// Trạng thái SLA của dòng gom = đợt TỆ NHẤT (Nghẽn > Sắp nghẽn > còn lại).
const HANG_SLA = { NGHEN: 2, SAP_NGHEN: 1 };
export function slaCuaDong(g, statusDot) {
  let tot = null;
  (g?._dots || [g]).forEach((r) => {
    const s = statusDot(r.dot_vai_id);
    if (tot == null || (HANG_SLA[s] || 0) > (HANG_SLA[tot] || 0)) tot = s;
  });
  return tot;
}
