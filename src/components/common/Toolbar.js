import Icon from './Icon';

// Tiêu đề trang + ô tìm kiếm + nút hành động.
export default function Toolbar({ title, subtitle, search, onSearch, searchPlaceholder = 'Tìm kiếm...', children }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {onSearch && (
          <div className="relative w-full sm:w-56">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
