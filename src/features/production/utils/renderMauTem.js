// ─────────────────────────────────────────────────────────────────────────────
// BỘ RENDER MẪU TEM — từ `bo_cuc_json` (mig 073) dựng ra HTML 1 khung tem.
// DÙNG CHUNG cho CẢ xem trước trên màn thiết kế LẪN in thật ⇒ "xem sao in vậy",
// không có chuyện màn hình một kiểu máy in một kiểu.
//
// ⚠ Khổ tem CỐ ĐỊNH 110×80mm / 2 tem — hằng dưới đây phải khớp `backend/src/utils/mauTem.js` KHO_TEM
//   và `SHEET_CSS` trong `printTemLabel.js`.
// ─────────────────────────────────────────────────────────────────────────────

export const KHO = {
  toRong: 110, toCao: 80, temRong: 55, temCao: 80,
  noiDungRong: 49, noiDungCao: 78,
  leTren: 1, leDuoi: 1, leTrai: 1, lePhai: 5,
};

// CSS cho tem dựng từ mẫu — chỉ khung + lưới, còn kiểu chữ/viền do TỪNG Ô tự mang theo (inline style
// do `renderKhung` sinh) nên không cần class .lbl/.v… như bố cục cứng.
// ⚠⚠ DÙNG CHUNG cho cửa sổ IN THẬT (`printTemLabel.openSheetMau`) và khung XEM TRƯỚC ở màn thiết kế
//   (`TemXemTruoc`) — để 2 chỗ ra **y hệt nhau**. Sửa ở đây là sửa cho cả hai; đừng chép ra bản thứ 2.
export const SHEET_CSS_MAU = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #000; }
  .sheet { display: flex; width: ${KHO.toRong}mm; height: ${KHO.toCao}mm; }
  .label { width: ${KHO.temRong}mm; height: ${KHO.temCao}mm;
           padding: ${KHO.leTren}mm ${KHO.lePhai}mm ${KHO.leDuoi}mm ${KHO.leTrai}mm; overflow: hidden; }
  .label:first-child { width: ${KHO.temRong - 4}mm; padding-right: ${KHO.leTrai}mm; }
  table.mt-luoi td { padding: 0.25mm 0.6mm; line-height: 1.02; overflow: hidden; }
  @page { size: ${KHO.toRong}mm ${KHO.toCao}mm; margin: 0; }`;

// Vòng THU CHỮ chạy TRONG cửa sổ in / khung xem trước, trước khi gọi print(): ô nào bật "tự co" mà nội
// dung tràn thì giảm dần cỡ chữ tới khi vừa. Phải làm ở đây (không phải CSS) vì chỉ lúc này mới đo được
// kích thước THẬT của ô sau khi trình duyệt dựng xong bảng.
// ⚠ Xem trước cũng chạy vòng này ⇒ thấy đúng cỡ chữ sẽ in ra, không phải đoán.
export const JS_TU_CO = `
  function thuChu(){
    var os = document.querySelectorAll('td[data-tuco]');
    for (var i = 0; i < os.length; i++) {
      var td = os[i];
      var cs = parseFloat(getComputedStyle(td).fontSize);
      var min = cs * 0.45;                       // không thu quá 45% — nhỏ hơn nữa là không đọc nổi
      var n = 0;
      while (n < 40 && cs > min && (td.scrollWidth > td.clientWidth + 1 || td.scrollHeight > td.clientHeight + 1)) {
        cs -= Math.max(0.3, cs * 0.06);
        td.style.fontSize = cs + 'px';
        n++;
      }
    }
  }`;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const p2 = (n) => String(n).padStart(2, '0');

// Định dạng ngày theo mã người dùng chọn (DINH_DANG_NGAY ở backend/src/utils/mauTem.js).
// Tự viết thay vì kéo thư viện: chỉ 7 mẫu, và bundle tem cần nhẹ.
export function dinhDangNgay(v, ma) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const M = {
    YYYY: d.getFullYear(), YY: String(d.getFullYear()).slice(2),
    MM: p2(d.getMonth() + 1), DD: p2(d.getDate()),
    HH: p2(d.getHours()), mm: p2(d.getMinutes()), ss: p2(d.getSeconds()),
  };
  return String(ma || 'DD/MM/YY HH:mm').replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (k) => M[k]);
}

const fmtSo = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('vi-VN'));

// ĐỔI CÁCH HIỂN THỊ khi hiện lên tem — rút gọn / chèn thêm mà KHÔNG đụng dữ liệu gốc.
// Mỗi luật có `kieu`; luật CŨ chỉ có `{tu, thanh}` (không `kieu`) vẫn chạy đúng vì mặc định là THAY.
//   THAY  : thay MỌI lần xuất hiện của `tu` bằng `thanh`
//           "Ca 1" + {tu:'Ca ', thanh:'C'} → "C1" · "Chuyền M4A-4B" + {tu:'Chuyền M', thanh:''} → "4A-4B"
//   VITRI : thay `so_kt` ký tự KỂ TỪ ký tự thứ `vi_tri` (đếm từ 1) bằng `thanh`; `so_kt=0` = chèn thêm
//           "152608057689" + {vi_tri:1, so_kt:2, thanh:'17'} → "172608057689"
//           "260805C2"     + {vi_tri:1, so_kt:6, thanh:''}   → "C2"
//   DAU   : thêm `thanh` vào ĐẦU chuỗi · CUOI : thêm `thanh` vào CUỐI chuỗi
// Chạy LẦN LƯỢT theo thứ tự trong danh sách (luật sau ăn kết quả của luật trước).
// ⚠ Cố ý dùng thay-chuỗi-thường (`split/join`) chứ KHÔNG regex: người dùng ở xưởng gõ "(6PCS)" hay
//   "2.1*1" là chuỗi thật, không phải cú pháp.
// ⚠ Luật sai/thừa thì BỎ QUA im lặng, không ném lỗi — đây là đường IN, máy in đang chờ.
export function apDungThay(chuoi, thay) {
  if (!Array.isArray(thay) || !thay.length) return chuoi;
  let s = String(chuoi == null ? '' : chuoi);
  for (const r of thay) {
    if (!r) continue;
    const thanh = String(r.thanh == null ? '' : r.thanh);
    const kieu = r.kieu || 'THAY';
    if (kieu === 'DAU') { if (thanh) s = thanh + s; continue; }
    if (kieu === 'CUOI') { if (thanh) s += thanh; continue; }
    if (kieu === 'VITRI') {
      const vt = Math.max(1, Number(r.vi_tri) || 1);
      // Chuỗi ngắn hơn vị trí yêu cầu → BỎ QUA (không nối bừa vào cuối, tránh in ra thứ vô nghĩa).
      if (vt > s.length + 1) continue;
      const n = Math.max(0, Number(r.so_kt) || 0);
      s = s.slice(0, vt - 1) + thanh + s.slice(vt - 1 + n);
      continue;
    }
    if (!r.tu) continue;
    s = s.split(String(r.tu)).join(thanh);
  }
  return s;
}

// Giá trị 1 trường dữ liệu, đã định dạng theo kiểu ô.
function giaTriTruong(data, ma, dinhDang, kieuTruong, thay) {
  const v = data ? data[ma] : '';
  let out;
  if (kieuTruong === 'ngay') out = dinhDangNgay(v, dinhDang);
  else if (kieuTruong === 'so') out = fmtSo(v);
  else out = v == null ? '' : String(v);
  return apDungThay(out, thay);
}

// GIÁ TRỊ MÃ của ô QR / mã vạch — có áp luật `thay` (đổi cách hiển thị) như mảnh trường của ô chữ.
// ⚠⚠ DÙNG CHUNG cho ẢNH (`dsOMa` → mã hóa vào QR/vạch) và DÒNG CHỮ dưới hình (`renderKhung`): hai chỗ
//   này BẮT BUỘC ra cùng một chuỗi, lệch nhau thì nhìn một đằng quét ra một nẻo. Đừng gọi
//   `giaTriTruong` trực tiếp ở 2 nơi nữa.
// ⚠ Luật ở đây đổi LUÔN NỘI DUNG ĐƯỢC MÃ HÓA (khác ô chữ chỉ đổi chữ hiện ra) — cắt/thêm ký tự là máy
//   quét ở KCS/Sửa/OQC đọc ra chuỗi khác `ma_tem` gốc. Panel thiết kế có cảnh báo đỏ nhắc điều này.
export function giaTriMa(cell, data) {
  return giaTriTruong(data, (cell && cell.ma_qr) || 'ma_tem', null, 'chu', cell && cell.thay);
}

// Nội dung 1 ô = nối các mảnh `phan` (chữ cố định + trường dữ liệu).
// ⚠ `p.kieu` (chu|so|ngay) được LƯU THẲNG trong bố cục lúc chèn trường ⇒ bộ render TỰ ĐỦ, không phải
//   tra danh mục trường. Nhờ vậy đường IN không phụ thuộc thêm API nào (in tem là việc đang chờ máy).
//   `truongMap` chỉ là lối lùi cho bố cục cũ chưa có `kieu`.
export function noiDungO(o, data, truongMap) {
  const phan = Array.isArray(o?.phan) ? o.phan : [];
  return phan.map((p) => {
    if (!p) return '';
    if (p.loai === 'chu') return p.gia_tri == null ? '' : String(p.gia_tri);
    if (p.loai === 'truong') {
      // Thiếu `kieu` mà CÓ `dinh_dang` thì chắc chắn là ngày — lối lùi cho bố cục cũ / khai tay,
      // nếu không sẽ in ra chuỗi ISO thô ("2026-08-08T14:05:00+07:00") lên tem.
      const kieu = p.kieu
        || (truongMap && truongMap[p.ma] ? truongMap[p.ma].kieu : null)
        || (p.dinh_dang ? 'ngay' : 'chu');
      return giaTriTruong(data, p.ma, p.dinh_dang, kieu, p.thay);
    }
    return '';
  }).join('');
}

// CHỮ DỌC — `o.xoay`: 0/không có = ngang · 90 = dọc đọc TỪ TRÊN XUỐNG · 270 = dọc đọc TỪ DƯỚI LÊN.
// ⚠ Phải bọc nội dung trong <span> chứ KHÔNG đặt `transform` thẳng lên <td>: theo chuẩn CSS, phần tử
//   `display: table-cell` KHÔNG nhận `transform` — đặt lên td thì trình duyệt lặng lẽ bỏ qua, chữ vẫn
//   nằm ngang mà không báo lỗi gì. `writing-mode` thì td nhận được, nhưng để 2 chiều dùng chung một
//   đường thì bọc span luôn cho nhất quán giữa bản in và lưới thiết kế.
export const XOAY_HOP_LE = [0, 90, 270];
export function cssChuDoc(xoay) {
  const x = Number(xoay) || 0;
  if (x !== 90 && x !== 270) return '';
  const base = 'display:inline-block;writing-mode:vertical-rl;text-orientation:mixed';
  return x === 270 ? `${base};transform:rotate(180deg)` : base;
}

// CSS của 1 ô — dựng từ thuộc tính người dùng chọn ở panel thiết kế.
function styleO(o, mmPx = 1) {
  const v = o.vien || {};
  const net = `${0.025 * mmPx}mm solid #000`;
  const canh = (b) => (b === false ? '0' : net);
  const st = [
    `border-top:${canh(v.tren)}`, `border-bottom:${canh(v.duoi)}`,
    `border-left:${canh(v.trai)}`, `border-right:${canh(v.phai)}`,
    `font-size:${Number(o.co_chu_mm) || 2.2}mm`,
    `text-align:${o.ngang || 'center'}`,
    `vertical-align:${o.doc || 'middle'}`,
  ];
  // GIÃN CHỮ (letter-spacing) — mm, cho phép ÂM để bóp chữ lại cho vừa ô hẹp.
  if (Number(o.gian_chu_mm)) st.push(`letter-spacing:${Number(o.gian_chu_mm)}mm`);
  if (o.dam) st.push('font-weight:700');
  if (o.nghieng) st.push('font-style:italic');
  if (o.gach_chan) st.push('text-decoration:underline');
  if (o.nen) st.push(`background:${o.nen}`);
  if (o.mau_chu) st.push(`color:${o.mau_chu}`);
  st.push(o.xuong_dong === false ? 'white-space:nowrap' : 'word-break:break-word');
  return st.join(';');
}

