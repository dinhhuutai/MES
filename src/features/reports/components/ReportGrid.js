import { fmtNum } from '../../../utils/format';

// Ký hiệu cột: 0→A, 25→Z, 26→AA...
export function colLabel(n) {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
export const cellKey = (r, c) => `${colLabel(c)}${r + 1}`;

const LOAI_BG = {
  metric: 'bg-primary-wash/40',
  cong_thuc: 'bg-amber-50 dark:bg-amber-950/20',
  text: '',
  so: '',
};

function display(cell, res, mode, metricName) {
  if (mode === 'view') {
    if (!res) return cell?.loai === 'text' ? (cell.gia_tri || '') : '';
    if (res.loi) return res.value;
    if (res.kieu === 'text') return res.value;
    return fmtNum(res.value);
  }
  if (!cell) return '';
  if (cell.loai === 'text') return cell.gia_tri || '';
  if (cell.loai === 'so') return String(cell.gia_tri ?? '');
  if (cell.loai === 'metric') return metricName(cell.metric);
  if (cell.loai === 'cong_thuc') return `=${cell.bieu_thuc || ''}`;
  return '';
}

// grid: { so_cot, so_hang, o }; ketQua: map value; mode 'design'|'view'.
export default function ReportGrid({ grid, ketQua = {}, mode = 'design', selected, onSelect, metricsByMa = {} }) {
  const soCot = grid?.so_cot || 8;
  const soHang = grid?.so_hang || 20;
  const cells = grid?.o || {};
  const metricName = (ma) => metricsByMa[ma]?.ten || ma;

  return (
    <div className="overflow-auto rounded-card border border-line">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-10 border border-line bg-surface-muted" />
            {Array.from({ length: soCot }).map((_, c) => (
              <th key={c} className="min-w-[110px] border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: soHang }).map((_, r) => (
            <tr key={r}>
              <td className="sticky left-0 z-10 border border-line bg-surface-muted px-2 py-1 text-center text-xs font-medium text-ink-soft">
                {r + 1}
              </td>
              {Array.from({ length: soCot }).map((_, c) => {
                const key = cellKey(r, c);
                const cell = cells[key];
                const res = ketQua[key];
                const isSel = selected === key;
                const bg = mode === 'design' && cell ? LOAI_BG[cell.loai] || '' : '';
                const err = mode === 'view' && res?.loi;
                return (
                  <td key={c}
                    onClick={() => onSelect && onSelect(key)}
                    title={cell?.loai === 'metric' ? metricsByMa[cell.metric]?.mo_ta : undefined}
                    className={`h-9 cursor-pointer border px-2 py-1 align-middle
                      ${isSel ? 'border-primary ring-1 ring-primary' : 'border-line'}
                      ${err ? 'bg-rose-50 text-danger dark:bg-rose-950/20' : bg}
                      ${cell?.loai === 'so' || mode === 'view' ? 'text-right tabular-nums' : 'text-left'}`}>
                    <span className={`block max-w-[220px] truncate ${cell?.loai === 'cong_thuc' && mode === 'design' ? 'font-mono text-xs text-amber-700 dark:text-amber-400' : ''} ${cell?.loai === 'text' ? 'font-medium text-ink' : 'text-ink'}`}>
                      {display(cell, res, mode, metricName)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
