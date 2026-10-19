// ─────────────────────────────────────────────────────────────────────────────
// GOM BẢNG BÁO CÁO THEO CHIỀU XEM (11/10/2026) — dùng chung 3 trang Báo cáo sản xuất · kiểm hàng · sửa hàng.
// Người dùng yêu cầu thêm chiều THỢ IN · TỪNG CHUYỀN (chọn được chuyền) · KHÁCH HÀNG · CHI TIẾT cho cả 3 báo cáo.
// Backend trả sẵn `theo_khach` / `theo_tho` / `theo_chuyen` (cả xưởng), nhưng khi người dùng CHỌN CHUYỀN thì mọi
// bảng phải tính lại trên tập chuyền đã chọn ⇒ trang tự gom từ dòng CHI TIẾT bằng các hàm thuần dưới đây (cùng
// công thức backend: `utils/baoCaoSanXuat.js` · `baoCaoKiemHang.js` · `baoCaoSuaHang.js gomDong`).
// "Thợ in" = THỢ PHỤ TRÁCH của phiếu (người đầu danh sách; chuyền Máy lấy chuyền trưởng) — backend đã gắn `tho`.
// ─────────────────────────────────────────────────────────────────────────────

export const NHOM_DAY_CHUYEN = [
  { key: 'MTD', label: 'MTD' }, { key: 'BANIN', label: 'Banin' }, { key: 'RB', label: 'RB' },
  { key: 'MT', label: 'MT' }, { key: 'LG', label: 'LG' }, { key: 'MEP', label: 'MEP' },
];
const NHAN_NHOM = { ...Object.fromEntries(NHOM_DAY_CHUYEN.map((n) => [n.key, n.label])), KHAC: 'Khác' };
export const nhanNhom = (k) => NHAN_NHOM[k] || k || '—';

export const soTuNhien = (a, b) => String(a || '').localeCompare(String(b || ''), 'vi', { numeric: true, sensitivity: 'base' });

// Chiều xem dùng chung (khóa + nhãn của 1 dòng chi tiết). `CT` (chi tiết phần in) mỗi trang tự dựng cột.
export const CHIEU = {
  KH: { ten: 'Khách hàng', khoa: (r) => r.khach || '(Chưa rõ khách)' },
  TH: { ten: 'Thợ in', khoa: (r) => r.tho || 'Chưa phân công' },
  CH: { ten: 'Chuyền', khoa: (r) => r.ma_chuyen || '—' },
};

// Danh sách chuyền có mặt trong dữ liệu ⇒ [{ ma, ten, nhom }] xếp theo dây chuyền rồi mã tự nhiên.
export function dsChuyen(rows) {
  const m = new Map();
  (rows || []).forEach((r) => {
    const ma = r.ma_chuyen || '—';
    if (!m.has(ma)) m.set(ma, { ma, ten: r.ten_chuyen || '', nhom: r.nhom || 'KHAC' });
  });
  const viTri = (k) => { const i = NHOM_DAY_CHUYEN.findIndex((n) => n.key === k); return i < 0 ? 99 : i; };
  return [...m.values()].sort((a, b) => viTri(a.nhom) - viTri(b.nhom) || soTuNhien(a.ma, b.ma));
}
// Lọc theo bộ chọn chuyền (`chon` = mảng mã chuyền, rỗng = mọi chuyền).
export const locChuyen = (rows, chon) => (chon && chon.length
  ? (rows || []).filter((r) => chon.includes(r.ma_chuyen || '—')) : (rows || []));

