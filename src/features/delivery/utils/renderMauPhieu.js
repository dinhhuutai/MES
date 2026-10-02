import {
  renderKhung, dungAnhMa, JS_TU_CO, PAD_DOC_MM,
} from '../../production/utils/renderMauTem';

// ─────────────────────────────────────────────────────────────────────────────
// BỘ RENDER MẪU PHIẾU (mig 094) — từ `bo_cuc_json` dựng ra HTML 1 tờ phiếu A4/A5.
// DÙNG CHUNG cho CẢ xem trước trên màn thiết kế LẪN in thật ⇒ "xem sao in vậy".
//
// ⚠⚠ KHÁC MẪU TEM Ở ĐÚNG MỘT ĐIỂM: phiếu có **VÙNG LẶP DÒNG**. Bố cục 3 khối:
//     `dau` (lưới ô) → `lap` (2 hàng: tiêu đề + MẪU 1 dòng, được NHÂN theo số dòng) → `cuoi` (lưới ô).
//   Ô trong từng khối vẫn là hình dạng ô của mẫu tem ⇒ tái dùng NGUYÊN `renderKhung`, không viết
//   bộ render thứ hai (viết lại là sớm muộn 2 bên lệch luật định dạng).
//
// ⚠⚠ VÙNG LẶP dựng thành MỘT `<table>` có `<thead>` = hàng tiêu đề ⇒ trình duyệt TỰ LẶP hàng tiêu đề
//   ở mỗi trang khi phiếu dài quá 1 tờ. Ghép 3 khối thành 1 bảng duy nhất sẽ mất tính chất đó.
// ─────────────────────────────────────────────────────────────────────────────

const KHO = {
  A4: { rong: 210, cao: 297 },
  A5: { rong: 148, cao: 210 },
};
const LE_MAC_DINH = { tren: 12, phai: 10, duoi: 12, trai: 10 };

// Kích thước tờ + vùng nội dung (mm) — gương `backend/src/utils/mauPhieu.js vungNoiDung`.
export function khoPhieu(boCuc) {
  const k = KHO[(boCuc && boCuc.kho) || 'A4'] || KHO.A4;
  const ngang = (boCuc && boCuc.huong) === 'ngang';
  const le = { ...LE_MAC_DINH, ...((boCuc && boCuc.le) || {}) };
  const rongGiay = ngang ? k.cao : k.rong;
  const caoGiay = ngang ? k.rong : k.cao;
  return {
    rongGiay,
    caoGiay,
    le,
    rong: Math.max(10, rongGiay - (Number(le.trai) || 0) - (Number(le.phai) || 0)),
    cao: Math.max(10, caoGiay - (Number(le.tren) || 0) - (Number(le.duoi) || 0)),
  };
}

// CSS tờ phiếu — chỉ khung + lưới; kiểu chữ/viền do TỪNG Ô tự mang theo (inline style do `renderKhung`
// sinh), y hệt cách làm của mẫu tem.
// ⚠⚠ `@page margin: 0` + lề dựng bằng PADDING của từng tờ `.to` (02/10/2026): lề `@page` là chỗ trình
//   duyệt in DÒNG ĐẦU/CHÂN TRANG của nó (ngày giờ in · tiêu đề "Phiếu giao <số CT>" · URL · số trang) —
//   người dùng chốt bỏ dòng chữ đó. Lề 0 thì trình duyệt không còn chỗ in nên tự bỏ. Mỗi TỜ là một
//   `.to` riêng (chia tờ ở `renderPhieu`) nên tờ nào cũng có đủ lề trên/trái/phải; lề dưới được giữ bằng
//   cách ép nội dung mỗi tờ không vượt vùng nội dung (`heSoNen`).
export function cssPhieu(boCuc) {
  const k = khoPhieu(boCuc);
  const le = k.le;
  return `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #000; }
  .to { width: ${k.rongGiay}mm; padding: ${le.tren}mm ${le.phai}mm 0 ${le.trai}mm; }
  .to + .to { break-before: page; page-break-before: always; }
  table.mt-luoi { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.mt-luoi td { padding: ${PAD_DOC_MM / 2}mm 0.8mm; line-height: 1.15; overflow: hidden; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  @page { size: ${k.rongGiay}mm ${k.caoGiay}mm; margin: 0; }`;
}

