import Icon from './Icon';

// columns: [{ key, header, render?(row), className?, headerClassName?, selection? }]
//   - selection: true → cột chọn (checkbox); được render TRƯỚC cột STT.
// sttStart: nếu là số → hiện cột "STT" bắt đầu từ sttStart+1 (truyền (page-1)*limit để liên tục giữa các trang).
// rowClassName(row): trả class nền theo hàng (vd tô màu cảnh báo SLA).
export default function DataTable({ columns, rows, loading, rowKey = 'id', emptyText = 'Không có dữ liệu', onRowClick, sttStart, rowClassName }) {
  const showStt = typeof sttStart === 'number';
  // Tách cột selection (checkbox) ra để render trước cột STT; các cột còn lại giữ nguyên thứ tự.
  const selCols = columns.filter((c) => c.selection);
  const restCols = columns.filter((c) => !c.selection);
  const totalCols = columns.length + (showStt ? 1 : 0);

  const renderHeader = (c) => (
    <th key={c.key} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft ${c.headerClassName || ''}`}>
      {c.header}
    </th>
  );
  const renderCell = (c, row) => (
    <td key={c.key} className={`px-4 py-3 align-middle ${c.className || ''}`}>
      {c.render ? c.render(row) : row[c.key]}
    </td>
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-muted/60 text-left">
              {selCols.map(renderHeader)}
              {showStt && (
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft w-12 text-right">STT</th>
              )}
              {restCols.map(renderHeader)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">
                  <Icon name="loader" size={22} className="mx-auto animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-12 text-center text-ink-soft">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-line/70 transition hover:bg-surface-muted/40 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                >
                  {selCols.map((c) => renderCell(c, row))}
                  {showStt && (
                    <td className="px-4 py-3 align-middle text-right tabular-nums text-ink-soft">{sttStart + i + 1}</td>
                  )}
                  {restCols.map((c) => renderCell(c, row))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
