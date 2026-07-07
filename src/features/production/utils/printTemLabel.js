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
// Ngắn gọn (bỏ năm): dd/MM HH:mm — dùng cho ô thời gian phơi.
const fmtDtShort = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

// In tem sản xuất theo mẫu THLA: 2 nhãn cạnh nhau trên tờ 110x80mm.
//  - Mỗi tem KHUNG = 55x80mm, nhưng NỘI DUNG chỉ 51x76mm (căn lề 2mm mỗi cạnh) → 2 tem cách nhau 4mm.
//  - Nhãn trái = PHIẾU GIAO HÀNG (form 104-THLA-CM I-011 B3)
//  - Nhãn phải = IN-K / lưới kiểm (form 104-THLA-CM I-011 B2)
// QR mã hóa MÃ TEM.
export default async function printTemLabel(label) {
  if (!label || !label.ma_tem) return;

  let qrUrl = '';
  try {
    qrUrl = await QRCode.toDataURL(String(label.ma_tem), { margin: 0, width: 320, errorCorrectionLevel: 'M' });
  } catch (e) {
    qrUrl = '';
  }

  const d = {
    ma_tem: esc(label.ma_tem),
    ngayIn: esc(fmtDt(label.created_date)),
    khach: esc(label.ten_khach_hang),
    chuyen: esc(label.ma_chuyen || label.ten_chuyen || ''),
    po: esc(label.ma_don_hang),
    mh: esc(label.ma_hang),
    mv: esc(label.mau_vai),
    kv: esc(label.kich_vai),
    kp: esc(label.kich_phim),
    slTong: fmtNum(label.so_luong_don_hang),
    slIn: fmtNum(label.so_luong),
    tgBdPhoi: esc(fmtDtShort(label.tg_bd_phoi)),
    tgKtPhoi: esc(fmtDtShort(label.tg_kt_phoi)),
  };
  // QR là 1 băng riêng ở trên (QR trái + ô trống phải), thông tin nằm full-width bên dưới.
  const qrBand = `<table class="t qb"><tr><td class="qr">${qrUrl ? `<img src="${qrUrl}" alt="">` : ''}<div class="ma">${d.ma_tem}</div></td><td class="v"></td></tr></table>`;

  // ---- Nhãn trái: PHIẾU GIAO HÀNG ----
  const leftLabel = `
    <div class="label">
      <table class="hd"><tr><td class="brand">THLA</td><td class="title">PHIẾU GIAO HÀNG</td><td class="dt">${d.ngayIn}</td></tr></table>
      ${qrBand}
      <table class="t"><colgroup><col style="width:9mm"><col><col><col style="width:17mm"></colgroup>
        <tr><td class="v" colspan="3">${d.khach}</td><td class="v">${d.chuyen}</td></tr>
        <tr><td class="lbl">PO</td><td class="v" colspan="3">${d.po}</td></tr>
        <tr><td class="lbl">MH</td><td class="v" colspan="3">${d.mh}</td></tr>
        <tr><td class="lbl">MV</td><td class="v" colspan="3">${d.mv}</td></tr>
        <tr><td class="lbl">KV</td><td class="v" colspan="3">${d.kv}</td></tr>
        <tr><td class="lbl">KP</td><td class="v" colspan="3">${d.kp}</td></tr>
        <tr><td class="v big" colspan="2">${d.slTong}</td><td class="v sm" colspan="2">${d.tgBdPhoi} - ${d.tgKtPhoi}</td></tr>
        <tr><td class="lbl">IN</td><td class="v big" colspan="3">${d.slIn}</td></tr>
      </table>
      <table class="t bot"><colgroup><col style="width:11mm"><col><col><col></colgroup>
        <tr><td class="lbl">Lo</td><td></td><td></td><td></td></tr>
        <tr><td class="lbl">SL Giao</td><td></td><td></td><td></td></tr>
        <tr><td class="lbl">KCS</td><td></td><td></td><td></td></tr>
        <tr><td class="lbl">N Kiểm</td><td></td><td></td><td></td></tr>
      </table>
      <div class="code">104-THLA-CM I-011 B3</div>
    </div>`;

  // ---- Nhãn phải: IN-K ----
  const rightLabel = `
    <div class="label">
      <table class="hd"><tr><td class="brand">THLA</td><td class="title">IN-K</td><td class="dt">${d.ngayIn}</td></tr></table>
      ${qrBand}
      <table class="t"><colgroup><col><col><col><col></colgroup>
        <tr><td class="v" colspan="2">${d.khach}</td><td class="v" colspan="2">${d.po}</td></tr>
        <tr><td class="v" colspan="4">${d.mh}</td></tr>
        <tr><td class="v" colspan="4">${d.mv}</td></tr>
        <tr><td class="v" colspan="2">${d.kv}</td><td class="v" colspan="2">${d.kp}</td></tr>
        <tr><td class="v big" colspan="2">${d.slTong}</td><td class="v" colspan="2">${d.chuyen}</td></tr>
      </table>
      <table class="t grid">
        <tr><th>IN</th><th>KIỂM</th><th>ĐẠT</th><th>SỬA</th><th>HỦY</th></tr>
        <tr><td class="big">${d.slIn}</td><td></td><td></td><td></td><td></td></tr>
        <tr><td class="lbl" colspan="2">LOẠI LỖI</td><td class="lbl">SL</td><td class="lbl">S.ĐẠT</td><td class="lbl">S.HỦY</td></tr>
        <tr><td colspan="2"></td><td></td><td></td><td></td></tr>
        <tr><td colspan="2"></td><td></td><td></td><td></td></tr>
      </table>
      <div class="code">104-THLA-CM I-011 B2</div>
    </div>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Tem ${d.ma_tem}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #000; }
  /* Tờ 110x80mm; mỗi tem khung 55x80, nội dung 51x76 (căn lề 2mm) → 2 tem cách 4mm */
  .sheet { display: flex; width: 110mm; height: 80mm; }
  .label { width: 55mm; height: 80mm; padding: 2mm; display: flex; flex-direction: column; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { border: 0.025mm solid #000; padding: 0.25mm 0.6mm; font-size: 2.2mm; line-height: 1.02;
           overflow: hidden; word-break: break-word; text-align: center; vertical-align: middle; }
  /* Bỏ viền-trên của các bảng con → mối nối giữa các bảng chỉ còn 1 nét (hết nét đôi ở dòng QR / dưới IN) */
  .t td, .t th { border-top: 0; }
  .lbl  { font-weight: 600; background: #f1f1f1; text-align: left; white-space: nowrap; }
  .lbl2 { font-weight: 600; background: #f1f1f1; text-align: left; font-size: 2mm; }
  .v    { font-weight: 600; font-size: 2.4mm; }
  .v.big, td.big { font-size: 3mm; font-weight: 700; }
  .v.sm { font-size: 1.8mm; white-space: nowrap; }   /* ô thời gian phơi (dài) — nhỏ + 1 dòng để không phá khung */
  /* Header */
  .hd td { font-weight: 600; }
  .hd .brand { width: 8mm; }
  .hd .title { font-size: 2.8mm; letter-spacing: .1mm; }
  .hd .dt { width: 13mm; font-weight: 400; font-size: 1.9mm; }
  /* QR (băng riêng) — nhỏ gọn để vừa chiều cao tem trái */
  .qb .qr { width: 20mm; }
  .qb .qr img { width: 14mm; height: 14mm; display: block; margin: 0.3mm auto 0; max-width: 100%; }
  .qb .qr .ma { font-size: 2.2mm; font-weight: 700; margin-top: 0.2mm; word-break: break-all; }
  /* Các dòng nội dung cao đều, dòng dưới (ghi tay) giãn ra lấp phần trống */
  .t td, .t th { height: 3.4mm; }
  .bot { flex: 1; }
  .bot td { height: 4mm; }
  .grid th { background: #f1f1f1; font-weight: 700; }
  .grid { flex: 1; }
  .grid td { height: 4.4mm; }
  .code { font-size: 1.8mm; text-align: right; padding: 0.5mm 0.6mm 0; }
  @page { size: 110mm 80mm; margin: 0; }
</style></head>
<body onafterprint="window.close()">
  <div class="sheet">${leftLabel}${rightLabel}</div>
  <script>
    var img = document.querySelector('.qr img');
    function go(){ window.focus(); window.print(); }
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else { setTimeout(go, 100); }
  </script>
</body></html>`;

  const w = window.open('', '_blank', 'width=560,height=460');
  if (!w) {
    alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này rồi in lại.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
