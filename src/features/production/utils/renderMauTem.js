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

// Giá trị 1 trường dữ liệu, đã định dạng theo kiểu ô.
function giaTriTruong(data, ma, dinhDang, kieuTruong) {
  const v = data ? data[ma] : '';
  if (kieuTruong === 'ngay') return dinhDangNgay(v, dinhDang);
  if (kieuTruong === 'so') return fmtSo(v);
  return v == null ? '' : String(v);
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
      return giaTriTruong(data, p.ma, p.dinh_dang, kieu);
    }
    return '';
  }).join('');
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
  if (o.dam) st.push('font-weight:700');
  if (o.nghieng) st.push('font-style:italic');
  if (o.gach_chan) st.push('text-decoration:underline');
  if (o.nen) st.push(`background:${o.nen}`);
  if (o.mau_chu) st.push(`color:${o.mau_chu}`);
  st.push(o.xuong_dong === false ? 'white-space:nowrap' : 'word-break:break-word');
  return st.join(';');
}

// Ô mã vạch/QR: ảnh đã dựng sẵn (bất đồng bộ) truyền vào qua `anhMa[khoa]`.
function htmlOMa(o, khoa, anhMa, maText) {
  const src = anhMa ? anhMa[khoa] : '';
  const cao = o.kieu === 'qr' ? 'height:100%;max-height:100%' : 'height:60%';
  const img = src ? `<img src="${src}" alt="" style="display:block;margin:0 auto;max-width:100%;${cao}">` : '';
  const ma = o.hien_ma === false ? '' : `<div style="font-size:${Number(o.co_chu_mm) || 2.2}mm;font-weight:700;word-break:break-all;line-height:1.05">${esc(maText)}</div>`;
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

  const rows = hang.map((h, r) => {
    const tds = [];
    for (let c = 0; c < soCot; c += 1) {
      const khoa = `${r},${c}`;
      if (biChe.has(khoa)) continue;
      const cell = o[khoa] || {};
      const cs = Math.max(1, Number(cell.cs) || 1);
      const rs = Math.max(1, Number(cell.rs) || 1);
      const laMa = cell.kieu === 'qr' || cell.kieu === 'barcode';
      const maText = laMa ? giaTriTruong(data, cell.ma_qr || 'ma_tem', null, 'chu') : '';
      const noiDung = laMa ? htmlOMa(cell, khoa, anhMa, maText) : esc(noiDungO(cell, data, truongMap));
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
    const cao = h && h.cao_mm ? ` style="height:${h.cao_mm}mm"` : ' style="height:auto"';
    return `<tr${cao}>${tds.join('')}</tr>`;
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
      out.push({ khoa, kieu: cell.kieu, gia_tri: giaTriTruong(data, cell.ma_qr || 'ma_tem', null, 'chu') });
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
        out[it.khoa] = await QRCode.toDataURL(it.gia_tri, { margin: 0, width: 320, errorCorrectionLevel: 'M' });
      } else if (barcodeMod) {
        const JsBarcode = barcodeMod.default || barcodeMod;
        const cv = document.createElement('canvas');
        // `displayValue:false` — phần chữ do ô tự vẽ (để chỉnh cỡ chữ được ở panel thiết kế).
        JsBarcode(cv, it.gia_tri, { format: 'CODE128', displayValue: false, margin: 0, width: 2, height: 60 });
        out[it.khoa] = cv.toDataURL('image/png');
      }
    } catch { /* mã hỏng → bỏ ảnh, giữ chữ */ }
  }
  return out;
}

// Khung PHẢI: `null` nghĩa là "in 2 nhãn GIỐNG hệt nhau" → dùng lại khung trái.
export const khungPhai = (boCuc) => (boCuc && boCuc.phai) || (boCuc && boCuc.trai) || null;
