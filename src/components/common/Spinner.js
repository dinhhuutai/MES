// Spinner "đang tải" = BÔNG HOA của logo THLA (5 cánh vàng + nhụy nâu), xoay kèm nở nhẹ.
// Hình học & màu ĐO TRỰC TIẾP từ public/assets/logo.png (giải mã PNG, đếm pixel):
//   cánh #FFF112 · nhụy #847058 · khung hoa 199x194 tâm (105,101.5) · tâm→đỉnh cánh 96.5
//   · bề rộng cánh 68 · đường kính nhụy 26  ⇒ quy về viewBox 100x100 (chia đôi) như dưới.
// Màu HARD-CODE theo logo (không dùng currentColor) để giữ đúng sắc vàng ở mọi nền — kể cả trong
// nút primary xanh / nút đỏ. API giống `Icon` (size + className) để thay thế 1-1.
// GIAO DIỆN SÁNG: vàng #FFF112 trên nền trắng rất chói/khó thấy ⇒ viền cánh màu mực #111827.
// `vector-effect="non-scaling-stroke"` giữ viền LUÔN 1px thật trên màn hình dù icon 16px hay 22px
// và dù đang phóng to theo animation (không có nó thì viền dày mỏng theo scale).
// GIAO DIỆN TỐI: `dark:stroke-none` — nền tối đã đủ tương phản, thêm viền đen sẽ bệt.
const PETALS = [0, 72, 144, 216, 288];

export default function Spinner({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`animate-flower-spin ${className}`}
      aria-hidden="true"
    >
      {PETALS.map((deg) => (
        <ellipse key={deg} cx="50" cy="22" rx="17" ry="20" fill="#FFF112"
          className="stroke-[#111827] dark:stroke-none"
          strokeWidth="0.05" vectorEffect="non-scaling-stroke"
          transform={`rotate(${deg} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="6.5" fill="#847058" />
    </svg>
  );
}
