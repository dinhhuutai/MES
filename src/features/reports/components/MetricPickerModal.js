import { useState } from 'react';
import Modal from '../../../components/common/Modal';
import { Input } from '../../../components/common/controls';

// Bộ chọn chỉ số (metric) hiển thị TOÀN BỘ trong 1 khung lớn, chia nhóm nhiều cột — dễ nhìn/thao tác
// hơn dropdown. Bấm 1 chỉ số = chọn ngay. current = mã đang chọn (tô nổi bật).
export default function MetricPickerModal({ open, metricGroups, current, onPick, onClose }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const groups = Object.entries(metricGroups || {})
    .map(([nhom, list]) => [nhom, query ? list.filter((m) => `${m.ten} ${m.ma} ${m.mo_ta} ${nhom}`.toLowerCase().includes(query)) : list])
    .filter(([, list]) => list.length);

  return (
    <Modal open={open} onClose={onClose} title="Chọn chỉ số dữ liệu" size="xl">
      <div className="mb-3">
        <Input placeholder="Tìm chỉ số theo tên, mã, mô tả…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="max-h-[62vh] overflow-y-auto pr-1">
        {!groups.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">Không có chỉ số khớp “{q}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(([nhom, list]) => (
              <div key={nhom} className="rounded-card border border-line p-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                  <span>{nhom}</span>
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium normal-case">{list.length}</span>
                </div>
                <div className="space-y-1">
                  {list.map((m) => {
                    const active = current === m.ma;
                    return (
                      <button key={m.ma} type="button" title={m.mo_ta}
                        onClick={() => { onPick(m.ma); onClose(); }}
                        className={`flex w-full items-center gap-2 rounded-control border px-2 py-1.5 text-left transition ${
                          active ? 'border-primary bg-primary-wash text-primary' : 'border-line hover:border-primary/50 hover:bg-primary-wash/30'}`}>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">{m.ten}</span>
                        {m.don_vi && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 text-[10px] text-ink-soft">{m.don_vi}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
