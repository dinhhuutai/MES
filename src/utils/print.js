// In phiếu giao (mock "in tem giao") — mở cửa sổ mới + window.print.
export function printGiaoHang(gh) {
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return;
  const rows = (gh.tems || [])
    .map(
      (t) =>
        `<tr><td>${t.ma_tem}</td><td>${t.ma_lenh_san_xuat || ''}</td><td style="text-align:right">${t.so_luong_giao ?? ''}</td></tr>`
    )
    .join('');
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${gh.ma_phieu_giao}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;color:#111827;padding:32px}
      h1{font-size:20px;margin:0 0 4px}
      .meta{color:#6b7280;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      th,td{border-bottom:1px solid #e5e7eb;padding:8px 10px;text-align:left}
      th{background:#f9fafb;font-size:12px;text-transform:uppercase;color:#6b7280}
      .total{margin-top:16px;font-weight:600;text-align:right}
    </style></head><body>
    <h1>PHIẾU GIAO HÀNG — ${gh.ma_phieu_giao}</h1>
    <div class="meta">Khách hàng: ${gh.ten_khach_hang || '—'} · Đơn hàng: ${gh.ma_don_hang || '—'} · Ngày: ${gh.ngay_giao ? new Date(gh.ngay_giao).toLocaleDateString('vi-VN') : '—'}</div>
    <table><thead><tr><th>Mã tem</th><th>Lệnh SX</th><th style="text-align:right">SL giao</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Tổng: ${gh.tong_sl ?? ''} (${gh.so_tem ?? (gh.tems || []).length} tem)</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