// ⚠⚠ CHIỀU CAO TỪNG HÀNG — TÍNH SẴN BẰNG mm CHO **MỌI** HÀNG, KHÔNG để trình duyệt tự chia.
//
// Lỗi thật đã gặp (2026-08-11): `<tr>` không đặt `height` thì thuật toán bảng của trình duyệt chia
// chiều cao **THEO NỘI DUNG** ⇒ (a) hàng chứa ảnh QR/mã vạch nở bung theo kích thước GỐC của ảnh
// (canvas mã vạch cao 60px ≈ 15.9mm) làm tem "cao ra"; (b) **hàng toàn ô TRỐNG bị bóp gần bằng 0**
// (thấy rõ ở 4 mẫu gốc: 2 hàng kẻ ô trống của tem phải, và khối Lo/SL Giao/KCS/N Kiểm của tem trái).
// Trên MÀN THIẾT KẾ thì ô mã chỉ là chữ "▣ QR" nên trông vẫn đều ⇒ **thiết kế một kiểu, in một kiểu**.
//
// Đúng ý nghĩa đã chốt: `cao_mm: null` = "tự giãn CHIA ĐỀU phần trống còn lại" (DATABASE.md §4).
// Dùng CHUNG cho bản in (`renderKhung`) và lưới thiết kế (`TemGrid`) ⇒ 2 bên khớp từng mm.
export function caoHangMm(khung) {
  const hang = Array.isArray(khung && khung.hang) ? khung.hang : [];
  let cung = 0; let tuDo = 0;
  hang.forEach((h) => { const v = Number(h && h.cao_mm) || 0; if (v > 0) cung += v; else tuDo += 1; });
  // Đặt cứng đã vượt khổ → hàng tự do vẫn được 0.5mm (giống cách chia cột), thanh trạng thái đã cảnh báo.
  const moi = tuDo ? Math.max(0.5, (KHO.noiDungCao - cung) / tuDo) : 0;
  return hang.map((h) => (Number(h && h.cao_mm) > 0 ? Number(h.cao_mm) : moi));
}

