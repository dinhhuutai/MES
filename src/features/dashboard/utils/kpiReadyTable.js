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

// ─────────────────────────────────────────────────────────────────────────────
// CỘT THỜI GIAN CẠNH MỖI CỘT MỐC (20/09/2026, người dùng chốt "mốc cột này − mốc bước liền trước")
//
// Chuỗi mốc nguồn do BACKEND khai (`tg_tu` — xem `utils/kpiReady.js`), FE chỉ việc tính hiệu số ⇒
// thêm/bớt cột hay đổi chuỗi nguồn KHÔNG phải sửa file này.
// ⚠ Mốc nguồn trống hết ⇒ `null` (ô "—"), KHÔNG trả 0: "0 phút" và "không đo được" khác hẳn nhau.
// ⚠⚠ Hiệu số ÂM ⇒ `null`. Ca có thật: khuôn/film được xác nhận từ ĐỢT VẢI TRƯỚC, còn mốc vào lại là
//   đợt mới (READY đi theo đợt vải từ 16/09/2026) ⇒ trừ ra số âm. In số âm lên bảng KPI là vô nghĩa.
// ─────────────────────────────────────────────────────────────────────────────

// Đọc mốc của một dòng hiển thị: ưu tiên giá trị của ĐỢT VẢI (dòng đã tách), lùi về mức phần in.
// ⚠ Dùng `hasOwnProperty` chứ không `d[k] ||`: đợt CHƯA test có `moc_test_run = null` — đó là câu trả
//   lời THẬT của đợt đó, không được mượn mốc của đợt anh em (sẽ ra thời gian của hàng khác).
export const mocCua = (row) => (k) => {
  const d = row && row._dot;
  if (d && Object.prototype.hasOwnProperty.call(d, k)) return d[k];
  return row ? row[k] : null;
};

// Thời gian của MỘT cột mốc trên MỘT dòng → `{ phut, tu }` (`tu` = khóa mốc thật sự đã đo từ đó).
// `lay` = hàm đọc mốc (mặc định: mức phần in).
//
// ⚠⚠ MỐC NGUỒN CHO RA SỐ ÂM THÌ **BỎ QUA, THỬ NGUỒN KẾ TIẾP** — không phải trả `null` ngay.
//   Đo prod 20/09/2026: luật "chặt" làm **10/35** ô *Release 1* và **2/33** ô *Release 2* thành "—",
//   đúng ở nhóm hàng đã release TRƯỚC khi QA xác nhận READY (`KTCankiemtra=0` đi thẳng Release 1 —
//   chính là nhóm mà KPI 2 "Số lần thiếu sau Release" đang đếm). Lùi một nấc cho ra "từ lúc kỹ thuật
//   xong / từ lúc có vải tới Release 1" — vẫn đo đúng một khoảng có thật, không bịa gì.
// ⚠ Hết nguồn mà vẫn âm ⇒ `null` (ô "—"). Ca thật: HSKT được tạo TRƯỚC đợt vải đầu tiên (4/47 phần
//   in) — không có bước nào trước nó để mà đo.
// ⚠ Trả kèm `tu` để tooltip nói RÕ đang đo từ mốc nào: 2 dòng cạnh nhau có thể đo từ 2 gốc khác nhau,
//   giấu đi là người đọc so nhầm.
export function tgTinh(row, cot, lay) {
  if (!cot || cot.nhom !== 'moc' || !cot.tg_tu || !cot.tg_tu.length) return { phut: null, tu: null };
  const doc = lay || ((k) => row[k]);
  const den = doc(cot.col);
  if (!den) return { phut: null, tu: null };
  for (let i = 0; i < cot.tg_tu.length; i += 1) {
    const k = cot.tg_tu[i];
    const tu = doc(k);
    if (tu) {
      const p = Math.round((new Date(den).getTime() - new Date(tu).getTime()) / 60000);
      if (Number.isFinite(p) && p >= 0) return { phut: p, tu: k };
    }
  }
  return { phut: null, tu: null };
}

export const tgPhut = (row, cot, lay) => tgTinh(row, cot, lay).phut;

