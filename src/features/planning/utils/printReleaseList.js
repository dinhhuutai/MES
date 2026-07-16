// In "DANH SÁCH RELEASE" trực tiếp ra A4 (ngang) — mở cửa sổ in với HTML bám form giấy.
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
  const rows = (items || []).map((r) => `
    <tr>
      <td>${esc(r.ten_chuyen)}</td>
      <td>${esc(r.ten_khach_hang)}</td>
      <td>${esc(r.ma_don_hang)}</td>
      <td class="l">${esc(r.ten_ma_hang || r.ma_hang)}</td>
      <td class="l">${esc(r.mau_vai)}</td>
      <td>${esc(r.kich_vai)}</td>
      <td>${esc(r.kich_phim)}</td>
      <td class="n">${fmtNum(r.so_luong_don_hang)}</td>
      <td class="n">${fmtNum(r.slnv)}</td>
      <td class="n">${fmtNum(r.sl_da_in)}</td>
      <td class="n">${fmtNum(r.sl_da_giao)}</td>
      <td class="n b">${fmtNum(r.so_luong_release)}</td>
      <td></td>
      <td>${fmtClock(r.tg_bd_kh)}</td>
      <td>${fmtClock(r.tg_kt_kh)}</td>
      <td></td>
    </tr>`).join('');

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
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    </style></head><body>
    <h1>DANH SÁCH RELEASE NGÀY ${fmtDMY(meta?.ngay)}</h1>
    <div class="sum">
      <span>TỔNG ĐƠN: <b>${meta?.tong_don ?? 0}</b></span>
      <span>TỔNG MÃ: <b>${meta?.tong_ma ?? 0}</b></span>
      <span>TỔNG PHẦN: <b>${meta?.tong_phan ?? 0}</b></span>
      <span>SL RELEASE: <b>${fmtNum(meta?.sl_release ?? 0)}</b></span>
    </div>
    <table>
      <thead><tr>
        <th>CHUYỀN</th><th>KH</th><th>PO</th><th>MÃ</th>
        <th>Màu vải</th><th>Kích vải</th><th>Kích phim</th>
        <th>SLĐH</th><th>SLNV</th><th>SL ĐÃ IN</th><th>SL ĐÃ GIAO</th><th>SL RELEASE</th>
        <th>OWNER</th><th>GIỜ BD</th><th>GIỜ KT</th><th>XÁC NHẬN</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="16" style="padding:16px">Không có dữ liệu</td></tr>'}</tbody>
    </table>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}