// ═══ BÁO CÁO SẢN XUẤT — mỗi dòng mang `m` = { TONG|HC|CA1|CA2|CA3: { kh, tt, gk, gt } } ═══
const CA = ['TONG', 'HC', 'CA1', 'CA2', 'CA3'];
const mRong = () => Object.fromEntries(CA.map((c) => [c, { kh: 0, tt: 0, gk: 0, gt: 0 }]));
const congM = (dich, m) => {
  CA.forEach((c) => { const o = (m || {})[c] || {}; ['kh', 'tt', 'gk', 'gt'].forEach((k) => { dich[c][k] += Number(o[k]) || 0; }); });
};
export function tongSanXuat(rows) {
  const t = mRong();
  (rows || []).forEach((r) => congM(t, r.m));
  return t;
}
// ⇒ [{ key, label, m }] xếp theo nhãn. `khoa(r)` trả khóa (cũng là nhãn).
export function gomSanXuat(rows, khoa) {
  const m = new Map();
  (rows || []).forEach((r) => {
    const k = khoa(r);
    if (!m.has(k)) m.set(k, mRong());
    congM(m.get(k), r.m);
  });
  return [...m.entries()].sort((a, b) => soTuNhien(a[0], b[0])).map(([key, mm]) => ({ key, label: key, m: mm }));
}
const tachThoDs = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
// BÁO CÁO SẢN XUẤT "Theo thợ in" (19/10/2026 người dùng chốt): dòng chi tiết mang CẢ danh sách thợ in phân công
// (`tho_ds`) ⇒ số của dòng CHIA ĐỀU cho số người — KH + giờ chia thẳng; SL in TT chia số nguyên, phần lẻ của ca sau
// tiếp từ người kế người nhận lẻ cuối của ca trước (tổng mỗi người chênh ≤ 1 pcs); cột Tổng = Σ các ca đã chia.
// Gương BE `utils/baoCaoSanXuat.js chiaBo` (chia trên CÙNG dòng chi tiết).
export function gomSanXuatTheoTho(rows) {
  const out = new Map();
  (rows || []).forEach((r) => {
    const ds = tachThoDs(r.tho_ds);
    const tho = ds.length ? ds : [r.tho || 'Chưa phân công'];
    const n = tho.length;
    const phan = tho.map(() => mRong());
    let ke = 0;
    ['HC', 'CA1', 'CA2', 'CA3'].forEach((c) => {
      const o = (r.m || {})[c] || {};
      const tt = Number(o.tt) || 0;
      const nguyen = Number.isInteger(tt) && tt >= 0;
      const co = Math.floor(tt / n);
      const du = nguyen ? tt - co * n : 0;
      phan.forEach((p, i) => {
        p[c].tt = nguyen ? co + ((i - ke + n) % n < du ? 1 : 0) : tt / n;
        ['kh', 'gk', 'gt'].forEach((f) => { p[c][f] = (Number(o[f]) || 0) / n; });
        ['kh', 'tt', 'gk', 'gt'].forEach((f) => { p.TONG[f] += p[c][f]; });
      });
      ke = (ke + du) % n;
    });
    tho.forEach((t, i) => {
      if (!out.has(t)) out.set(t, mRong());
      congM(out.get(t), phan[i]);
    });
  });
  return [...out.entries()].sort((a, b) => soTuNhien(a[0], b[0])).map(([key, mm]) => ({ key, label: key, m: mm }));
}
// Bảng "Theo khu chuyền": đủ 6 dây chuyền (kể cả dòng trống) + "Khác" khi có số.
export function gomSanXuatTheoNhom(rows) {
  const theo = new Map(gomSanXuat(rows, (r) => r.nhom || 'KHAC').map((x) => [x.key, x.m]));
  const ds = [...NHOM_DAY_CHUYEN, ...(theo.has('KHAC') ? [{ key: 'KHAC', label: 'Khác' }] : [])];
  return ds.map((n) => ({ key: n.key, label: n.label, m: theo.get(n.key) || mRong() }));
}

// ═══ BÁO CÁO KIỂM HÀNG — dòng chi tiết = 1 lượt KCS { sl_kiem, sl_dat, sl_sua, sl_huy, tem_id } ═══
const tyLe = (tu, mau) => (mau > 0 ? tu / mau : null);
const chotKiem = (t) => ({
  ...t,
  ty_le_dat: tyLe(t.sl_dat, t.sl_kiem), ty_le_sua: tyLe(t.sl_sua, t.sl_kiem), ty_le_huy: tyLe(t.sl_huy, t.sl_kiem),
  ty_le_khong_dat: tyLe(t.sl_sua + t.sl_huy, t.sl_kiem),
});
export function tongKiemHang(rows) {
  const t = { sl_kiem: 0, sl_dat: 0, sl_sua: 0, sl_huy: 0, so_luot: 0 };
  const tem = new Set();
  (rows || []).forEach((l) => {
    t.sl_kiem += Number(l.sl_kiem) || 0; t.sl_dat += Number(l.sl_dat) || 0;
    t.sl_sua += Number(l.sl_sua) || 0; t.sl_huy += Number(l.sl_huy) || 0; t.so_luot += 1;
    tem.add(l.tem_id);
  });
  return chotKiem({ ...t, so_tem: tem.size });
}
export function gomKiemHang(rows, khoa) {
  const m = new Map();
  (rows || []).forEach((l) => { const k = khoa(l); if (!m.has(k)) m.set(k, []); m.get(k).push(l); });
  return [...m.entries()].sort((a, b) => soTuNhien(a[0], b[0])).map(([key, ds]) => ({ key, ten: key, ...tongKiemHang(ds) }));
}
// Bảng lồng Dây chuyền → Chuyền (như backend): % không đạt TĂNG dần, hòa thì theo tên.
export function dayChuyenKiemHang(rows) {
  const xep = (a, b) => (a.ty_le_khong_dat ?? 0) - (b.ty_le_khong_dat ?? 0) || soTuNhien(a.ten || a.ma_chuyen, b.ten || b.ma_chuyen);
  return gomKiemHang(rows, (l) => l.nhom || 'KHAC').map((n) => {
    const ds = (rows || []).filter((l) => (l.nhom || 'KHAC') === n.key);
    const tenChuyen = new Map(ds.map((l) => [l.ma_chuyen || '—', l.ten_chuyen || null]));
    return {
      ...n, nhom: n.key, ten: nhanNhom(n.key),
      chuyen: gomKiemHang(ds, (l) => l.ma_chuyen || '—')
        .map((c) => ({ ...c, ma_chuyen: c.key === '—' ? null : c.key, ten_chuyen: tenChuyen.get(c.key) })).sort(xep),
    };
  }).sort(xep);
}

