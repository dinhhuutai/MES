// Dải chip lọc dạng nút bo tròn kèm số đếm — dùng chung cho toggle LOẠI CHUYỀN / KHU BÀN
// ở "Theo dõi chuyền" (Sản xuất) và "Test Run - QA" (Kế hoạch) để 2 màn luôn giống hệt nhau.
//
// props:
//   tabs   [{ v, label }]  — `v` là giá trị chip ('' = tất cả)
//   value  giá trị đang chọn
//   counts { [v]: number } — số hiển thị trong ngoặc; thiếu khóa thì hiện 0
//   onChange(v)
export default function ChipTabs({ tabs = [], value = '', counts = {}, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = value === t.v;
        const n = counts[t.v] || 0;
        return (
          <button
            key={t.v || 'all'}
            type="button"
            onClick={() => onChange && onChange(t.v)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-primary bg-primary text-white'
                : 'border-line bg-surface text-ink-soft hover:border-primary/50 hover:text-ink'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${active ? 'text-white/80' : 'text-ink-soft'}`}>({n})</span>
          </button>
        );
      })}
    </div>
  );
}
