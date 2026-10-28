// Dải chip lọc dạng nút bo tròn kèm số đếm — dùng chung cho toggle LOẠI CHUYỀN / KHU BÀN
// ở "Theo dõi chuyền" (Sản xuất) và "Test Run - QA" (Kế hoạch) để 2 màn luôn giống hệt nhau.
//
// props:
//   tabs   [{ v, label }]  — `v` là giá trị chip ('' = tất cả)
//   value  giá trị đang chọn
//   counts { [v]: number } — số hiển thị trong ngoặc; thiếu khóa thì hiện 0
//   onChange(v)
//   anSo   true ⇒ KHÔNG in số đếm (dùng làm toggle chuyển trang con — vd trang Danh mục & tem in).
//          Mặc định false ⇒ mọi màn đang dùng giữ nguyên.
// ⚠ 28/10/2026 (dùng được trên điện thoại): dưới `sm` dải chip là 1 HÀNG CUỘN NGANG (dải khu chuyền ~15 chip trước đó
//   chiếm 4–5 dòng, đẩy bảng xuống khỏi màn hình). Từ `sm` GIỮ NGUYÊN kiểu cũ (29/10/2026, người dùng: "laptop/PC về như cũ").
// `gon` (29/10/2026, trang Xác nhận chạy): MỌI cỡ màn đều 1 HÀNG (không xuống dòng — thừa thì cuộn ngang), chip nhỏ,
//   chữ lớn dần theo màn (laptop → PC). Không truyền ⇒ như cũ.
export default function ChipTabs({ tabs = [], value = '', counts = {}, onChange, anSo = false, gon = false }) {
  const khung = gon
    ? '-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1 xl:gap-1.5'
    : '-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:mb-4 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0';
  const chip = gon
    ? 'px-2 py-0.5 text-[11px] lg:text-xs 2xl:px-3 2xl:py-1 2xl:text-[13px]'
    : 'px-3 py-1 text-[13px] sm:px-3.5 sm:py-1.5 sm:text-sm';
  return (
    <div className={khung}>
      {tabs.map((t) => {
        const active = value === t.v;
        const n = counts[t.v] || 0;
        return (
          <button
            key={t.v || 'all'}
            type="button"
            onClick={() => onChange && onChange(t.v)}
            className={`shrink-0 whitespace-nowrap rounded-full border font-medium transition-colors ${chip} ${
              active
                ? 'border-primary bg-primary text-white'
                : 'border-line bg-surface text-ink-soft hover:border-primary/50 hover:text-ink'
            }`}
          >
            {t.label}
            {!anSo && <span className={`${gon ? 'ml-1 text-[10px] 2xl:text-xs' : 'ml-1.5 text-xs'} ${active ? 'text-white/80' : 'text-ink-soft'}`}>({n})</span>}
          </button>
        );
      })}
    </div>
  );
}
