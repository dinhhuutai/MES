// Hiển thị loại đợt vải — lấy trực tiếp ten_loai từ loai_dot_vai.
export default function LoaiDotVaiBadge({ value }) {
  if (!value) return <span className="text-ink-soft">—</span>;
  return <span className="text-ink">{value}</span>;
}
