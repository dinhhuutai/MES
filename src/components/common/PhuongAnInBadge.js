import Badge from './Badge';

// Phương án in (HSKT / ERP Pain): 1 Bàn, 2 Máy, 3 Robot.
export const PHUONG_AN_IN = { 1: 'Bàn', 2: 'Máy', 3: 'Robot' };

export default function PhuongAnInBadge({ value, className }) {
  if (value == null || value === '') return <span className={`text-ink-soft ${className || ''}`}>—</span>;
  return <Badge tone="info" className={className}>{PHUONG_AN_IN[Number(value)] || value}</Badge>;
}
