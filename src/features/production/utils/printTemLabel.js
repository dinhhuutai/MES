import JsBarcode from 'jsbarcode';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtNum = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN'));
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// In tờ tem: thông tin phần in + barcode Code128 (mã tem, duy nhất). Mở cửa sổ in riêng.
export default function printTemLabel(label) {
  if (!label || !label.ma_tem) return;

  // Barcode Code128 của mã tem → ảnh PNG.
  let barcodeUrl = '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, label.ma_tem, {
      format: 'CODE128', displayValue: true, fontSize: 18, textMargin: 2,
      height: 60, width: 2, margin: 6,
    });
    barcodeUrl = canvas.toDataURL('image/png');
  } catch (e) {
    barcodeUrl = '';
  }

  const row = (k, v) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v || '—')}</td></tr>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Tem ${esc(label.ma_tem)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; margin: 0; padding: 10px; color: #111; }
  .label { width: 320px; border: 1px solid #000; border-radius: 6px; padding: 10px; margin: 0 auto; }
  .head { text-align: center; font-weight: 700; font-size: 13px; letter-spacing: .5px; border-bottom: 1px dashed #999; padding-bottom: 6px; margin-bottom: 6px; }
  .barcode { text-align: center; margin: 4px 0 8px; }
  .barcode img { max-width: 100%; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 2px 3px; vertical-align: top; }
  td.k { color: #555; width: 82px; white-space: nowrap; }
  td.v { font-weight: 600; }
  .qty { text-align: center; font-size: 22px; font-weight: 800; margin: 6px 0; border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 4px 0; }
  .foot { font-size: 10px; color: #666; margin-top: 6px; text-align: center; }
  @media print { body { padding: 0; } .label { border: none; } @page { margin: 6mm; } }
</style></head>
<body onafterprint="window.close()">
  <div class="label">
    <div class="head">THLA MES · TEM SẢN XUẤT</div>
    <div class="barcode">${barcodeUrl ? `<img src="${barcodeUrl}" alt="${esc(label.ma_tem)}">` : esc(label.ma_tem)}</div>
    <table>
      ${row('Khách hàng', label.ten_khach_hang)}
      ${row('Đơn hàng', label.ma_don_hang)}
      ${row('Mã hàng', label.ma_hang)}
      ${row('Code phần', label.ma_phan)}
      ${row('Màu vải', label.mau_vai)}
      ${row('Kích vải', label.kich_vai)}
      ${row('Kích phim', label.kich_phim)}
      ${row('Lệnh SX', label.ma_lenh_san_xuat)}
      ${row('Chuyền', [label.ma_chuyen, label.ten_chuyen].filter(Boolean).join(' - '))}
    </table>
    <div class="qty">SL: ${fmtNum(label.so_luong)}</div>
    <div class="foot">${esc(label.ma_tem)} · In: ${esc(fmtDt(label.created_date))}${label.nguoi_in ? ` · ${esc(label.nguoi_in)}` : ''}</div>
  </div>
  <script>
    var img = document.querySelector('.barcode img');
    function go(){ window.focus(); window.print(); }
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else { setTimeout(go, 100); }
  </script>
</body></html>`;

  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) {
    // Popup bị chặn.
    alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này rồi in lại.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
