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
// ⚠ ĐIỆN THOẠI (28/10/2026): dưới `sm` tiêu đề nhỏ lại, ô tìm trọn hàng, các nút thành 1 DẢI CUỘN NGANG.
//   ⚠⚠ Từ `sm` trở lên GIỮ NGUYÊN bố cục cũ (29/10/2026, người dùng: "laptop/PC về như cũ") — ô tìm + nút chung 1 hàng
//   xuống dòng, canh phải; tiêu đề không cắt. Menu thả xuống trong `children` dùng `components/common/MenuNut`.
export default function Toolbar({ title, search, onSearch, searchPlaceholder = 'Tìm kiếm...', searchRef, onSearchEnter, children }) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="max-sm:min-w-0">
        <h1 className="text-base font-bold text-ink max-sm:truncate sm:text-xl">{title}</h1>
      </div>
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {onSearch && (
            <div className="relative w-full sm:w-56">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={onSearchEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchEnter(e.currentTarget.value); } } : undefined}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm"
              />
            </div>
          )}
          {children && (
            // Điện thoại: dải cuộn ngang. Từ `sm`: `contents` ⇒ nút là phần tử trực tiếp của hàng chung với ô tìm (như cũ).
            <div className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-1 max-sm:[&>*]:shrink-0 max-sm:[&>*]:whitespace-nowrap sm:contents">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