// ─── HỆ MÃ VẠCH (symbology) ───────────────────────────────────────────────────
// Có NHIỀU hệ mã vạch khác nhau, cùng một dãy số nhưng vẽ ra hình vạch KHÁC HẲN nhau ⇒ tem MES in
// CODE128 trông không giống tem cũ do hệ khác in ra. Nay chọn được từng ô (`o.he_ma`).
// ⚠⚠ CHỈ liệt kê những hệ mà **máy quét camera của chính MES đọc được** (`cameraDecoder.js`
//   POSSIBLE_FORMATS: CODE_128 · CODE_39 · ITF · EAN_13 · EAN_8 · UPC_A · UPC_E). Thêm hệ ngoài
//   danh sách đó (CODABAR, MSI, pharmacode…) là in ra rồi KCS/Sửa/OQC quét không ra tem.
//   ⚠ CODABAR đã bị GỠ khỏi máy quét vì đọc ra mã RÁC từ đường kẻ bảng của phiếu — đừng đưa lại.
export const HE_MA_VACH = [
  { ma: 'CODE128', ten: 'Code 128 (mặc định)', mo_ta: 'Gọn nhất, nhận mọi ký tự — dùng cho mã tem 12 số' },
  { ma: 'CODE128B', ten: 'Code 128-B', mo_ta: 'Ép bảng mã B (chữ + số), vạch dài hơn Code 128 tự chọn' },
  { ma: 'CODE39', ten: 'Code 39', mo_ta: 'Vạch to, dài — kiểu mã vạch đời cũ, dễ đọc bằng đầu đọc rẻ' },
  { ma: 'ITF', ten: 'ITF (Interleaved 2 of 5)', mo_ta: 'CHỈ chữ số và phải CHẴN chữ số — rất gọn' },
  { ma: 'EAN13', ten: 'EAN-13', mo_ta: 'Đúng 12–13 chữ số, có vạch mốc 2 đầu như mã hàng siêu thị' },
];
const HE_MA_HOP_LE = new Set(HE_MA_VACH.map((h) => h.ma));
export const heMaCuaO = (o) => (o && HE_MA_HOP_LE.has(o.he_ma) ? o.he_ma : 'CODE128');

