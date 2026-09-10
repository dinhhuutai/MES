// ─────────────────────────────────────────────────────────────────────────────
// KPI READY — luật GỘP DÒNG cho bảng theo dõi. Thuần JS (không import React) để chạy test bằng Node.
//
// Backend luôn trả **1 dòng / PHẦN IN**; hai chế độ xem dùng CHUNG một tập dữ liệu đó:
//   · "Chi tiết"  → vẽ thẳng, mỗi phần in 1 dòng.
//   · "Theo đơn"  → gộp về 1 dòng / ĐƠN HÀNG bằng `gopTheoDon`.
// ⚠⚠ Gộp Ở FE (không phải 2 endpoint) là CỐ Ý: 2 chế độ không thể ra 2 con số đá nhau, và bấm
//   toggle không phải gọi lại API.
//
// LUẬT GỘP THEO NHÓM CỘT:
//   · `moc` (mốc thời gian) → đếm số phần in ĐÃ QUA bước đó ⇒ hiện "x/N".
//   · `so`  (số lượng)      → CỘNG.
//   · `pt`  (phần trăm)     → **TÍNH LẠI** từ tử số/mẫu số đã cộng.
//     ⚠⚠ TUYỆT ĐỐI KHÔNG trung bình cộng % của các phần in con: phần in in 10 pcs và phần in in
//        10.000 pcs sẽ có trọng số như nhau ⇒ số ra vô nghĩa.
// ─────────────────────────────────────────────────────────────────────────────

// Ô số rỗng hiện `0`, ô % rỗng hiện `0%` — theo quy ước đã chốt ở màn *Danh sách phần in vải về*.
export const fmtPt = (v) => (v === null || v === undefined ? '0%' : `${Math.round(v * 10) / 10}%`);

// Tỉ lệ %, mẫu số 0 ⇒ null (bên gọi tự quyết hiện "0%" hay "—").
export const tyLe = (tu, mau) => (mau > 0 ? (tu / mau) * 100 : null);

const so = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Gộp giá trị của MỘT cột trên một tập dòng.
//   moc → { qua, tong }   · so → number   · pt → number|null
export function gopCot(cot, rows) {
  if (cot.nhom === 'moc') {
    return { qua: rows.filter((r) => r[cot.col]).length, tong: rows.length };
  }
  if (cot.nhom === 'so') return rows.reduce((s, r) => s + so(r[cot.col]), 0);
  const tu = rows.reduce((s, r) => s + so(r[cot.tuSo]), 0);
  const mau = rows.reduce((s, r) => s + so(r[cot.mauSo]), 0);
  return tyLe(tu, mau);
}

