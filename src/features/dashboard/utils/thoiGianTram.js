// TỔNG HỢP THỜI GIAN TRẠM (Dashboard › Thời gian trạm — 15/09/2026).
// ⚠ Thuần JS, KHÔNG import gì ⇒ kiểm thực được bằng Node thuần.
// Đầu vào: `rows` = danh sách ĐƠN VỊ của backend (`/thoi-gian-tram`), mỗi dòng
//   { ma_tram, phan_in_id, don_vi, ma_dot_vai, tg_vao, tg_ra, phut, …thông tin phần in }.
//
// ⚠⚠ LUẬT GỘP KHOẢNG (dùng cho mức PHẦN IN và ĐỢT VẢI) = đúng luật `gomTheo` của sĩ số:
//   vào = mốc SỚM NHẤT · ra = CHỈ KHI MỌI đơn vị con đã rời (còn 1 cái chưa rời ⇒ đang ở).
//   ⚠ KHÔNG CỘNG thời gian của các đơn vị con: 1 phần in có 2 lệnh cùng nằm ở Test Run song song thì
//   cộng lại là ĐẾM ĐÔI khoảng thời gian chồng nhau. Gộp khoảng mới đúng "phần in đã ở trạm bao lâu".

const phutGiua = (vao, ra, bayGio) => {
  const a = new Date(vao).getTime();
  const b = ra ? new Date(ra).getTime() : bayGio;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
};

