import { useState } from 'react';
import Icon from '../../../components/common/Icon';

// Bảng dữ liệu (metric) tương tác: KÉO một mục thả vào ô, hoặc chọn ô rồi BẤM mục để chèn.
export default function MetricPalette({ metricGroups, onPick, onClose, hasSelection }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const groups = Object.entries(metricGroups)
    .map(([nhom, list]) => [nhom, query ? list.filter((m) => `${m.ten} ${m.ma} ${m.mo_ta} ${nhom}`.toLowerCase().includes(query)) : list])
    .filter(([, list]) => list.length);

  return (
    <div className="card flex max-h-[72vh] flex-col p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="rounded bg-primary/20 px-1 text-[11px] font-bold text-primary">Σ</span> Bảng dữ liệu
        </h3>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-surface-muted">
          <Icon name="x" size={16} />
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-ink-soft">
        <b>Kéo</b> một chỉ số thả vào ô, hoặc <b>chọn ô rồi bấm</b> chỉ số để chèn. Giá trị tự tính realtime khi Xem trước / Xuất.
      </p>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm chỉ số…"
        className="mb-2 h-9 w-full rounded-control border border-line px-2.5 text-xs outline-none focus:border-primary"
      />
      {!hasSelection && (
        <p className="mb-2 rounded-control bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/20">
          Chưa chọn ô — bấm chỉ số sẽ không chèn được. Hãy kéo–thả, hoặc chọn ô trước.
        </p>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {groups.map(([nhom, list]) => (
          <div key={nhom}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{nhom}</div>
            <div className="space-y-1">
              {list.map((m) => (
                <button
                  key={m.ma} type="button" draggable title={m.mo_ta}
                  onDragStart={(e) => { e.dataTransfer.setData('text/metric', m.ma); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => onPick(m.ma)}
                  className="flex w-full cursor-grab items-center gap-2 rounded-control border border-line px-2 py-1.5 text-left hover:border-primary/50 hover:bg-primary-wash/30 active:cursor-grabbing"
                >
                  <Icon name="grip-vertical" size={13} className="shrink-0 text-ink-soft/60" />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{m.ten}</span>
                  {m.don_vi && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 text-[10px] text-ink-soft">{m.don_vi}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p className="text-xs text-ink-soft">Không có chỉ số khớp “{q}”.</p>}
      </div>
    </div>
  );
}
