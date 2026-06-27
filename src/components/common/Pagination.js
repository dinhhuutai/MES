import Icon from './Icon';

export default function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
      <span>Tổng {total} bản ghi</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-line disabled:opacity-40 hover:bg-surface-muted"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
        </button>
        <span className="font-medium text-ink">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-line disabled:opacity-40 hover:bg-surface-muted"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
}
