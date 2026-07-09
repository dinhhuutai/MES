import Icon from './Icon';

// columns: [{ key, header, render?(row), className?, headerClassName?, selection? }]
//   - selection: true → cột chọn (checkbox); được render TRƯỚC cột STT.
// sttStart: nếu là số → hiện cột "STT" bắt đầu từ sttStart+1 (truyền (page-1)*limit để liên tục giữa các trang).
// rowClassName(row): trả class nền theo hàng (vd tô màu cảnh báo SLA).
// Responsive: md+ hiển thị dạng BẢNG; dưới md tự đổi sang dạng THẺ (card) cho mobile/tablet.
export default function DataTable({ columns, rows, loading, rowKey = 'id', emptyText = 'Không có dữ liệu', onRowClick, sttStart, rowClassName }) {
  const showStt = typeof sttStart === 'number';
  const selCols = columns.filter((c) => c.selection);
  const restCols = columns.filter((c) => !c.selection);
  // Cột thao tác (header rỗng) ở CUỐI → GHIM DÍNH bên phải để luôn bấm được dù bảng cuộn ngang.
  const trailingActions = [];
  for (let k = restCols.length - 1; k >= 0 && !restCols[k].header; k -= 1) trailingActions.unshift(restCols[k]);
  const bodyCols = restCols.slice(0, restCols.length - trailingActions.length);
  const totalCols = columns.length + (showStt ? 1 : 0);

  const cellValue = (c, row) => (c.render ? c.render(row) : row[c.key]);
  // Padding/kích thước co theo bề rộng: laptop (md→xl) gọn để đỡ kéo ngang; chỉ màn RẤT rộng (2xl+) mới giãn.
  const PAD_H = 'px-1.5 py-2 lg:px-2.5 2xl:px-4 2xl:py-3 text-[10px] lg:text-[11px] 2xl:text-xs font-semibold uppercase tracking-tight lg:tracking-wide text-ink-soft';
  const PAD_C = 'px-1.5 py-1.5 lg:px-2.5 lg:py-2 2xl:px-4 2xl:py-3 align-middle';
  const renderHeader = (c, sticky) => (
    <th key={c.key} className={`${PAD_H} ${sticky ? 'sticky right-0 z-10 bg-surface-muted shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]' : ''} ${c.headerClassName || ''}`}>
      {c.header}
    </th>
  );
  const renderCell = (c, row, sticky) => (
    <td key={c.key} className={`${PAD_C} ${sticky ? 'sticky right-0 z-10 bg-surface shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]' : ''} ${c.className || ''}`}>
      {cellValue(c, row)}
    </td>
  );

  return (
    <div>
      {/* ===== BẢNG (md trở lên) ===== */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] lg:text-[12px] 2xl:text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                {selCols.map(renderHeader)}
                {showStt && (
                  <th className="px-1.5 py-2 lg:px-2.5 2xl:px-4 2xl:py-3 text-[10px] lg:text-[11px] 2xl:text-xs font-semibold uppercase tracking-tight lg:tracking-wide text-ink-soft w-10 text-right">STT</th>
                )}
                {bodyCols.map((c) => renderHeader(c))}
                {trailingActions.map((c) => renderHeader(c, true))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">
                  <Icon name="loader" size={22} className="mx-auto animate-spin" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">{emptyText}</td></tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-line/70 transition hover:bg-surface-muted/40 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}>
                    {selCols.map((c) => renderCell(c, row))}
                    {showStt && (
                      <td className="px-1.5 py-1.5 lg:px-2.5 lg:py-2 2xl:px-4 2xl:py-3 align-middle text-right tabular-nums text-ink-soft">{sttStart + i + 1}</td>
                    )}
                    {bodyCols.map((c) => renderCell(c, row))}
                    {trailingActions.map((c) => renderCell(c, row, true))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== THẺ (dưới md — mobile/tablet) ===== */}
      <div className="space-y-2.5 md:hidden">
        {loading ? (
          <div className="card p-8 text-center text-ink-soft"><Icon name="loader" size={22} className="mx-auto animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft">{emptyText}</div>
        ) : (
          rows.map((row, i) => {
            // Cột không có tiêu đề (header rỗng) coi là "hành động" → xuống cuối, không nhãn.
            const labelCols = restCols.filter((c) => c.header);
            const actionCols = restCols.filter((c) => !c.header);
            return (
              <div key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`card p-3.5 ${onRowClick ? 'cursor-pointer active:bg-surface-muted/60' : ''} ${rowClassName ? rowClassName(row) : ''}`}>
                {(selCols.length > 0 || showStt) && (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {selCols.map((c) => <span key={c.key}>{cellValue(c, row)}</span>)}
                    </div>
                    {showStt && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">#{sttStart + i + 1}</span>}
                  </div>
                )}
                <div className="divide-y divide-line/60">
                  {labelCols.map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-3 py-1.5">
                      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-soft">{c.header}</span>
                      <span className="min-w-0 text-right text-sm text-ink">{cellValue(c, row)}</span>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