// CÓ hiện dãy chữ mã bên dưới hình không?
// ⚠ MÃ VẠCH: MẶC ĐỊNH **KHÔNG** hiện số (chốt 2026-08-11) — bản thân vạch đã mang đủ dữ liệu, in kèm
//   dãy số chỉ tốn chỗ trên tem 55×80mm; muốn có thì tick lại ở panel (`hien_ma: true` tường minh).
//   QR thì NGƯỢC LẠI — mặc định vẫn hiện, vì mắt người không đọc được QR mà tem cần đối chiếu tay
//   (4 mẫu gốc đều khai `hien_ma: true` cho ô QR nên không mẫu nào bị đổi).
export const hienChuMa = (o) => (o && o.kieu === 'barcode' ? o.hien_ma === true : !o || o.hien_ma !== false);

// ⚠⚠ HAI LỚP CHỪA TRẮNG QUANH MÃ — mục đích KHÁC NHAU, đừng gộp làm một:
//   1. `LE_MA_MM` (CSS, dưới đây) — tách hình khỏi VIỀN Ô cho dễ nhìn. Ô mã vạch `width:100%` trước
//      đây dính sát 2 viền trái/phải (báo lỗi 2026-08-11).
//   2. VÙNG TRẮNG THEO CHUẨN nướng thẳng vào ẢNH ở `dungAnhMa` (`margin` của JsBarcode/qrcode) — cái
//      này TỈ LỆ THEO BỀ RỘNG VẠCH nên đúng chuẩn ở mọi kích thước ô, còn lề mm cố định thì không.
//      Thiếu nó là máy quét đọc không ra, không phải chuyện thẩm mỹ.
const LE_MA_MM = 0.6;

