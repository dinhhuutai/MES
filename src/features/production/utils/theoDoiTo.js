// ─────────────────────────────────────────────────────────────────────────────
// THEO DÕI SẢN XUẤT THEO TỔ (21/10/2026) — hàm thuần dựng 3 tầng Tổng nhà máy → Tổ → Chuyền → Lệnh từ dữ liệu MỨC
// LỆNH của `GET /production/theo-doi-to` (luật lấy số: backend `production/theoDoiTo.js`). Mọi tầng cộng từ cùng
// một danh sách ⇒ Σ chuyền = tổ, Σ tổ = tổng nhà máy.
//   · Kế hoạch của lệnh tính cho CHUYỀN KẾ HOẠCH (`chuyen_kh_id`); thực tế tính theo CHUYỀN CHẠY của từng tem
//     (`tt[].chuyen_id`) ⇒ lệnh đổi chuyền có thể hiện ở 2 chuyền (kế hoạch 1 bên, thực tế bên kia).
//   · Chuyền chưa gán tổ (mig 117 chưa chạy / chưa chọn tổ) gom "Chưa gán tổ" — chỉ hiện khi có số.
// ─────────────────────────────────────────────────────────────────────────────

// 24 ô giờ của 1 ngày sản xuất, bắt đầu 06:00 (ngày SX 06:00 → 06:00 hôm sau).
export const GIO_NGAY_SX = [...Array.from({ length: 18 }, (_, i) => i + 6), 0, 1, 2, 3, 4, 5];

const so = (v) => Number(v) || 0;
export const phanTram = (tt, kh) => (kh > 0 ? (tt / kh) * 100 : null);

// Tên tổ hiển thị: danh mục tổ in lưu "TO 1" (theo phòng CSX) ⇒ "Tổ 1".
export const tenTo = (t) => (t ? String(t.ten_to || t.ma_to || '').replace(/^TO\s*/i, 'Tổ ') : 'Chưa gán tổ');

// Thứ tự chuyền: Máy → Máy tròn → Bàn → Robot → Ép → Logo → khác; trong cùng loại so mã tự nhiên (M2 < M10).
const THU_TU_LOAI = ['MAY', 'MAY_TRON', 'BAN', 'ROBOT', 'EP', 'LOGO'];
const hangLoai = (l) => { const i = THU_TU_LOAI.indexOf(l || ''); return i < 0 ? 99 : i; };
const soSanhChuyen = (a, b) => hangLoai(a.ma_loai) - hangLoai(b.ma_loai)
  || String(a.ma_chuyen || '').localeCompare(String(b.ma_chuyen || ''), 'vi', { numeric: true });

// CHIA KẾ HOẠCH THEO GIỜ: SL kế hoạch của lệnh rải đều theo PHÚT trong khoảng giờ BĐ → KT kế hoạch, gom về từng giờ
// đồng hồ (06…05). Làm tròn kiểu "phần dư lớn nhất" ⇒ Σ các giờ = đúng SL kế hoạch. Thiếu giờ / KT ≤ BĐ ⇒ null.
export function chiaGioKeHoach(kh, bd, kt) {
  const sl = so(kh);
  if (!sl || !bd || !kt) return null;
  const t0 = new Date(bd).getTime();
  let t1 = new Date(kt).getTime();
  if (!(t1 > t0)) return null;
  t1 = Math.min(t1, t0 + 24 * 3600000);
  const phut = {};
  let t = t0;
  while (t < t1) {
    const d = new Date(t);
    const cuoiGio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const den = Math.min(cuoiGio, t1);
    phut[d.getHours()] = (phut[d.getHours()] || 0) + (den - t) / 60000;
    t = den;
  }
  const tong = Object.values(phut).reduce((a, b) => a + b, 0);
  const tho = Object.entries(phut).map(([g, p]) => ({ g: Number(g), v: (sl * p) / tong }));
  const ra = Object.fromEntries(tho.map((x) => [x.g, Math.floor(x.v)]));
  let du = sl - Object.values(ra).reduce((a, b) => a + b, 0);
  tho.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  for (let i = 0; du > 0 && tho.length; i = (i + 1) % tho.length, du -= 1) ra[tho[i].g] += 1;
  return ra;
}

