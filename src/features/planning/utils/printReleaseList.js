// In "DANH SÁCH RELEASE" trực tiếp ra A4 (ngang) — mở cửa sổ in với HTML bám form giấy.
//
// ⚠ SỐ DÒNG ĐẾM THEO ĐỢT SẢN XUẤT: lệnh gom set ra nhiều dòng (1 dòng/phần in) nhưng các ô ở MỨC
//   LỆNH (STT · Chuyền · SL đã in/giao · Owner · Giờ BD/KT · Xác nhận) hợp nhất bằng `rowspan` ⇒ trên
//   giấy 1 đợt SX vẫn là 1 khối, chỗ ký cũng 1 ô cho cả set. Dùng chung `gopTheoLenh` với modal/Excel.
import { gopTheoLenh, demLenh } from './gopDongRelease';

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmtDMY = (s) => { if (!s) return ''; const x = new Date(s); return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const fmtNum = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('vi-VN'));
const fmtClock = (ts) => {
  if (!ts) return '';
  const x = new Date(ts); if (Number.isNaN(+x)) return '';
  let h = x.getHours(); const m = x.getMinutes(); const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ap}`;
};

export default function printReleaseList(items, meta) {
  const ds = gopTheoLenh(items);
  const rows = ds.map((r) => {
    const rs = r._span > 1 ? ` rowspan="${r._span}"` : '';
    // Ô mức LỆNH chỉ vẽ ở dòng ĐẦU của đợt SX; dòng sau bỏ hẳn cell (rowspan đã phủ).
    const mucLenh = r._dau ? {
      stt: `<td class="n g"${rs}>${r._stt}</td>`,
      chuyen: `<td class="g"${rs}>${esc(r.ten_chuyen)}${r._span > 1 ? `<div class="gs">gom set ${r._span}</div>` : ''}</td>`,
      daIn: `<td class="n g"${rs}>${r.sl_da_in == null ? '' : fmtNum(r.sl_da_in)}</td>`,
      daGiao: `<td class="n g"${rs}>${r.sl_da_giao == null ? '' : fmtNum(r.sl_da_giao)}</td>`,
      owner: `<td class="g"${rs}></td>`,
      gioBd: `<td class="g"${rs}>${fmtClock(r.tg_bd_kh)}</td>`,
      gioKt: `<td class="g"${rs}>${fmtClock(r.tg_kt_kh)}</td>`,
      xacNhan: `<td class="g"${rs}></td>`,
    } : {};
    return `
    <tr${r._dau ? ' class="dau"' : ''}>
      ${mucLenh.stt || ''}
      ${mucLenh.chuyen || ''}
      <td>${esc(r.ten_khach_hang)}</td>
      <td>${esc(r.ma_don_hang)}</td>
      <td class="l">${esc(r.ten_ma_hang || r.ma_hang)}</td>
      <td class="l">${esc(r.ma_phan)}</td>
      <td class="l">${esc(r.mau_vai)}</td>
      <td>${esc(r.kich_vai)}</td>
      <td>${esc(r.kich_phim)}</td>
      <td class="n">${fmtNum(r.so_luong_don_hang)}</td>
      <td class="n">${fmtNum(r.slnv)}</td>
      ${mucLenh.daIn || ''}
      ${mucLenh.daGiao || ''}
      <td class="n b">${fmtNum(r.sl_release_phan ?? r.so_luong_release)}</td>
      ${mucLenh.owner || ''}
      ${mucLenh.gioBd || ''}
      ${mucLenh.gioKt || ''}
      ${mucLenh.xacNhan || ''}
    </tr>`;
  }).join('');

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <title>Danh sách release ${fmtDMY(meta?.ngay)}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, "Helvetica Neue", sans-serif; color: #111; margin: 0; }
      h1 { text-align: center; font-size: 15px; margin: 0 0 6px; }
      .sum { display: flex; justify-content: center; gap: 26px; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
      .sum span b { font-weight: 800; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; }
      th, td { border: 0.5px solid #333; padding: 2px 3px; text-align: center; }
      th { background: #eef1f6; font-weight: bold; }
      td.l { text-align: left; }
      td.n { text-align: right; font-variant-numeric: tabular-nums; }
      td.b { font-weight: bold; }
      td.g { vertical-align: middle; }        /* ô hợp nhất của đợt SX — canh giữa cho dễ đọc */
      tr.dau td { border-top: 1px solid #333; } /* nét đậm hơn = ranh giới giữa 2 đợt SX */
      .gs { font-size: 7px; color: #555; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    </style></head><body>
    <h1>DANH SÁCH RELEASE ${meta?.mode === 'RELEASE' ? '— NGÀY RELEASE' : 'NGÀY'} ${fmtDMY(meta?.ngay)}</h1>
    <div class="sum">
      <span>TỔNG ĐƠN: <b>${meta?.tong_don ?? 0}</b></span>
      <span>TỔNG MÃ: <b>${meta?.tong_ma ?? 0}</b></span>
      <span>TỔNG PHẦN: <b>${meta?.tong_phan ?? 0}</b></span>
      <span>ĐỢT SX: <b>${demLenh(items)}</b></span>
      <span>SL RELEASE: <b>${fmtNum(meta?.sl_release ?? 0)}</b></span>
    </div>
    <table>
      <thead><tr>
        <th>STT</th><th>CHUYỀN</th><th>KH</th><th>PO</th><th>MÃ</th><th>CODE PHẦN</th>
        <th>Màu vải</th><th>Kích vải</th><th>Kích phim</th>
        <th>SLĐH</th><th>SLNV</th><th>SL ĐÃ IN</th><th>SL ĐÃ GIAO</th><th>SL RELEASE</th>
        <th>OWNER</th><th>GIỜ BD</th><th>GIỜ KT</th><th>XÁC NHẬN</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="18" style="padding:16px">Không có dữ liệu</td></tr>'}</tbody>
    </table>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}