// Gộp danh sách phần in → 1 dòng / đơn hàng.
// ⚠ Giữ THỨ TỰ GẶP ĐẦU TIÊN (backend đã ORDER BY khách → đơn → mã hàng → code phần), đừng sort lại:
//   bảng phải khớp thứ tự người dùng nhìn thấy ở chế độ chi tiết.
export function gopTheoDon(rows, cot) {
  const map = new Map();
  rows.forEach((r) => {
    const k = r.don_hang_id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()].map(([id, ds]) => {
    const d = ds[0];
    const o = {
      _id: id,
      don_hang_id: id,
      ten_khach_hang: d.ten_khach_hang,
      ma_don_hang: d.ma_don_hang,
      so_po: d.so_po,
      // ⚠ Ở mức ĐƠN thì mã hàng / màu / kích / code phần KHÔNG còn là một giá trị ⇒ đếm số giá trị
      //   khác nhau thay vì lấy đại diện (lấy đại diện là giấu mất phần còn lại — bẫy `LIMIT 1`).
      ma_hang: gomChu(ds, 'ma_hang'),
      mau_vai: gomChu(ds, 'mau_vai'),
      kich_vai: gomChu(ds, 'kich_vai'),
      kich_phim: gomChu(ds, 'kich_phim'),
      ma_phan: null,
      so_luong_don_hang: ds.reduce((s, x) => s + so(x.so_luong_don_hang), 0),
      so_luong_vai_ve: ds.reduce((s, x) => s + so(x.so_luong_vai_ve), 0),
      // 2 cột CHỈ CÓ ở chế độ theo đơn (người dùng yêu cầu).
      tong_phan_in: ds.length,
      tong_tg_ready_phut: ds.reduce(
        (s, x) => s + (x.lead_time_phut === null || x.lead_time_phut === undefined ? 0 : so(x.lead_time_phut)),
        0
      ),
      _rows: ds,
    };
    cot.forEach((c) => { o[`_${c.ma}`] = gopCot(c, ds); });
    return o;
  });
}

// Gộp cột chữ: 1 giá trị thì hiện thẳng, nhiều giá trị thì "N loại" (bấm vào chi tiết để xem đủ).
function gomChu(ds, key) {
  const set = new Set(ds.map((x) => x[key]).filter(Boolean));
  if (set.size === 0) return null;
  if (set.size === 1) return [...set][0];
  return `${set.size} loại`;
}

// Dòng TỔNG ở cuối bảng — luôn tính trên TOÀN BỘ dòng phần in đang hiển thị (không phải trên các
// dòng đã gộp), nên 2 chế độ xem cho ra CÙNG một dòng tổng.
export function dongTong(rows, cot) {
  const o = {
    so_luong_don_hang: rows.reduce((s, r) => s + so(r.so_luong_don_hang), 0),
    so_luong_vai_ve: rows.reduce((s, r) => s + so(r.so_luong_vai_ve), 0),
    tong_phan_in: rows.length,
    tong_tg_ready_phut: rows.reduce(
      (s, r) => s + (r.lead_time_phut === null || r.lead_time_phut === undefined ? 0 : so(r.lead_time_phut)),
      0
    ),
  };
  cot.forEach((c) => { o[`_${c.ma}`] = gopCot(c, rows); });
  return o;
}

// Dòng "% đạt" ở cuối bảng.
//   · cột MỐC     → % phần in đã xác nhận / tổng phần in
//   · cột SỐ LƯỢNG→ giá trị / Σ SL in ("chia ra thôi"); riêng chính cột SL in trả `null` (nó là mẫu số)
//   · cột %       → giữ nguyên giá trị % tổng hợp
// ⚠ Mẫu số 0 ⇒ `null` (hiện "—"), KHÔNG phải 0%: "0% trên 0 mẫu" khác hẳn "0% trên 1.000 mẫu".
export function dongPhanTram(rows, cot, tong) {
  const slIn = tong._sl_in || 0;
  const o = {};
  cot.forEach((c) => {
    const v = tong[`_${c.ma}`];
    if (c.nhom === 'moc') o[`_${c.ma}`] = tyLe(v.qua, v.tong);
    else if (c.nhom === 'pt') o[`_${c.ma}`] = v;
    else o[`_${c.ma}`] = c.col === 'sl_in' ? null : tyLe(v, slIn);
  });
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// TÁCH DÒNG THEO ĐỢT VẢI (chế độ *Chi tiết*, chốt 08/09/2026)
//
// 1 phần in có N đợt vải → N dòng. Các ô mức PHẦN IN hợp nhất bằng `rowSpan` (chỉ vẽ ở dòng đầu),
// còn SLNV + 4 mốc suy được theo đợt thì tách theo từng đợt.
//
// ⚠⚠ CHỈ 5 CỘT NÀY TÁCH ĐƯỢC — người dùng đã chốt "cột nào tách được thì tách, còn lại hợp nhất ô":
//   · `vai` / `release_1` / `test_run` / `release_2` : suy từ CHÍNH đợt đó (qua `lenh_sx_dot_vai`).
//   · SLNV                                            : `dot_vai_ve.so_luong_vai_ve`.
//   4 mốc READY (Film/Khuôn/Mực/QA) ghi ở MỨC PHẦN IN (`ket_qua_checkpoint` không có `dot_vai_ve_id`
//   — khuôn/film/mực dùng chung mọi đợt, DATABASE.md §11.3) và mọi cột SỐ LƯỢNG lấy từ bảng `tem`
//   vốn KHÔNG lưu đợt vải (giới hạn đã biết, DATABASE.md §4) ⇒ **KHÔNG tách được**.
// ⚠⚠ TUYỆT ĐỐI KHÔNG lặp lại giá trị mức phần in ở mọi dòng con: người đọc (và Excel) sẽ cộng dồn
//   thành số sai — đúng bẫy đã ghi cho `sl_da_in`/`sl_da_giao` ở *Danh sách release*.
// ─────────────────────────────────────────────────────────────────────────────

export const COT_THEO_DOT = new Set(['vai', 'release_1', 'test_run', 'release_2']);

// Mảng khóa cột trái tách theo đợt (phần còn lại hợp nhất).
export const COT_TRAI_THEO_DOT = new Set(['dot_vai', 'slnv']);

// Bung `rows` (1 dòng/phần in) thành dòng hiển thị (1 dòng/đợt vải).
//   `_dau`  = dòng ĐẦU của phần in → nơi vẽ các ô hợp nhất
//   `_span` = số dòng con (rowSpan) · `_dot` = bản ghi đợt vải của dòng này (null nếu phần in chưa có đợt)
// ⚠ Phần in KHÔNG có đợt vải nào vẫn ra ĐÚNG 1 dòng (`_dot = null`) — bảng không được nuốt mất hàng.
export function tachTheoDotVai(rows) {
  const out = [];
  (rows || []).forEach((r) => {
    const ds = Array.isArray(r.dot_vai_list) && r.dot_vai_list.length ? r.dot_vai_list : [null];
    ds.forEach((d, i) => out.push({
      ...r,
      _id: `${r.phan_in_id}#${i}`,
      _dau: i === 0,
      _span: ds.length,
      _dot: d,
    }));
  });
  return out;
}

// Giá trị của MỘT cột tách-theo-đợt trên dòng hiển thị.
// ⚠ Không có đợt (dòng lùi) → lấy giá trị mức phần in để ô không trống trơn một cách vô cớ.
export function giaTriTheoDot(row, ma) {
  const d = row._dot;
  if (!d) {
    return { dot_vai: null, slnv: row.so_luong_vai_ve, vai: row.moc_vai,
      release_1: row.moc_release_1, test_run: row.moc_test_run, release_2: row.moc_release_2 }[ma];
  }
  return { dot_vai: d.ma_dot_vai, slnv: d.so_luong_vai_ve, vai: d.moc_vai,
    release_1: d.moc_release_1, test_run: d.moc_test_run, release_2: d.moc_release_2 }[ma];
}

// Số phút → "2n 3g 15p" cho dễ đọc (lead time hay lên tới hàng nghìn phút).
export function fmtPhut(v) {
  const n = Math.max(0, Math.round(so(v)));
  if (!n) return '0p';
  const ngay = Math.floor(n / 1440);
  const gio = Math.floor((n % 1440) / 60);
  const phut = n % 60;
  return [ngay ? `${ngay}n` : '', gio ? `${gio}g` : '', phut || (!ngay && !gio) ? `${phut}p` : '']
    .filter(Boolean).join(' ');
}
