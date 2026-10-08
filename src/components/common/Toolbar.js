import Icon from './Icon';

// Tiêu đề trang + ô tìm kiếm + nút hành động.
// ⚠ Khối "sĩ số checkpoint" ĐÃ RỜI KHỎI ĐÂY (16/08/2026) — nay render ở hàng breadcrumb của
//   `layout/ModuleLayout.js`, khai bằng khóa `siSo` trong `constants/modules.js`. Đừng thêm lại
//   prop `siSo` vào Toolbar, sẽ thành 2 dải sĩ số trên cùng 1 màn.
// ⚠ `subtitle` (dòng mô tả / hướng dẫn dưới tiêu đề) CỐ Ý KHÔNG RENDER nữa (người dùng chốt 30/09/2026:
//   bỏ mọi chữ hướng dẫn). Prop vẫn nhận để ~80 trang đang truyền không phải sửa; muốn hiện lại thì mở dòng dưới.
// `searchRef` (tùy chọn) = ref gắn vào ô tìm kiếm — để trang tự đặt con trỏ vào ô (xem `hooks/useOTimKiem`).
// `onSearchEnter(giaTri)` (tùy chọn, 08/10/2026) = bấm Enter ở ô tìm — đầu đọc mã vạch gõ mã + Enter (vd Xác nhận
//   chạy: quét để tích lệnh đang chạy). Không truyền ⇒ Enter không làm gì như cũ.
export default function Toolbar({ title, search, onSearch, searchPlaceholder = 'Tìm kiếm...', searchRef, onSearchEnter, children }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
      </div>
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {onSearch && (
          <div className="relative w-full sm:w-56">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={onSearchEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchEnter(e.currentTarget.value); } } : undefined}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        )}
          {children}
        </div>
      </div>
    </div>
  );
}