// Tổng thời gian của một cột trên NHIỀU dòng (chế độ gộp). Không dòng nào đo được ⇒ `null`.
// ⚠ CỘNG chứ không trung bình (người dùng chốt "theo đơn thì tính tổng lại").
export function tgTong(ds, cot, lay) {
  let co = false;
  let tong = 0;
  (ds || []).forEach((r) => {
    const v = tgPhut(r, cot, lay ? lay(r) : undefined);
    if (v !== null) { co = true; tong += v; }
  });
  return co ? tong : null;
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

// ─────────────────────────────────────────────────────────────────────────────
// CHẾ ĐỘ "THEO ĐƠN" CŨNG TÁCH DÒNG THEO ĐỢT VẢI (20/09/2026, người dùng chốt)
//
// 1 đơn nhận vải làm nhiều đợt ⇒ nhiều dòng, **ô thông tin đơn hợp nhất bằng `rowSpan`** — giống hệt
// cách chế độ *Chi tiết* đang làm với phần in.
//
// ⚠⚠ KHÓA NHÓM LÀ **NGÀY VẢI VỀ**, không phải từng bản ghi `dot_vai_ve`: ở mức ĐƠN, "đợt" là một
//   LẦN NHẬN VẢI cho cả đơn (đơn 12 phần in × 1 đợt mà tách theo bản ghi thì ra 12 dòng — đúng bằng
//   chế độ Chi tiết, toggle mất hết ý nghĩa). Đây cũng chính là giá trị cột "Đợt vải" đang hiện.
// ⚠ Mỗi phần tử mang theo NGUYÊN dòng phần in cha (`...p`) + `_dot` ⇒ `mocCua`/`tgPhut` đọc được cả
//   mốc mức đợt (release_1/test_run/release_2) LẪN mốc mức phần in (qa_ready) để làm mẫu số.
// ⚠ Đơn KHÔNG có đợt vải nào ⇒ trả `[]`, bên gọi vẽ đúng 1 dòng như cũ (đừng nuốt mất hàng).
// ─────────────────────────────────────────────────────────────────────────────
export function nhomDotTheoNgay(donRow) {
  const ds = [];
  (donRow._rows || []).forEach((p) => {
    (p.dot_vai_list || []).forEach((d) => ds.push({ ...p, _dot: d }));
  });
  if (!ds.length) return [];
  const map = new Map();
  ds.forEach((x) => {
    const k = x._dot.ngay_vai_ve ? String(x._dot.ngay_vai_ve).slice(0, 10) : '';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  });
  // Ngày trống ("chưa có ngày vải về") xuống CUỐI — cùng quy ước với popover ngày giao của dải Theo dõi.
  return [...map.entries()]
    .sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || String(a[0]).localeCompare(String(b[0])))
    .map(([ngay, arr]) => ({ ngay: ngay || null, ds: arr }));
}

// Giá trị của một cột TRÁI tách-theo-đợt trên MỘT nhóm ngày vải về.
export function giaTriNhomDot(g, ma) {
  const ds = (g.ds || []).map((x) => x._dot);
  const som = (k) => {
    const v = ds.map((d) => d[k]).filter(Boolean).sort();
    return v.length ? v[0] : null;
  };
  if (ma === 'dot_vai') return g.ngay;
  if (ma === 'slnv') return ds.reduce((s, d) => s + (Number(d.so_luong_vai_ve) || 0), 0);
  if (ma === 'ngay_kh') return som('ngay_ke_hoach');
  if (ma === 'han_giao') return som('han_giao_hang');
  return null;
}

// Cột MỐC tách-theo-đợt trên một nhóm ⇒ "x/N" (bao nhiêu đợt trong nhóm đã qua bước đó).
export function gopCotTheoNhomDot(cot, g) {
  const ds = g.ds || [];
  return { qua: ds.filter((x) => x._dot && x._dot[cot.col]).length, tong: ds.length };
}

export const COT_THEO_DOT = new Set(['vai', 'release_1', 'test_run', 'release_2']);

