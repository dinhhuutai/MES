import Icon from './Icon';

// Danh sách số trang hiển thị với dấu "…" (vd: 1 2 3 … 9).
function buildPages(page, totalPages) {
  const delta = 1; // số trang quanh trang hiện tại
  const range = [1];
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);
  if (left > 2) range.push('…');
  for (let i = left; i <= right; i += 1) range.push(i);
  if (right < totalPages - 1) range.push('…');
  if (totalPages > 1) range.push(totalPages);
  return range;
}

export default function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  const pages = buildPages(page, totalPages);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-control border border-line px-2 text-sm disabled:opacity-40 hover:bg-surface-muted';

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
      <span>Tổng {total} bản ghi</span>
      <div className="flex items-center gap-1.5">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn} aria-label="Trang trước">
          <Icon name="chevron-right" size={16} className="rotate-180" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-ink-soft">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${p === page ? 'border-primary bg-primary font-semibold text-white hover:bg-primary' : 'text-ink'}`}
            >
              {p}
            </button>
          )
        )}
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={btn} aria-label="Trang sau">
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
}