// Một khối lưới ô (đầu / cuối phiếu).
// ⚠ `lapDayCao: false` — chiều cao trang phiếu thay đổi theo số dòng, ép bảng `height:100%` sẽ kéo
//   giãn hàng ra một cách vô nghĩa (khác tem: tem cao CỐ ĐỊNH 78mm nên phải lấp đầy).
function khoiLuoi(khung, data, anhMa) {
  if (!khung || !khung.so_cot) return '';
  return renderKhung(khung, data, anhMa, {
    lapDayCao: false,
    // Hàng thiếu `cao_mm` được `tongCaoKhoi` cho chiều cao mặc định ⇒ `caoHangMm` chia ra đúng số đó.
    caoVungMm: tongCaoKhoi(khung),
  });
}

// Tổng chiều cao đặt cứng của 1 khối; hàng không đặt `cao_mm` được cho 6mm mặc định.
// ⚠ Phiếu KHÔNG có khái niệm "chia đều phần trống" như tem (trang cao theo số dòng) ⇒ phải cho hàng
//   tự do một chiều cao cụ thể, nếu không `caoHangMm` chia ra số âm/0 và hàng bị bóp mất.
export const CAO_HANG_MAC_DINH = 6;
export function tongCaoKhoi(khung) {
  const hang = Array.isArray(khung && khung.hang) ? khung.hang : [];
  return hang.reduce((s, h) => s + (Number(h && h.cao_mm) > 0 ? Number(h.cao_mm) : CAO_HANG_MAC_DINH), 0);
}

// VÙNG LẶP: hàng 0 → `<thead>` (lặp mỗi trang), hàng 1 → nhân theo `dongs`.
// ⚠ Dựng bằng cách gọi `renderKhung` cho MỘT khung 1-hàng mỗi lần, rồi bóc phần `<tr>…</tr>` ra —
//   nhờ vậy mọi luật định dạng ô (viền, canh lề, tự co chữ, chiều cao mm) đi CHUNG một đường với tem.
// ─── CỘT CÓ ĐIỀU KIỆN (21/09/2026) ─────────────────────────────────────────────
// Ô TIÊU ĐỀ (hàng 0) của vùng lặp mang `hien_khi: { truong, chua }` ⇒ CẢ CỘT chỉ in ra khi có ÍT NHẤT
// MỘT dòng mà giá trị `truong` chứa chuỗi `chua` (không phân biệt hoa–thường). Dùng cho hàng RCS:
// cột KLG / Tổng TL (KG) chỉ hiện khi phiếu có mã hàng chứa "RCS".
// Trả Set chỉ số CỘT bị ẩn (tính theo phạm vi ô tiêu đề đó chiếm — ô gộp ngang ẩn cả dải).
export function cotAnTheoDieuKien(khung, dongs) {
  const an = new Set();
  Object.entries((khung && khung.o) || {}).forEach(([k, cell]) => {
    const [r, c] = k.split(',').map(Number);
    const hk = cell && cell.hien_khi;
    if (r !== 0 || !hk || !hk.truong || !String(hk.chua || '').trim()) return;
    const can = String(hk.chua).trim().toUpperCase();
    const co = (dongs || []).some((d) => String((d && d[hk.truong]) ?? '').toUpperCase().includes(can));
    if (!co) for (let j = c; j < c + Math.max(1, Number(cell.cs) || 1); j += 1) an.add(j);
  });
  return an;
}

// Bỏ các cột trong `an` khỏi khung: dời chỉ số ô, co `cs` của ô gộp ngang phủ qua cột bị bỏ, ô nằm
// trọn trong vùng bị bỏ thì mất luôn. `cot` (bề rộng) bỏ theo — phần bề rộng trống chia cho cột còn lại.
export function boCot(khung, an) {
  if (!an || !an.size) return khung;
  const n = Number(khung.so_cot);
  const giu = Array.from({ length: n }, (_, i) => i).filter((i) => !an.has(i));
  const moi = new Map(giu.map((c, i) => [c, i]));
  const o = {};
  Object.entries(khung.o || {}).forEach(([k, cell]) => {
    const [r, c] = k.split(',').map(Number);
    const cs = Math.max(1, Number(cell.cs) || 1);
    const conLai = [];
    for (let j = c; j < c + cs; j += 1) if (!an.has(j)) conLai.push(j);
    if (!conLai.length) return;
    o[`${r},${moi.get(conLai[0])}`] = { ...cell, cs: conLai.length };
  });
  return { ...khung, so_cot: giu.length, cot: giu.map((c) => (khung.cot || [])[c] || {}), o };
}

