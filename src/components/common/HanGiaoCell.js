import { fmtDate } from '../../utils/format';

// Ô "Hạn giao": hiện ngày; tô ĐỎ nếu đã quá hạn, VÀNG nếu hôm nay/ngày mai. value = ngày (chuỗi/Date).
export default function HanGiaoCell({ value }) {
  if (!value) return <span className="text-ink-soft">—</span>;
  const han = new Date(value); han.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((han - today) / 86400000);
  const cls = diff < 0 ? 'text-danger font-semibold'
    : diff <= 1 ? 'text-amber-600 font-medium'
      : 'text-ink';
  const note = diff < 0 ? ` (trễ ${-diff}n)` : diff === 0 ? ' (hôm nay)' : diff === 1 ? ' (mai)' : '';
  return <span className={`whitespace-nowrap tabular-nums ${cls}`}>{fmtDate(value)}{note}</span>;
}