// Mảng khóa cột trái tách theo đợt (phần còn lại hợp nhất).
// ⚠ `ngay_kh` (ngày SX kế hoạch) + `han_giao` thêm 10/09/2026: cả hai là thuộc tính của TỪNG ĐỢT VẢI
//   (hạn giao nằm trên `dot_vai_ve`, ngày KH lấy từ lệnh gắn đợt đó) ⇒ phải tách, hợp nhất là sai số.
export const COT_TRAI_THEO_DOT = new Set(['dot_vai', 'slnv', 'ngay_kh', 'han_giao']);

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
// ⚠⚠ Cột "Đợt vải" hiện **NGÀY VẢI VỀ**, KHÔNG phải `ma_dot_vai` (người dùng chốt 10/09/2026): mã đợt
//   là chuỗi `ERP-<md5>` dài, không nói được gì cho người đọc; ngày vải về mới là thứ dùng để đối
//   chiếu tiến độ. Mã đợt vẫn còn ở tooltip (xem `KpiReadyPage`).
export function giaTriTheoDot(row, ma) {
  const d = row._dot;
  if (!d) {
    return { dot_vai: null, slnv: row.so_luong_vai_ve, ngay_kh: null, han_giao: row.han_giao_hang,
      vai: row.moc_vai,
      release_1: row.moc_release_1, test_run: row.moc_test_run, release_2: row.moc_release_2 }[ma];
  }
  return { dot_vai: d.ngay_vai_ve, slnv: d.so_luong_vai_ve, ngay_kh: d.ngay_ke_hoach,
    han_giao: d.han_giao_hang, vai: d.moc_vai,
    release_1: d.moc_release_1, test_run: d.moc_test_run, release_2: d.moc_release_2 }[ma];
}

// ─────────────────────────────────────────────────────────────────────────────
// TÊN OWNER VIẾT TẮT cho dòng 2 của header (người dùng chốt 10/09/2026).
//   "Thạch Công Tuấn" → "C.Tuấn"   ·   "Nguyễn Thị Bích Quyền" → "B.Quyền"
// Bảng có 23 cột owner nằm cạnh nhau, tên đầy đủ làm cột phình rất rộng và phải kéo ngang liên tục.
//
// LUẬT: giữ TỪ CUỐI (tên) nguyên vẹn, từ ÁP CHÓT viết tắt 1 chữ cái + dấu chấm, bỏ phần còn lại.
// ⚠ Tên 1 từ ⇒ GIỮ NGUYÊN (không có gì để tắt). Tên 2 từ ⇒ từ áp chót là HỌ, vẫn viết tắt cho nhất
//   quán ("Lê Tuấn" → "L.Tuấn") — người đọc vẫn nhận ra, mà cột không rộng thêm.
// ⚠⚠ CHỈ dùng để HIỂN THỊ trên bảng. Tooltip, file Excel và trang *Owner checkpoint/checklist* phải
//   giữ TÊN ĐẦY ĐỦ — đó là nơi đối chiếu/gán người, viết tắt ở đó là làm mất thông tin.
//
// ⚠⚠⚠ MỘT TRẠM CÓ THỂ GÁN NHIỀU NGƯỜI: service nối bằng `", "` (`dungCot` → `g.chinh.join(', ')`).
//   Đo prod 10/09: `PIPELINE` 2 người · `DONE_DELIVERY`/`SAN_XUAT`/`FINISH` 3 người ⇒ **phải viết tắt
//   TỪNG TÊN rồi nối lại**. Bản đầu tôi cho "chuỗi có dấu phẩy thì giữ nguyên" — hỏng đúng những ô
//   DÀI NHẤT, tức đúng thứ người dùng phàn nàn.
// ⚠ Owner cũng có thể là tên VAI TRÒ / PHÒNG BAN (`dsOwner` COALESCE 3 nguồn): mỗi phần >4 từ hoặc
//   có dấu gạch/gạch chéo thì GIỮ NGUYÊN, tránh bóp méo "Kế hoạch - Vật tư" thành thứ vô nghĩa.
export function viTatTen(ten) {
  return String(ten || '')
    .split(',')
    .map(motTen)
    .filter(Boolean)
    .join(', ');
}

function motTen(ten) {
  const s = String(ten || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const tu = s.split(' ');
  if (tu.length < 2) return s;
  if (tu.length > 4 || /[-/]/.test(s)) return s;
  return `${tu[tu.length - 2].charAt(0).toUpperCase()}.${tu[tu.length - 1]}`;
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
