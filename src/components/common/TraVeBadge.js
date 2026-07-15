import { useState } from 'react';
import Badge from './Badge';
import Modal from './Modal';
import Icon from './Icon';

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// Badge "Bị trả về" (đỏ) → bấm mở modal hiện LÝ DO trả về (kèm người/giờ/checklist rớt).
//  data: string (chỉ lý do) | { ly_do, checklist_list, tg, nguoi, so_lan } | null.
//  label: nhãn badge (mặc định "Bị trả về"); nguon: mô tả nguồn trả về (vd "QC", "QA", "OQC").
export default function TraVeBadge({ data, label = 'Bị trả về', nguon }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const info = typeof data === 'string' ? { ly_do: data } : data;
  const nLan = info.so_lan && info.so_lan > 1 ? ` (${info.so_lan})` : '';
  const checklist = (info.checklist_list || '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
        title="Bấm để xem lý do trả về">
        <Icon name="undo-2" size={12} />{label}{nLan}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="md"
        title={`Lý do ${nguon ? `${nguon} ` : ''}trả về`}>
        <div className="space-y-4">
          {info.tg || info.nguoi ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
              {info.nguoi && <span>Người trả về: <b className="text-ink">{info.nguoi}</b></span>}
              {info.tg && <span>Thời gian: <b className="text-ink">{fmtTime(info.tg)}</b></span>}
            </div>
          ) : null}

          {checklist.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Checklist rớt</div>
              <div className="flex flex-wrap gap-1.5">
                {checklist.map((c) => <Badge key={c} tone="warning">{c}</Badge>)}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Lý do</div>
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {info.ly_do || 'Không có lý do ghi chú.'}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