// Ô mã vạch/QR: ảnh đã dựng sẵn (bất đồng bộ) truyền vào qua `anhMa[khoa]`.
// ⚠⚠ KÍCH THƯỚC ẢNH PHẢI TÍNH RA mm, TUYỆT ĐỐI KHÔNG dùng `height:100%`/`60%`:
//   phần trăm chiều cao chỉ giải được khi ô có chiều cao XÁC ĐỊNH; trong bảng nó thường **không xác
//   định** ⇒ trình duyệt lùi về kích thước GỐC của ảnh (QR 320px ≈ 84mm · mã vạch cao 60px ≈ 15.9mm)
//   ⇒ ô phình ra, tem "cao ra" đúng như báo lỗi 2026-08-11. Nay `caoOmm` = tổng chiều cao các hàng ô
//   này chiếm (đã trừ padding + dòng chữ mã) nên ảnh LUÔN vừa đúng ô đã thiết kế.
// ⚠ QR giữ TỈ LỆ VUÔNG (`max-*` + auto) — méo thì máy quét đọc kém. MÃ VẠCH thì kéo đầy ô
//   (`width:100%` + chiều cao cố định): kéo dãn theo CHIỀU DỌC không ảnh hưởng máy quét (nó chỉ đọc
//   tỉ lệ bề rộng các vạch), mà lại tận dụng hết ô.
function htmlOMa(o, khoa, anhMa, maText, caoOmm) {
  const src = anhMa ? anhMa[khoa] : '';
  const coChu = hienChuMa(o);
  const coChuMm = Number(o.co_chu_mm) || 2.2;
  const le = LE_MA_MM * 2;                       // tổng phần chừa 2 bên / trên-dưới
  let kichThuoc;
  if (caoOmm > 0) {
    // 0.5mm = padding trên+dưới của td (SHEET_CSS_MAU); dòng chữ mã ≈ cỡ chữ × 1.25.
    const con = Math.max(0.8, caoOmm - 0.5 - le - (coChu ? coChuMm * 1.25 : 0));
    kichThuoc = o.kieu === 'barcode'
      ? `width:calc(100% - ${le}mm);height:${con.toFixed(2)}mm;margin:${LE_MA_MM}mm auto`
      : `margin:${LE_MA_MM}mm auto;width:auto;height:auto;max-width:calc(100% - ${le}mm);max-height:${con.toFixed(2)}mm`;
  } else {
    // Không biết chiều cao ô (không nên xảy ra) → chỉ chặn bề rộng, thà nhỏ còn hơn phình.
    kichThuoc = o.kieu === 'barcode'
      ? `width:calc(100% - ${le}mm);height:auto;margin:${LE_MA_MM}mm auto`
      : `margin:${LE_MA_MM}mm auto;max-width:calc(100% - ${le}mm);height:auto`;
  }
  const img = src ? `<img src="${src}" alt="" style="display:block;${kichThuoc}">` : '';
  const ma = coChu
    ? `<div style="font-size:${coChuMm}mm;font-weight:700;word-break:break-all;line-height:1.05">${esc(maText)}</div>`
    : '';
  return `${img}${ma}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dựng HTML 1 KHUNG TEM.
//   khung   : { so_cot, hang[], cot[], o{} }
//   data    : object dữ liệu nhãn (BE getTemLabelData + phần FE bù)
//   anhMa   : { "<r>,<c>": dataURL } ảnh QR/barcode đã dựng sẵn
//   opts    : { truongMap, chonO, tuCoClass } — chonO dùng cho màn thiết kế (viền chọn)
// ─────────────────────────────────────────────────────────────────────────────
export function renderKhung(khung, data, anhMa, opts = {}) {
  if (!khung || !khung.so_cot) return '';
  const soCot = Number(khung.so_cot);
  const hang = Array.isArray(khung.hang) ? khung.hang : [];
  const cot = Array.isArray(khung.cot) ? khung.cot : [];
  const o = khung.o || {};
  const { truongMap, chonO, choThietKe } = opts;

  // Ô nào bị GỘP che → bỏ qua khi render (bản đồ dựng từ cs/rs của ô gốc).
  const biChe = new Set();
  for (const [k, cell] of Object.entries(o)) {
    const [r, c] = k.split(',').map(Number);
    const cs = Math.max(1, Number(cell.cs) || 1);
    const rs = Math.max(1, Number(cell.rs) || 1);
    for (let i = r; i < r + rs; i += 1) {
      for (let j = c; j < c + cs; j += 1) if (!(i === r && j === c)) biChe.add(`${i},${j}`);
    }
  }

  const colgroup = `<colgroup>${Array.from({ length: soCot }, (_, i) => {
    const w = cot[i] && cot[i].rong_mm;
    return `<col${w ? ` style="width:${w}mm"` : ''}>`;
  }).join('')}</colgroup>`;

  const caoHang = caoHangMm(khung);

  const rows = hang.map((h, r) => {
    const tds = [];
    for (let c = 0; c < soCot; c += 1) {
      const khoa = `${r},${c}`;
      if (biChe.has(khoa)) continue;
      const cell = o[khoa] || {};
      const cs = Math.max(1, Number(cell.cs) || 1);
      const rs = Math.max(1, Number(cell.rs) || 1);
      const laMa = cell.kieu === 'qr' || cell.kieu === 'barcode';
      const maText = laMa ? giaTriMa(cell, data) : '';
      const cssDoc = laMa ? '' : cssChuDoc(cell.xoay);
      const chu = esc(noiDungO(cell, data, truongMap));
      // Ô gộp dọc thì chiều cao = tổng các hàng nó chiếm.
      const caoO = caoHang.slice(r, r + rs).reduce((s, x) => s + x, 0);
      const noiDung = laMa
        ? htmlOMa(cell, khoa, anhMa, maText, caoO)
        : (cssDoc ? `<span style="${cssDoc}">${chu}</span>` : chu);
      // `data-tuco` để vòng thu chữ trong cửa sổ in tìm được đúng ô cần co.
      const attr = [
        cs > 1 ? ` colspan="${cs}"` : '', rs > 1 ? ` rowspan="${rs}"` : '',
        ` style="${styleO(cell)}"`,
        cell.tu_co ? ' data-tuco="1"' : '',
        choThietKe ? ` data-o="${khoa}"` : '',
        choThietKe && chonO === khoa ? ' class="dang-chon"' : '',
      ].join('');
      tds.push(`<td${attr}>${noiDung}</td>`);
    }
    // ⚠ ĐẶT mm cho MỌI hàng (kể cả hàng "tự giãn") — `height:auto` là đường dẫn tới lỗi phình ô / bóp
    //   hàng trống nói ở `caoHangMm`. Tổng đúng bằng 78mm nên bảng vẫn lấp kín nhãn.
    return `<tr style="height:${caoHang[r].toFixed(3)}mm">${tds.join('')}</tr>`;
  }).join('');

  // `table-layout:fixed` + `height:100%` để hàng `cao_mm: null` tự giãn lấp phần trống (như `.bot`/`.grid` cũ).
  return `<table class="mt-luoi" style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">${colgroup}${rows}</table>`;
}