// ═══ BÁO CÁO SỬA HÀNG — dòng chi tiết = 1 tem (kèm `pin_ids`, `nghen`, `gio_nghen`) — gương backend `gomDong` ═══
const COT_SUA = ['ton_dau', 'nhan', 'da_sua', 'chua_sua', 'kiem_ton_dau', 'kiem_nhan', 'kiem_dat', 'kiem_huy',
  'chua_kiem', 'ton_sua', 'ng_sl_xong', 'ng_sl_chua'];
export function tongSuaHang(tems) {
  const x = Object.fromEntries(COT_SUA.map((k) => [k, 0]));
  x.so_tem = 0;
  const pin = new Map(); // phần in → { chua, xong, gio }
  (tems || []).forEach((t) => {
    COT_SUA.forEach((k) => { x[k] += Number(t[k]) || 0; });
    x.so_tem += 1;
    if (!t.nghen) return;
    (t.pin_ids && t.pin_ids.length ? t.pin_ids : [`tem:${t.tem_id}`]).forEach((p) => {
      const o = pin.get(p) || { chua: false, xong: false, gio: 0 };
      if (t.nghen === 'CHUA') o.chua = true; else o.xong = true;
      o.gio = Math.max(o.gio, Number(t.gio_nghen) || 0);
      pin.set(p, o);
    });
  });
  let chua = 0; let xong = 0; let gio = 0;
  pin.forEach((o) => { if (o.chua) chua += 1; else if (o.xong) xong += 1; gio += o.gio; });
  return {
    ...x, ng_phan: chua + xong, ng_sl: x.ng_sl_xong + x.ng_sl_chua, ng_gio: Math.round(gio * 100) / 100,
    ng_phan_xong: xong, ng_phan_chua: chua,
  };
}
export function gomSuaHang(tems, khoa) {
  const m = new Map();
  (tems || []).forEach((t) => { const k = khoa(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
  return [...m.entries()].sort((a, b) => soTuNhien(a[0], b[0])).map(([key, ds]) => ({ key, ten: key, ...tongSuaHang(ds) }));
}
// Bảng lồng Dây chuyền → Chuyền: đủ 6 dây chuyền của tờ xưởng (kể cả dòng trống) + "Khác" khi có tem.
export function dayChuyenSuaHang(tems) {
  const coKhac = (tems || []).some((t) => (t.nhom || 'KHAC') === 'KHAC');
  const ds = [...NHOM_DAY_CHUYEN.map((n) => ({ ...n, label: n.key === 'BANIN' ? 'Bàn in' : n.label })),
    ...(coKhac ? [{ key: 'KHAC', label: 'Khác' }] : [])];
  return ds.map((n) => {
    const cua = (tems || []).filter((t) => (t.nhom || 'KHAC') === n.key);
    const tenChuyen = new Map(cua.map((t) => [t.ma_chuyen || '—', t.ten_chuyen || null]));
    return {
      nhom: n.key, ten: n.label, ...tongSuaHang(cua),
      chuyen: gomSuaHang(cua, (t) => t.ma_chuyen || '—')
        .map((c) => ({ ...c, ma_chuyen: c.key === '—' ? null : c.key, ten_chuyen: tenChuyen.get(c.key) })),
    };
  });
}