// Trung vị / phân vị p (0..1) trên mảng số ĐÃ SẮP tăng dần — nội suy tuyến tính.
function phanVi(ds, p) {
  if (!ds.length) return null;
  const i = (ds.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(ds[lo] + (ds[hi] - ds[lo]) * (i - lo));
}

// Thống kê 1 tập đơn vị. `sla` null ⇒ không đếm quá SLA.
export function thongKe(ds, sla) {
  const phut = ds.map((r) => Number(r.phut)).filter(Number.isFinite).sort((a, b) => a - b);
  const roi = ds.filter((r) => r.tg_ra);
  const phutRoi = roi.map((r) => Number(r.phut)).filter(Number.isFinite);
  const tong = phut.reduce((s, v) => s + v, 0);
  const quaSla = sla ? ds.filter((r) => Number(r.phut) > sla).length : null;
  return {
    so_don_vi: ds.length,
    so_da_roi: roi.length,
    so_dang_o: ds.length - roi.length,
    so_phan_in: new Set(ds.map((r) => r.phan_in_id)).size,
    tong_phut: tong,
    tb_phut: phut.length ? Math.round(tong / phut.length) : null,
    tb_da_roi_phut: phutRoi.length ? Math.round(phutRoi.reduce((s, v) => s + v, 0) / phutRoi.length) : null,
    trung_vi_phut: phanVi(phut, 0.5),
    p90_phut: phanVi(phut, 0.9),
    min_phut: phut.length ? phut[0] : null,
    max_phut: phut.length ? phut[phut.length - 1] : null,
    qua_sla: quaSla,
    pt_qua_sla: sla && ds.length ? Math.round((quaSla / ds.length) * 1000) / 10 : null,
  };
}

// Mức TRẠM: 1 dòng / trạm, theo đúng thứ tự danh mục backend trả về.
export function tongHopTheoTram(rows, tramDs) {
  const theo = new Map();
  rows.forEach((r) => { const a = theo.get(r.ma_tram) || []; a.push(r); theo.set(r.ma_tram, a); });
  return tramDs.filter((t) => t.dang_xet !== false).map((t) => ({
    ...t, ...thongKe(theo.get(t.ma) || [], t.sla_phut),
  }));
}

// Gộp khoảng cho 1 nhóm đơn vị.
function gopKhoang(ds, bayGio) {
  let vao = null;
  let ra = null;
  let conO = false;
  ds.forEach((r) => {
    const v = new Date(r.tg_vao).getTime();
    if (vao === null || v < vao) vao = v;
    if (!r.tg_ra) conO = true;
    else { const x = new Date(r.tg_ra).getTime(); if (ra === null || x > ra) ra = x; }
  });
  const raCuoi = conO ? null : ra;
  return {
    tg_vao: vao === null ? null : new Date(vao).toISOString(),
    tg_ra: raCuoi === null ? null : new Date(raCuoi).toISOString(),
    phut: vao === null ? null : phutGiua(vao, raCuoi, bayGio),
    dang_o: conO,
    so_don_vi: ds.length,
  };
}

// Gom theo 1 khóa → mỗi nhóm có `tram[ma]` = khoảng đã gộp ở trạm đó + tổng qua các trạm.
//  · `tong_phut`      = Σ thời gian ở TỪNG trạm (các trạm có thể chồng thời gian — xem ghi chú §6).
//  · `dau_cuoi_phut`  = từ lúc VÀO trạm sớm nhất tới lúc RỜI trạm muộn nhất (đang ở trạm nào ⇒ tới bây giờ).
function gomTheoKhoa(dsRows, layKhoa, layThongTin, tramDs, bayGio) {
  const nhom = new Map();
  dsRows.forEach((r) => {
    layKhoa(r).forEach((k) => {
      let g = nhom.get(k);
      if (!g) { g = { key: k, ...layThongTin(r, k), _theoTram: new Map() }; nhom.set(k, g); }
      const a = g._theoTram.get(r.ma_tram) || [];
      a.push(r);
      g._theoTram.set(r.ma_tram, a);
    });
  });
  const slaCua = new Map(tramDs.map((t) => [t.ma, t.sla_phut]));
  return [...nhom.values()].map((g) => {
    const tram = {};
    let tong = 0;
    let vaoDau = null;
    let raCuoi = null;
    let conO = false;
    let quaSla = 0;
    g._theoTram.forEach((ds, ma) => {
      const k = gopKhoang(ds, bayGio);
      tram[ma] = k;
      tong += k.phut || 0;
      const sla = slaCua.get(ma);
      if (sla && k.phut > sla) quaSla += 1;
      const v = new Date(k.tg_vao).getTime();
      if (vaoDau === null || v < vaoDau) vaoDau = v;
      if (k.dang_o) conO = true;
      else { const x = new Date(k.tg_ra).getTime(); if (raCuoi === null || x > raCuoi) raCuoi = x; }
    });
    const { _theoTram, ...info } = g;
    return {
      ...info,
      tram,
      so_tram: g._theoTram.size,
      tong_phut: tong,
      dau_cuoi_phut: vaoDau === null ? null : phutGiua(vaoDau, conO ? null : raCuoi, bayGio),
      dang_o: conO,
      so_tram_qua_sla: quaSla,
    };
  });
}

const thongTinPin = (r) => ({
  phan_in_id: r.phan_in_id, ten_khach_hang: r.ten_khach_hang, ma_don_hang: r.ma_don_hang,
  ma_hang: r.ma_hang, ma_phan: r.ma_phan, mau_vai: r.mau_vai, kich_vai: r.kich_vai, kich_phim: r.kich_phim,
});

// Mức PHẦN IN.
export function theoPhanIn(rows, tramDs, bayGio = Date.now()) {
  return gomTheoKhoa(rows, (r) => [r.phan_in_id], thongTinPin, tramDs, bayGio)
    .sort((a, b) => b.tong_phut - a.tong_phut);
}

// Tách chuỗi đợt vải "A, B" ra mảng.
export const tachDot = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Mức ĐỢT VẢI. Đơn vị theo LỆNH/TEM mang danh sách đợt vải ⇒ tính cho TỪNG đợt trong danh sách.
// ⚠ 2 trạm READY đo ở mức PHẦN IN (khuôn/film/mực dùng chung mọi đợt vải — DATABASE.md §11.3) nên
//   KHÔNG có đợt vải: gắn vào MỌI đợt vải của phần in đó đang xuất hiện trong tập, nếu phần in không
//   có đợt nào trong tập thì đứng riêng 1 dòng "(mức phần in)".
export function theoDotVai(rows, tramDs, bayGio = Date.now()) {
  const dotCuaPin = new Map();
  rows.forEach((r) => {
    tachDot(r.ma_dot_vai).forEach((d) => {
      const s = dotCuaPin.get(r.phan_in_id) || new Set();
      s.add(d);
      dotCuaPin.set(r.phan_in_id, s);
    });
  });
  const layKhoa = (r) => {
    const ds = tachDot(r.ma_dot_vai);
    if (ds.length) return ds.map((d) => `${r.phan_in_id}|${d}`);
    const cua = dotCuaPin.get(r.phan_in_id);
    return cua && cua.size ? [...cua].map((d) => `${r.phan_in_id}|${d}`) : [`${r.phan_in_id}|`];
  };
  const thongTin = (r, k) => ({ ...thongTinPin(r), ma_dot_vai: k.split('|')[1] || '' });
  return gomTheoKhoa(rows, layKhoa, thongTin, tramDs, bayGio)
    .sort((a, b) => (a.ma_phan || '').localeCompare(b.ma_phan || '') || b.tong_phut - a.tong_phut);
}
