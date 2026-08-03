import Badge from './Badge';

// Phương án in (HSKT / ERP Pain): 1 Bàn, 2 Máy, 3 Robot.
// ⚠ ERP CÓ gửi Pain = 0 = chưa xác định (chưa gán) — khớp `backend/src/utils/hskt.js`, đổi cả 2 nơi.
export const PHUONG_AN_IN = { 0: 'Chưa xác định', 1: 'Bàn', 2: 'Máy', 3: 'Robot' };

export default function PhuongAnInBadge({ value, className }) {
  if (value == null || value === '') return <span className={`text-ink-soft ${className || ''}`}>—</span>;
  // 0 = chưa xác định → tone xám, để không lẫn với phương án in thật (xanh).
  const tone = Number(value) === 0 ? 'default' : 'info';
  return <Badge tone={tone} className={className}>{PHUONG_AN_IN[Number(value)] || value}</Badge>;
}