// Dựng cây. Trả { tong: {kh, tt}, to: [{ id, ten, kh, tt, chuyen: [{ id, ma_chuyen, ten_chuyen, kh, tt, lenh: [...] }] }] }.
export function dungTheoDoiTo(data) {
  const d = data || {};
  const toTheoId = new Map((d.to || []).map((t) => [t.id, t]));
  const chuyen = new Map((d.chuyen || []).map((c) => [c.id, {
    ...c, kh: 0, tt: 0, lenhMap: new Map(),
  }]));
  const dongLenh = (c, l) => {
    if (!c.lenhMap.has(l.lenh_id)) {
      c.lenhMap.set(l.lenh_id, {
        lenh_id: l.lenh_id, ma_lenh_san_xuat: l.ma_lenh_san_xuat, trang_thai: l.trang_thai,
        ten_khach_hang: l.ten_khach_hang, ma_don_hang: l.ma_don_hang, ma_hang: l.ma_hang,
        ma_phan: l.phan_list || l.ma_phan, mau_vai: l.mau_vai, kich_vai: l.kich_vai, kich_phim: l.kich_phim,
        tg_bd_kh: l.tg_bd_kh, tg_kt_kh: l.tg_kt_kh, ngay_kh: l.ngay_kh,
        la_ke_hoach: false, kh: 0, tt: 0, khGio: null, ttGio: {},
      });
    }
    return c.lenhMap.get(l.lenh_id);
  };
  for (const l of d.lenh || []) {
    if (l.la_ke_hoach && chuyen.has(l.chuyen_kh_id)) {
      const c = chuyen.get(l.chuyen_kh_id);
      const x = dongLenh(c, l);
      x.la_ke_hoach = true;
      x.kh = so(l.so_luong_release);
      x.khGio = chiaGioKeHoach(x.kh, l.tg_bd_kh, l.tg_kt_kh);
      c.kh += x.kh;
    }
    for (const t of l.tt || []) {
      const c = chuyen.get(t.chuyen_id);
      if (!c) continue;
      const x = dongLenh(c, l);
      x.tt += so(t.sl);
      x.ttGio[t.gio] = (x.ttGio[t.gio] || 0) + so(t.sl);
      c.tt += so(t.sl);
    }
  }
  const sapLenh = (a, b) => (a.tg_bd_kh ? new Date(a.tg_bd_kh).getTime() : Infinity)
    - (b.tg_bd_kh ? new Date(b.tg_bd_kh).getTime() : Infinity)
    || String(a.ma_lenh_san_xuat || '').localeCompare(String(b.ma_lenh_san_xuat || ''), 'vi', { numeric: true });

  const nhom = new Map();
  for (const c of chuyen.values()) {
    const coSo = c.kh > 0 || c.tt > 0;
    const toId = (c.to_in_id && toTheoId.has(c.to_in_id)) ? c.to_in_id : null;
    // Chuyền tắt mà không có số ⇒ ẩn; "Chưa gán tổ" chỉ giữ chuyền có số.
    if ((!c.dang_hoat_dong || !toId) && !coSo) continue;
    if (!nhom.has(toId)) nhom.set(toId, []);
    const { lenhMap, ...thong } = c;
    nhom.get(toId).push({ ...thong, lenh: [...lenhMap.values()].sort(sapLenh) });
  }
  const to = [...nhom.entries()].map(([id, ds]) => {
    const t = id ? toTheoId.get(id) : null;
    return {
      id, ma_to: t ? t.ma_to : null, ten: tenTo(t),
      kh: ds.reduce((a, c) => a + c.kh, 0), tt: ds.reduce((a, c) => a + c.tt, 0),
      chuyen: ds.sort(soSanhChuyen),
    };
  }).sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1)
    || String(a.ma_to || '').localeCompare(String(b.ma_to || ''), 'vi', { numeric: true }));
  return { tong: { kh: to.reduce((a, t) => a + t.kh, 0), tt: to.reduce((a, t) => a + t.tt, 0) }, to };
}
