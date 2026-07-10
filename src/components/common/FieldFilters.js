import Button from './Button';
import Icon from './Icon';

// Panel LỌC NHIỀU TRƯỜNG (kết hợp AND) + chip hiển thị lọc đang bật — dùng chung nhiều trang.
// props: fields [{key,label}], values {key:val}, onField(key,val), onClear, open, labelMap? (nhãn chip).
export default function FieldFilters({ fields, values, onField, onClear, open, labelMap }) {
  const active = Object.entries(values || {}).filter(([, v]) => v);
  const nameOf = (k) => (labelMap && labelMap[k]) || (fields.find((f) => f.key === k) || {}).label || k;
  return (
    <>
      {open && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={onClear} disabled={!active.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={values[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
              </div>
            ))}
          </div>
        </div>
      )}
      {active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {active.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary">
              {nameOf(k)}: {v}
              <button onClick={() => onField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa"><Icon name="x" size={12} /></button>
            </span>
          ))}
          <button onClick={onClear} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
        </div>
      )}
    </>
  );
}

// Lọc CLIENT-SIDE danh sách theo các trường (fields có `col` = tên thuộc tính hàng). Kết hợp AND, ILIKE-contains.
export function filterRows(rows, filters, fields) {
  const active = fields.filter((f) => filters[f.key]);
  if (!active.length) return rows || [];
  return (rows || []).filter((r) => active.every((f) =>
    String(r[f.col] ?? '').toLowerCase().includes(String(filters[f.key]).toLowerCase())));
}

// Nút bật/tắt panel lọc (kèm số lọc đang bật).
export function FilterToggle({ open, count, onClick }) {
  return (
    <Button variant={open || count ? 'secondary' : 'ghost'} icon="filter" onClick={onClick}>
      Bộ lọc{count ? ` (${count})` : ''}
    </Button>
  );
}