// `an` = tập cột ẩn đã tính trên TOÀN BỘ dòng của phiếu — phiếu nhiều tờ thì mọi tờ phải cùng bộ cột
//   (tính theo dòng của riêng từng tờ là tờ có cột KLG, tờ không).
function khoiLap(khung0, dongs, an = null) {
  if (!khung0 || !khung0.so_cot || !Array.isArray(khung0.hang) || khung0.hang.length < 2) return '';
  const khung = boCot(khung0, an || cotAnTheoDieuKien(khung0, dongs));
  if (!khung.so_cot) return '';
  const colgroup = `<colgroup>${Array.from({ length: Number(khung.so_cot) }, (_, i) => {
    const w = (khung.cot || [])[i] && (khung.cot || [])[i].rong_mm;
    return `<col${w ? ` style="width:${w}mm"` : ''}>`;
  }).join('')}</colgroup>`;

  // Tách khung 1 hàng: giữ nguyên `so_cot`/`cot`, chỉ lấy hàng `r` và các ô của nó.
  const motHang = (r) => {
    const o = {};
    Object.entries(khung.o || {}).forEach(([k, cell]) => {
      const [rr, cc] = k.split(',').map(Number);
      if (rr === r) o[`0,${cc}`] = { ...cell, rs: 1 };
    });
    return { so_cot: khung.so_cot, cot: khung.cot, hang: [khung.hang[r]], o };
  };
  // `renderKhung` trả nguyên `<table>…</table>` — bóc lấy phần bên trong `<colgroup>` để ghép vào
  // bảng chung (thead/tbody). Regex chỉ cần lấy mọi `<tr …>…</tr>`.
  const trCua = (khungHang, data) => {
    const html = renderKhung(khungHang, data, null, { lapDayCao: false, caoVungMm: tongCaoKhoi(khungHang) });
    const m = html.match(/<tr[\s\S]*<\/tr>/);
    return m ? m[0] : '';
  };

  const kTieuDe = motHang(0);
  const kDong = motHang(1);
  const body = (dongs && dongs.length ? dongs : [{}]).map((d) => trCua(kDong, d)).join('');
  return `<table class="mt-luoi">${colgroup}<thead>${trCua(kTieuDe, {})}</thead><tbody>${body}</tbody></table>`;
}

// ─── CHIA TỜ + NÉN CHIỀU CAO (02/10/2026 — "tối đa 15 tem trên 1 tờ A5") ──────────────────────
// Mẫu A5 ngang trên prod: đầu ~39mm + tiêu đề cột 7mm + cuối ~39mm ⇒ vùng nội dung 124mm chỉ còn chỗ
// cho ~6 dòng 6mm, dòng thứ 7 đã tràn sang tờ 2. Người dùng chốt: 1 tờ phải nhận được TỚI 15 tem.
// Cách làm — KHÔNG sửa mẫu người dùng đã thiết kế, chỉ xử lý lúc dựng:
//   1. CHIA TỜ: mỗi tờ tối đa `soDongMoiTo` dòng (≥ 15, hoặc nhiều hơn nếu mẫu vốn chứa vừa nhiều hơn
//      — vd A4 dọc). Khối ĐẦU lặp ở mọi tờ (tờ nào rời ra vẫn biết của phiếu nào), khối CUỐI (tổng,
//      chữ ký) chỉ ở tờ cuối. STT chạy liên tục qua các tờ.
//   2. NÉN: tờ nào cao hơn vùng nội dung thì nhân MỌI chiều cao hàng (đầu · vùng lặp · cuối) với cùng
//      một hệ số ⇒ bề ngang giữ nguyên, chữ tự co theo ô (`tu_co`, mặc định bật). Không nén dưới
//      `NEN_TOI_THIEU` — mẫu quá cao thì thà ít dòng/tờ hơn còn hơn chữ không đọc nổi.
// ⚠ Chiều cao mỗi hàng là mm CỐ ĐỊNH (`renderKhung`) nên tổng chiều cao tính trước được chính xác —
//   đó là lý do nén được bằng phép tính thay vì đo DOM.
export const TEM_TOI_DA_MOT_TO = 15;
export const NEN_TOI_THIEU = 0.6;
const DU_PHONG_MM = 1.5; // nét viền + làm tròn — để tờ không bao giờ đội quá vùng nội dung

const caoCacHang = (khung) => (Array.isArray(khung && khung.hang) ? khung.hang : [])
  .map((h) => (Number(h && h.cao_mm) > 0 ? Number(h.cao_mm) : CAO_HANG_MAC_DINH));

// Bản sao khung với mọi hàng = chiều cao gốc × hệ số (hàng tự do cũng được chốt mm cụ thể).
function nenKhung(khung, f) {
  if (!khung || !khung.so_cot || f >= 1) return khung;
  const cao = caoCacHang(khung);
  return { ...khung, hang: (khung.hang || []).map((h, i) => ({ ...(h || {}), cao_mm: Math.round(cao[i] * f * 100) / 100 })) };
}