// Danh sách ô cần dựng ảnh QR/barcode của 1 khung → [{ khoa, kieu, gia_tri }].
export function dsOMa(khung, data) {
  const out = [];
  const o = (khung && khung.o) || {};
  for (const [khoa, cell] of Object.entries(o)) {
    if (cell.kieu === 'qr' || cell.kieu === 'barcode') {
      out.push({ khoa, kieu: cell.kieu, gia_tri: giaTriMa(cell, data), he_ma: heMaCuaO(cell) });
    }
  }
  return out;
}

// Dựng ảnh cho mọi ô mã của 1 khung (QR bằng `qrcode`, mã vạch bằng `jsbarcode` — cả 2 LAZY IMPORT
// để không phình bundle chính). Lỗi 1 mã KHÔNG chặn in: ô đó chỉ mất ảnh, phần chữ vẫn còn.
export async function dungAnhMa(khung, data) {
  const ds = dsOMa(khung, data);
  if (!ds.length) return {};
  const out = {};
  const [{ default: QRCode }, barcodeMod] = await Promise.all([
    import('qrcode'),
    ds.some((x) => x.kieu === 'barcode') ? import('jsbarcode') : Promise.resolve(null),
  ]);
  for (const it of ds) {
    try {
      if (!it.gia_tri) continue;
      if (it.kieu === 'qr') {
        // ⚠ `margin` tính bằng SỐ Ô (module), không phải px. **2 ô** — chuẩn QR đòi 4, nhưng tem chỉ
        //   55×80mm nên lấy 2 làm dung hòa (vẫn hơn hẳn `margin: 0` cũ = KHÔNG có vùng trắng nào, mã
        //   dính sát viền ô là máy quét dò không ra mốc định vị).
        out[it.khoa] = await QRCode.toDataURL(it.gia_tri, { margin: 2, width: 320, errorCorrectionLevel: 'M' });
      } else if (barcodeMod) {
        const JsBarcode = barcodeMod.default || barcodeMod;
        const cv = document.createElement('canvas');
        // `displayValue:false` — phần chữ do ô tự vẽ (để chỉnh cỡ chữ được ở panel thiết kế).
        // ⚠ `width` = bề rộng 1 vạch mảnh (px). Nâng 2→4 vì ảnh bị KÉO ĐẦY ô rồi mới in: 2px cho ra
        //   ~146dpi trên giấy — mức mà máy quét đọc phập phù; 4px lên ~292dpi, vạch sắc nét.
        // ⚠⚠ `marginLeft/Right = 40px = 10 vạch mảnh` = ĐÚNG vùng trắng tối thiểu của CODE128. Nướng
        //   vào ảnh nên khi kéo giãn nó co giãn THEO vạch ⇒ luôn đúng chuẩn dù ô rộng hay hẹp.
        //   Trên/dưới không cần vùng trắng (mã 1D chỉ đọc theo chiều ngang).
        // ⚠⚠ PHẢI truyền `margin: 0` — JsBarcode `fixOptions` chạy `marginTop = marginTop || margin`,
        //   mà **`0` là falsy** ⇒ khai `marginTop: 0` KHÔNG có tác dụng, nó lấy `margin` mặc định = 10px
        //   (im lặng, không báo gì). Đặt `margin: 0` làm nền rồi mới đè trái/phải mới ra đúng ý.
        const opt = {
          displayValue: false, width: 4, height: 100,
          margin: 0, marginLeft: 40, marginRight: 40,
        };
        // ⚠ Hệ mã có RÀNG BUỘC dữ liệu (ITF đòi chẵn chữ số, EAN13 đòi 12–13 số…). JsBarcode NÉM LỖI
        //   khi dữ liệu không hợp ⇒ LÙI VỀ CODE128 để tem vẫn có mã quét được, thay vì mất trắng ô mã.
        try {
          JsBarcode(cv, it.gia_tri, { ...opt, format: it.he_ma || 'CODE128' });
        } catch (e) {
          console.warn(`[tem] Mã "${it.gia_tri}" không hợp hệ ${it.he_ma}, lùi về CODE128:`, e.message);
          JsBarcode(cv, it.gia_tri, { ...opt, format: 'CODE128' });
        }
        out[it.khoa] = cv.toDataURL('image/png');
      }
    } catch { /* mã hỏng → bỏ ảnh, giữ chữ */ }
  }
  return out;
}

// Khung PHẢI: `null` nghĩa là "in 2 nhãn GIỐNG hệt nhau" → dùng lại khung trái.
export const khungPhai = (boCuc) => (boCuc && boCuc.phai) || (boCuc && boCuc.trai) || null;
