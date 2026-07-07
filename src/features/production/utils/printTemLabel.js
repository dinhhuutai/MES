import QRCode from 'qrcode';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtNum = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('vi-VN'));
const p2 = (n) => String(n).padStart(2, '0');
// Ngày giờ gọn: dd/MM/yy HH:mm
const fmtDt = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

// In tem sản xuất: mỗi lần in ra 2 nhãn 110x80mm cạnh nhau (tổng 220x80mm) theo mẫu THLA:
//  - Nhãn trái  = PHIẾU GIAO HÀNG (mã form 104-THLA-CM I-011 B3)
//  - Nhãn phải  = IN-K / lưới kiểm (mã form 104-THLA-CM I-011 B2)
// Cùng QR (mã hóa MÃ TEM) + mã tem + block thông tin; khác phần dưới.
export default async function printTemLabel(label) {
  if (!label || !label.ma_tem) return;

  let qrUrl = '';
  try {
    qrUrl = await QRCode.toDataURL(String(label.ma_tem), { margin: 0, width: 360, errorCorrectionLevel: 'M' });
  } catch (e) {
    qrUrl = '';
  }

  const chuyen = label.ma_chuyen || label.ten_chuyen || '';
  const sl = fmtNum(label.so_luong);
  const ngayIn = fmtDt(label.created_date);

  // Block chung: header (THLA | tiêu đề | ngày giờ in) + QR + 6 dòng thông tin.
  const topBlock = (title) => `
    <table class="hd">
      <tr>
        <td class="brand">THLA</td>
        <td class="title">${esc(title)}</td>
        <td class="dt">${esc(ngayIn)}</td>
      </tr>
    </table>
    <table class="body">
      <tr>
        <td class="qr" rowspan="6">
          ${qrUrl ? `<img src="${qrUrl}" alt="${esc(label.ma_tem)}">` : ''}
          <div class="ma">${esc(label.ma_tem)}</div>
        </td>
        <td class="c half">${sl}</td>
        <td class="c half">${esc(chuyen)}</td>
      </tr>
      <tr><td class="c" colspan="2">${esc(label.ma_don_hang)}</td></tr>
      <tr><td class="c" colspan="2">${esc(label.ma_hang)}</td></tr>
      <tr><td class="c" colspan="2">${esc(label.mau_vai)}</td></tr>
      <tr><td class="c" colspan="2">${esc(label.kich_vai)}</td></tr>
      <tr><td class="c" colspan="2">${esc(label.kich_phim)}</td></tr>
    </table>`;

  // Nhãn trái: PHIẾU GIAO HÀNG.
  const leftLabel = `
    <div class="label">
      ${topBlock('PHIẾU GIAO HÀNG')}
      <table class="lower gh">
        <colgroup><col class="c1"><col class="c2"><col><col></colgroup>
        <tr><td class="lbl">Lo</td><td>${sl}</td><td colspan="2">${esc(fmtDt(label.tg_bd_in))}</td></tr>
        <tr><td class="lbl">SL Giao</td><td></td><td colspan="2" rowspan="3"></td></tr>
        <tr><td class="lbl">KCS</td><td></td></tr>
        <tr><td class="lbl">N Kiểm</td><td></td></tr>
      </table>
      <div class="code">104-THLA-CM I-011 B3</div>
    </div>`;

  // Nhãn phải: IN-K (lưới kiểm IN/KIỂM/ĐẠT/SỬA/HỦY + LOẠI LỖI).
  const rightLabel = `
    <div class="label">
      ${topBlock('IN-K')}
      <table class="lower grid">
        <tr><th>IN</th><th>KIỂM</th><th>ĐẠT</th><th>SỬA</th><th>HỦY</th></tr>
        <tr><td>${sl}</td><td></td><td></td><td></td><td></td></tr>
        <tr><td class="lbl">LOẠI LỖI</td><td></td><td class="lbl">SL</td><td class="lbl">S.ĐẠT</td><td class="lbl">S.HỦY</td></tr>
        <tr><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td><td></td><td></td></tr>
      </table>
      <div class="code">104-THLA-CM I-011 B2</div>
    </div>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Tem ${esc(label.ma_tem)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #000; }
  /* Cả tờ 2 tem = 110x80mm → mỗi tem 55x80mm; thụt nội dung vào 4 cạnh (padding) */
  .sheet { display: flex; width: 110mm; height: 80mm; }
  .label {
    width: 55mm; height: 80mm; padding: 1.2mm;
    display: flex; flex-direction: column; overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { border: 0.08mm solid #000; padding: 0.2mm 0.5mm; font-size: 1.7mm; line-height: 1.0;
           overflow: hidden; word-break: break-word; }
  /* Gộp đường viền giữa các bảng xếp chồng để không bị nét đôi (đậm) */
  .hd, .body { margin-bottom: -0.08mm; }
  /* Header */
  .hd td { font-weight: 700; }
  .hd .brand { width: 8mm; text-align: center; }
  .hd .title { text-align: center; font-size: 2mm; letter-spacing: .1mm; }
  .hd .dt { width: 14mm; text-align: center; font-weight: 400; font-size: 1.6mm; }
  /* QR to (dễ quét) + thông tin nhỏ lại */
  .body .qr { width: 27mm; text-align: center; vertical-align: middle; }
  .body .qr img { width: 25mm; height: 25mm; display: block; margin: 0.4mm auto 0; }
  .body .qr .ma { font-size: 2mm; font-weight: 700; margin-top: 0.3mm; word-break: break-all; }
  .body .c { font-weight: 700; text-align: center; height: 4.3mm; font-size: 1.7mm; }
  .body .half { width: 13mm; }
  /* Phần dưới */
  .lower { flex: 1; }
  .lower td, .lower th { height: 4.5mm; text-align: center; vertical-align: middle; font-size: 1.8mm; }
  .lower .lbl { font-weight: 700; background: #f2f2f2; text-align: left; }
  .grid th { font-weight: 700; background: #f2f2f2; }
  .gh col.c1 { width: 10mm; }
  .gh col.c2 { width: 8mm; }
  .code { font-size: 1.7mm; text-align: right; padding: 0.5mm 0.6mm 0; }
  @page { size: 110mm 80mm; margin: 0; }
</style></head>
<body onafterprint="window.close()">
  <div class="sheet">
    ${leftLabel}
    ${rightLabel}
  </div>
  <script>
    var img = document.querySelector('.qr img');
    function go(){ window.focus(); window.print(); }
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else { setTimeout(go, 100); }
  </script>
</body></html>`;

  const w = window.open('', '_blank', 'width=520,height=440');
  if (!w) {
    alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này rồi in lại.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