// Kế hoạch chia tờ — tách riêng (hàm thuần) để màn thiết kế/kiểm thử dùng lại được.
export function keHoachChiaTo(boCuc, soDong) {
  const k = khoPhieu(boCuc);
  const vung = Math.max(10, k.cao - DU_PHONG_MM);
  const caoDau = boCuc.dau && boCuc.dau.so_cot ? tongCaoKhoi(boCuc.dau) : 0;
  const caoCuoi = boCuc.cuoi && boCuc.cuoi.so_cot ? tongCaoKhoi(boCuc.cuoi) : 0;
  const lap = caoCacHang(boCuc.lap);
  const caoTieuDe = lap[0] || 0;
  const caoDong = lap[1] || CAO_HANG_MAC_DINH;
  const coDinh = caoDau + caoTieuDe + caoCuoi;
  const vuaTuNhien = Math.floor((vung - coDinh) / caoDong);
  const vuaKhiNen = Math.floor((vung / NEN_TOI_THIEU - coDinh) / caoDong);
  const soDongMoiTo = Math.max(1, vuaTuNhien, Math.min(TEM_TOI_DA_MOT_TO, vuaKhiNen));
  const n = Math.max(1, soDong);
  const soTo = Math.ceil(n / soDongMoiTo);
  const to = Array.from({ length: soTo }, (_, i) => {
    const tu = i * soDongMoiTo;
    const den = Math.min(n, tu + soDongMoiTo);
    const cuoi = i === soTo - 1;
    const can = caoDau + caoTieuDe + (den - tu) * caoDong + (cuoi ? caoCuoi : 0);
    return { tu, den, cuoi, heSoNen: can > vung ? Math.max(NEN_TOI_THIEU, vung / can) : 1 };
  });
  return { soDongMoiTo, to };
}

// Dựng HTML thân phiếu (chưa gồm <html>/<style>) — MỘT hoặc NHIỀU tờ `.to`.
// `data` = dữ liệu mức PHIẾU · `dongs` = mảng dữ liệu mức DÒNG.
export async function renderPhieu(boCuc, data, dongs) {
  // Ảnh QR/mã vạch chỉ có ở khối đầu/cuối (vùng lặp không hỗ trợ — xem `kiemBoCucPhieu`).
  // ⚠ Dựng ảnh 1 lần từ khung GỐC: ảnh là dataURL, kích thước in do `htmlOMa` tính theo ô ĐÃ NÉN.
  const [aDau, aCuoi] = await Promise.all([
    boCuc.dau ? dungAnhMa(boCuc.dau, data) : Promise.resolve({}),
    boCuc.cuoi ? dungAnhMa(boCuc.cuoi, data) : Promise.resolve({}),
  ]);
  const ds = dongs && dongs.length ? dongs : [];
  const { to } = keHoachChiaTo(boCuc, ds.length);
  const anCot = boCuc.lap && boCuc.lap.so_cot ? cotAnTheoDieuKien(boCuc.lap, ds) : null;
  return to.map((t) => '<div class="to">'
    + khoiLuoi(nenKhung(boCuc.dau, t.heSoNen), data, aDau)
    // Phiếu rỗng ⇒ mảng rỗng ⇒ `khoiLap` tự dựng 1 dòng trống như trước.
    + khoiLap(nenKhung(boCuc.lap, t.heSoNen), ds.slice(t.tu, t.den), anCot)
    + (t.cuoi ? khoiLuoi(nenKhung(boCuc.cuoi, t.heSoNen), data, aCuoi) : '')
    + '</div>').join('');
}

// Tài liệu HTML hoàn chỉnh của 1 tờ phiếu. `deIn = true` → tự gọi `print()` + đóng cửa sổ.
export function htmlToPhieu(boCuc, than, tieuDe, deIn) {
  const js = `
    ${JS_TU_CO}
    function go(){ try { thuChu(); } catch(e){} ${deIn ? 'window.focus(); window.print();' : ''} }
    var chua = Array.prototype.slice.call(document.images).filter(function(i){ return !i.complete; });
    if (chua.length) {
      var con = chua.length;
      chua.forEach(function(i){ i.onload = i.onerror = function(){ if (--con === 0) setTimeout(go, 40); }; });
    } else { setTimeout(go, ${deIn ? 150 : 40}); }`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${tieuDe || 'Phiếu'}</title>
<style>${cssPhieu(boCuc)}</style></head>
<body${deIn ? ' onafterprint="window.close()"' : ''}>
${than}
<script>${js}</script>
</body></html>`;
}
