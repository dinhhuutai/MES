import { useState, useEffect } from 'react';
import Spinner from './Spinner';
import Pagination from './Pagination';

// columns: [{ key, header, render?(row), className?, headerClassName?, selection?, merge? }]
//   - selection: true → cột chọn (checkbox); được render TRƯỚC cột STT.
//   - merge: true → khi hàng TÁCH NHIỀU DÒNG CON (xem `subRows`), ô này hợp nhất bằng `rowSpan`.
// sttStart: nếu là số → hiện cột "STT" bắt đầu từ sttStart+1 (truyền (page-1)*limit để liên tục giữa các trang).
// rowClassName(row): trả class nền theo hàng (vd tô màu cảnh báo SLA).
// pageSize: PHÂN TRANG CLIENT-SIDE (mặc định 20/trang). Đặt 0 nếu trang tự phân trang server (có <Pagination> riêng).
// subRows(row) → mảng dòng con | null: 1 BẢN GHI hiện thành NHIỀU DÒNG (vd lệnh GOM SET = nhiều phần in).
//   Mỗi dòng con render với hàng hợp nhất `{...row, ...sub}` nên `render(r)` của cột dùng được ngay các
//   trường của phần in. Cột `merge` (+ STT + ô chọn) chỉ vẽ Ở DÒNG ĐẦU với `rowSpan`. Phân trang/STT vẫn
//   đếm theo BẢN GHI (1 lệnh = 1 STT) — đúng ý "hợp nhất ô ở STT".
// Responsive: md+ hiển thị dạng BẢNG; dưới md tự đổi sang dạng THẺ (card) cho mobile/tablet.
export default function DataTable({ columns, rows, loading, rowKey = 'id', emptyText = 'Không có dữ liệu', onRowClick, sttStart, rowClassName, pageSize = 20, subRows }) {
  const allRows = rows || [];
  const clientPaged = pageSize > 0 && allRows.length > pageSize;
  const [cpage, setCpage] = useState(1);
  const totalPages = clientPaged ? Math.ceil(allRows.length / pageSize) : 1;
  useEffect(() => { setCpage(1); }, [allRows.length]); // đổi số dòng (lọc/tải mới) → về trang 1
  const safePage = Math.min(Math.max(cpage, 1), totalPages);
  const viewRows = clientPaged ? allRows.slice((safePage - 1) * pageSize, safePage * pageSize) : allRows;

  // ⚠⚠ CHỐNG NHÁY MÀN HÌNH (chốt 2026-08-11): CHỈ thay bảng bằng spinner khi TẢI LẦN ĐẦU (chưa có
  // dòng nào). Đang có dòng mà tải lại (socket realtime, đổi bộ lọc, phân trang) thì **GIỮ NGUYÊN
  // dòng cũ** + chỉ chạy một vạch mảnh trên đỉnh.
  // Vì sao: 14 trang cho handler socket gọi `load()` có `setLoading(true)`, mà backend bắn 2-3 sự kiện
  // cho MỖI thao tác + job phơi khô broadcast mỗi 60 giây ⇒ bảng biến mất/hiện lại liên tục, người
  // dùng gọi là "nháy quá khó chịu". Sửa Ở ĐÂY là hết nháy cho MỌI trang dùng DataTable, kể cả trang
  // chưa kịp chuyển sang tải ngầm. KHÔNG đổi API component ⇒ không trang nào phải sửa theo.
  const laTaiLanDau = loading && allRows.length === 0;
  const dangTaiNgam = loading && allRows.length > 0;

  // Vạch tiến trình mảnh — dấu hiệu DUY NHẤT cho biết đang tải lại (thay cho spinner nuốt cả bảng).
  const VachTai = () => (
    <div className="h-0.5 w-full animate-pulse bg-primary/60" role="presentation" />
  );
  const sttBase = (typeof sttStart === 'number' ? sttStart : 0) + (clientPaged ? (safePage - 1) * pageSize : 0);

  const showStt = typeof sttStart === 'number';
  const selCols = columns.filter((c) => c.selection);
  const restCols = columns.filter((c) => !c.selection);
  // Cột thao tác (header rỗng) ở CUỐI → GHIM DÍNH bên phải để luôn bấm được dù bảng cuộn ngang.
  const trailingActions = [];
  for (let k = restCols.length - 1; k >= 0 && !restCols[k].header; k -= 1) trailingActions.unshift(restCols[k]);
  const bodyCols = restCols.slice(0, restCols.length - trailingActions.length);
  const totalCols = columns.length + (showStt ? 1 : 0);

  const cellValue = (c, row) => (c.render ? c.render(row) : row[c.key]);
  // Dòng con của 1 bản ghi (≥2 mới tách; 0/1 → giữ nguyên 1 dòng như trước).
  const subsOf = (row) => {
    const s = subRows ? subRows(row) : null;
    return Array.isArray(s) && s.length > 1 ? s : null;
  };
  // Padding/kích thước co theo bề rộng: laptop (md→xl) gọn để đỡ kéo ngang; chỉ màn RẤT rộng (2xl+) mới giãn.
  const PAD_H = 'px-1.5 py-2 lg:px-2.5 2xl:px-4 2xl:py-3 text-[10px] lg:text-[11px] 2xl:text-xs font-semibold uppercase tracking-tight lg:tracking-wide text-ink-soft';
  const PAD_C = 'px-1.5 py-1.5 lg:px-2.5 lg:py-2 2xl:px-4 2xl:py-3 align-middle';
  // Header dính đỉnh (sticky top-0) để cuộn dọc trong bảng vẫn thấy tiêu đề.
  // sticky (cột thao tác ghim phải) → thêm right-0 + z cao hơn để đè phần thân.
  const renderHeader = (c, sticky) => (
    <th key={c.key} className={`${PAD_H} sticky top-0 bg-surface-muted ${sticky ? 'right-0 z-30 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]' : 'z-20'} ${c.headerClassName || ''}`}>
      {c.header}
    </th>
  );
  // ⚠ Ô CHỌN (selection) phải CHẶN nổi bọt click: các trang chỉ đặt stopPropagation trên chính thẻ
  // <input>, nên bấm vào PHẦN ĐỆM quanh checkbox vẫn kích onRowClick → mở SidePanel ngoài ý muốn.
  // Chặn ở cấp <td> để cả cột chọn không bao giờ mở panel (vd Release 2, Kế hoạch tạm, Giao hàng…).
  const stopSel = onRowClick ? (e) => e.stopPropagation() : undefined;
  const renderCell = (c, row, sticky, rowSpan) => (
    <td key={c.key} onClick={c.selection ? stopSel : undefined} rowSpan={rowSpan}
      className={`${PAD_C} ${sticky ? 'sticky right-0 z-10 bg-surface shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]' : ''} ${c.className || ''}`}>
      {cellValue(c, row)}
    </td>
  );

  // 1 bản ghi → 1 hoặc NHIỀU <tr>. Cột `merge` (+ ô chọn + STT) chỉ vẽ ở dòng đầu, kèm rowSpan.
  const renderRecord = (row, stt) => {
    const subs = subsOf(row);
    const n = subs ? subs.length : 1;
    const lines = subs || [null];
    const onClick = onRowClick ? () => onRowClick(row) : undefined;
    const cls = `border-b border-line/70 transition hover:bg-surface-muted/40 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`;
    return lines.map((sub, j) => {
      const r = sub ? { ...row, ...sub } : row;      // dòng con ghi đè trường của phần in
      const dau = j === 0;
      const span = n > 1 ? n : undefined;
      return (
        <tr key={`${row[rowKey]}-${j}`} onClick={onClick}
          className={`${cls} ${!dau ? 'border-t-0' : ''}`}>
          {dau && selCols.map((c) => renderCell(c, row, false, span))}
          {dau && showStt && (
            <td rowSpan={span} className="px-1.5 py-1.5 lg:px-2.5 lg:py-2 2xl:px-4 2xl:py-3 align-middle text-right tabular-nums text-ink-soft">{stt}</td>
          )}
          {bodyCols.map((c) => ((c.merge && !dau) ? null : renderCell(c, r, false, c.merge ? span : undefined)))}
          {trailingActions.map((c) => ((c.merge && !dau) ? null : renderCell(c, r, true, c.merge ? span : undefined)))}
        </tr>
      );
    });
  };

  return (
    <div>
      {/* ===== BẢNG (md trở lên) ===== */}
      <div className="hidden md:block card overflow-hidden" aria-busy={loading || undefined}>
        {dangTaiNgam && <VachTai />}
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full text-[11px] lg:text-[12px] 2xl:text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                {selCols.map(renderHeader)}
                {showStt && (
                  <th className="sticky top-0 z-20 bg-surface-muted px-1.5 py-2 lg:px-2.5 2xl:px-4 2xl:py-3 text-[10px] lg:text-[11px] 2xl:text-xs font-semibold uppercase tracking-tight lg:tracking-wide text-ink-soft w-10 text-right">STT</th>
                )}
                {bodyCols.map((c) => renderHeader(c))}
                {trailingActions.map((c) => renderHeader(c, true))}
              </tr>
            </thead>
            <tbody>
              {laTaiLanDau ? (
                <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">
                  <Spinner size={22} className="mx-auto" />
                </td></tr>
              ) : allRows.length === 0 ? (
                <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">{emptyText}</td></tr>
              ) : (
                viewRows.map((row, i) => renderRecord(row, sttBase + i + 1))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== THẺ (dưới md — mobile/tablet) ===== */}
      <div className="space-y-2.5 md:hidden" aria-busy={loading || undefined}>
        {dangTaiNgam && <VachTai />}
        {laTaiLanDau ? (
          <div className="card p-8 text-center text-ink-soft"><Spinner size={22} className="mx-auto" /></div>
        ) : allRows.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft">{emptyText}</div>
        ) : (
          viewRows.map((row, i) => {
            // Cột không có tiêu đề (header rỗng) coi là "hành động" → xuống cuối, không nhãn.
            const labelCols = restCols.filter((c) => c.header);
            const actionCols = restCols.filter((c) => !c.header);
            return (
              <div key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`card p-3.5 ${onRowClick ? 'cursor-pointer active:bg-surface-muted/60' : ''} ${rowClassName ? rowClassName(row) : ''}`}>
                {(selCols.length > 0 || showStt) && (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {/* Thẻ mobile: cũng chặn nổi bọt ở vùng ô chọn (xem ghi chú renderCell) */}
                    <div className="flex items-center gap-2" onClick={stopSel}>
                      {selCols.map((c) => <span key={c.key}>{cellValue(c, row)}</span>)}
                    </div>
                    {showStt && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">#{sttBase + i + 1}</span>}
                  </div>
                )}
                {(() => {
                  // Thẻ mobile: bản ghi tách dòng con → cột `merge` hiện MỘT LẦN ở thẻ, các cột còn lại
                  // lặp theo từng phần in (khối có vạch trái) — tương đương rowSpan của bảng.
                  const subs = subsOf(row);
                  const chung = subs ? labelCols.filter((c) => c.merge) : labelCols;
                  const rieng = subs ? labelCols.filter((c) => !c.merge) : [];
                  const dong = (c, r) => (
                    <div key={c.key} className="flex items-start justify-between gap-3 py-1.5">
                      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-soft">{c.header}</span>
                      <span className="min-w-0 text-right text-sm text-ink">{cellValue(c, r)}</span>
                    </div>
                  );
                  return (
                    <>
                      <div className="divide-y divide-line/60">{chung.map((c) => dong(c, row))}</div>
                      {subs && subs.map((sub, j) => (
                        <div key={j} className="mt-2 border-l-2 border-primary/40 pl-2.5">
                          <div className="divide-y divide-line/60">{rieng.map((c) => dong(c, { ...row, ...sub }))}</div>
                        </div>
                      ))}
                    </>
                  );
                })()}
                {actionCols.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2.5">
                    {actionCols.map((c) => <span key={c.key}>{cellValue(c, row)}</span>)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {clientPaged && (
        <Pagination page={safePage} totalPages={totalPages} total={allRows.length} onPage={setCpage} />
      )}
    </div>
  );
}
