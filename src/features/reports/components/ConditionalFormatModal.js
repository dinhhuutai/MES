import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { ColorPopover } from './formatControls';

// Toán tử điều kiện — nhóm theo số ô nhập giá trị cần.
export const TOAN_TU = [
  { v: 'khong_trong', label: 'Ô không trống', nhap: 0 },
  { v: 'trong', label: 'Ô trống', nhap: 0 },
  { v: 'chua', label: 'Văn bản chứa', nhap: 1 },
  { v: 'khong_chua', label: 'Văn bản không chứa', nhap: 1 },
  { v: 'bang', label: 'Giá trị bằng', nhap: 1 },
  { v: 'khac', label: 'Giá trị khác', nhap: 1 },
  { v: 'lon_hon', label: 'Lớn hơn', nhap: 1 },
  { v: 'lon_hon_bang', label: 'Lớn hơn hoặc bằng', nhap: 1 },
  { v: 'nho_hon', label: 'Nhỏ hơn', nhap: 1 },
  { v: 'nho_hon_bang', label: 'Nhỏ hơn hoặc bằng', nhap: 1 },
  { v: 'giua', label: 'Nằm giữa', nhap: 2 },
];
const nhapCount = (tt) => (TOAN_TU.find((x) => x.v === tt)?.nhap ?? 1);

const newRule = (vung) => ({
  id: Math.random().toString(36).slice(2, 9),
  vung: vung || '',
  toan_tu: 'lon_hon',
  v1: '',
  v2: '',
  dinh_dang: { mau_nen: '#ffe599', mau_chu: undefined, dam: false, nghieng: false, gach_ngang: false },
});

function StyleBar({ dd, onChange }) {
  const [pop, setPop] = useState(null); // 'chu' | 'nen'
  const T = ({ k, children, title }) => (
    <button
      type="button" title={title} onClick={() => onChange({ ...dd, [k]: !dd[k] })}
      className={`h-8 w-8 rounded-control border text-sm font-semibold ${dd[k] ? 'border-primary bg-primary-wash text-primary' : 'border-line'}`}
    >
      {children}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <T k="dam" title="Đậm"><b>B</b></T>
      <T k="nghieng" title="Nghiêng"><i>I</i></T>
      <T k="gach_ngang" title="Gạch ngang"><s>S</s></T>
      <div className="relative">
        <button
          type="button" onClick={() => setPop(pop === 'chu' ? null : 'chu')}
          className="flex h-8 items-center gap-1 rounded-control border border-line px-2 text-sm"
        >
          <span className="font-bold" style={{ color: dd.mau_chu || undefined }}>A</span>
          <span className="h-1.5 w-4 rounded" style={{ backgroundColor: dd.mau_chu || '#111827' }} />
        </button>
        <ColorPopover open={pop === 'chu'} onClose={() => setPop(null)} current={dd.mau_chu} allowNone
          onPick={(c) => onChange({ ...dd, mau_chu: c || undefined })} />
      </div>
      <div className="relative">
        <button
          type="button" onClick={() => setPop(pop === 'nen' ? null : 'nen')}
          className="flex h-8 items-center gap-1 rounded-control border border-line px-2 text-sm"
        >
          🖌<span className="h-1.5 w-4 rounded border border-line" style={{ backgroundColor: dd.mau_nen || '#ffffff' }} />
        </button>
        <ColorPopover open={pop === 'nen'} onClose={() => setPop(null)} current={dd.mau_nen} allowNone
          onPick={(c) => onChange({ ...dd, mau_nen: c || undefined })} />
      </div>
    </div>
  );
}

// Modal quản lý định dạng có điều kiện (cấp lưới). rules ⊂ grid.dinh_dang.dieu_kien.
export default function ConditionalFormatModal({ open, onClose, rules = [], onSave, selectionRange }) {
  const [items, setItems] = useState(rules);
  // Nạp lại danh sách quy tắc mỗi lần mở modal.
  useEffect(() => {
    if (open) setItems(rules.length ? rules : [newRule(selectionRange)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (id, p) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id) => setItems((xs) => xs.filter((x) => x.id !== id));
  const add = () => setItems((xs) => [...xs, newRule(selectionRange)]);

  return (
    <Modal
      open={open} onClose={onClose} size="lg" title="Định dạng có điều kiện"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={() => { onSave(items.filter((x) => x.vung && x.vung.trim())); onClose(); }}>Xong</Button>
        </>
      )}
    >
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-ink-soft">Chưa có quy tắc. Bấm “Thêm quy tắc”.</p>}
        {items.map((r) => {
          const nc = nhapCount(r.toan_tu);
          return (
            <div key={r.id} className="rounded-card border border-line p-3">
              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_auto]">
                <label className="text-xs font-medium text-ink">
                  Áp dụng cho phạm vi
                  <div className="mt-1 flex gap-1">
                    <input
                      value={r.vung} onChange={(e) => patch(r.id, { vung: e.target.value.toUpperCase() })}
                      placeholder="VD: A1:C10 hoặc B2"
                      className="h-9 w-full rounded-control border border-line px-2 font-mono text-xs outline-none focus:border-primary"
                    />
                  </div>
                </label>
                <div className="text-xs font-medium text-ink">
                  Định dạng ô nếu…
                  <div className="mt-1 flex flex-wrap gap-1">
                    <select
                      value={r.toan_tu} onChange={(e) => patch(r.id, { toan_tu: e.target.value })}
                      className="h-9 rounded-control border border-line px-1.5 text-xs"
                    >
                      {TOAN_TU.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                    </select>
                    {nc >= 1 && (
                      <input
                        value={r.v1} onChange={(e) => patch(r.id, { v1: e.target.value })}
                        placeholder="Giá trị"
                        className="h-9 w-24 rounded-control border border-line px-2 text-xs outline-none focus:border-primary"
                      />
                    )}
                    {nc >= 2 && (
                      <input
                        value={r.v2} onChange={(e) => patch(r.id, { v2: e.target.value })}
                        placeholder="và"
                        className="h-9 w-24 rounded-control border border-line px-2 text-xs outline-none focus:border-primary"
                      />
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => remove(r.id)} className="self-start text-xs text-danger hover:underline sm:self-center">Xóa</button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-ink">Kiểu định dạng</div>
                <StyleBar dd={r.dinh_dang || {}} onChange={(dd) => patch(r.id, { dinh_dang: dd })} />
              </div>
              {selectionRange && (
                <button
                  type="button" onClick={() => patch(r.id, { vung: selectionRange })}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Dùng vùng đang chọn ({selectionRange})
                </button>
              )}
            </div>
          );
        })}
        <button type="button" onClick={add} className="text-sm font-medium text-primary hover:underline">+ Thêm quy tắc khác</button>
      </div>
    </Modal>
  );
}

// Chuyển "A1:C10" → {r0,c0,r1,c1}. Đơn ô "B2" → 1×1. Null nếu sai.
export function parseRange(vung, parseKey) {
  if (!vung) return null;
  const parts = vung.split(':');
  const a = parseKey(parts[0]);
  const b = parseKey(parts[1] || parts[0]);
  if (!a || !b) return null;
  return {
    r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r),
    c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c),
  };
}
