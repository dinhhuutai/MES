import { useEffect, useRef, useState } from 'react';

// Bảng màu đầy đủ kiểu Google Sheets (10 cột).
export const PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
];

const RECENT_KEY = 'baocao_mau_gan_day';
function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 10); } catch { return []; }
}
function pushRecent(c) {
  if (!c) return;
  const cur = readRecent().filter((x) => x !== c);
  cur.unshift(c);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 10))); } catch { /* ignore */ }
}

// Đóng popover khi bấm ra ngoài.
function useClickOutside(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);
  return ref;
}

// Popover bảng màu — swatch to hơn, có "màu gần đây" + nhập mã hex.
export function ColorPopover({ open, onClose, onPick, allowNone, current }) {
  const ref = useClickOutside(open, onClose);
  const [hex, setHex] = useState(current || '#000000');
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => { if (open) { setHex(current || '#000000'); setRecent(readRecent()); } }, [open, current]);
  if (!open) return null;

  const choose = (c) => { pushRecent(c); onPick(c); onClose(); };
  const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);

  const Swatch = ({ c }) => (
    <button
      type="button" title={c} onClick={() => choose(c)}
      className={`h-6 w-6 rounded-md border transition hover:scale-110 hover:shadow-card
        ${current && current.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-primary ring-offset-1' : 'border-line/70'}`}
      style={{ backgroundColor: c }}
    />
  );

  return (
    <div ref={ref} className="absolute z-40 mt-1 w-[248px] rounded-card border border-line bg-surface p-3 shadow-card-hover">
      {allowNone && (
        <button
          type="button" onClick={() => { onPick(null); onClose(); }}
          className="mb-2 flex w-full items-center gap-2 rounded-control border border-line px-2 py-1.5 text-xs text-ink-soft hover:bg-surface-muted"
        >
          <span className="grid h-4 w-4 place-items-center rounded border border-line text-[10px]">∅</span>
          Không màu / Đặt lại
        </button>
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Bảng màu</div>
      <div className="grid grid-cols-10 gap-1">
        {PALETTE.map((c) => <Swatch key={c} c={c} />)}
      </div>

      {recent.length > 0 && (
        <>
          <div className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Gần đây</div>
          <div className="flex flex-wrap gap-1">
            {recent.map((c) => <Swatch key={c} c={c} />)}
          </div>
        </>
      )}

      <div className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Tùy chọn</div>
      <div className="flex items-center gap-1.5">
        <input
          type="color" value={isValidHex ? hex : '#000000'} onChange={(e) => setHex(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-line"
        />
        <input
          value={hex} onChange={(e) => setHex(e.target.value)}
          placeholder="#RRGGBB" spellCheck={false}
          className="h-8 w-full rounded-control border border-line px-2 font-mono text-xs outline-none focus:border-primary"
        />
        <button
          type="button" disabled={!isValidHex} onClick={() => choose(hex)}
          className="h-8 shrink-0 rounded-control bg-primary px-2.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// Popover chọn viền: preset cạnh + màu + độ dày. onApply(preset, mau, day).
const VIEN_PRESETS = [
  { v: 'all', label: 'Tất cả', ico: '⊞' },
  { v: 'outer', label: 'Ngoài', ico: '▢' },
  { v: 'inner', label: 'Trong', ico: '田' },
  { v: 'top', label: 'Trên', ico: '⎺' },
  { v: 'bottom', label: 'Dưới', ico: '⎽' },
  { v: 'left', label: 'Trái', ico: '▏' },
  { v: 'right', label: 'Phải', ico: '▕' },
  { v: 'horizontal', label: 'Ngang', ico: '≡' },
  { v: 'vertical', label: 'Dọc', ico: '‖' },
  { v: 'none', label: 'Xóa viền', ico: '∅' },
];

export function BorderPopover({ open, onClose, onApply }) {
  const ref = useClickOutside(open, onClose);
  const [mau, setMau] = useState('#000000');
  const [day, setDay] = useState('mong'); // mong | dam
  const [colorOpen, setColorOpen] = useState(false);
  if (!open) return null;
  return (
    <div ref={ref} className="absolute z-40 mt-1 w-[236px] rounded-card border border-line bg-surface p-3 shadow-card-hover">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Kiểu viền</div>
      <div className="grid grid-cols-5 gap-1">
        {VIEN_PRESETS.map((p) => (
          <button
            key={p.v} type="button" title={p.label}
            onClick={() => { onApply(p.v, mau, day); onClose(); }}
            className="grid h-9 place-items-center rounded-control border border-line text-base hover:bg-surface-muted"
          >
            {p.ico}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative">
          <button
            type="button" onClick={() => setColorOpen((v) => !v)}
            className="flex h-8 items-center gap-1 rounded-control border border-line px-2 text-xs"
          >
            Màu viền <span className="h-3.5 w-4 rounded border border-line" style={{ backgroundColor: mau }} />
          </button>
          <ColorPopover open={colorOpen} onClose={() => setColorOpen(false)} current={mau} onPick={(c) => setMau(c || '#000000')} />
        </div>
        <select
          value={day} onChange={(e) => setDay(e.target.value)}
          className="h-8 rounded-control border border-line px-1.5 text-xs"
        >
          <option value="mong">Mỏng</option>
          <option value="dam">Đậm</option>
        </select>
      </div>
    </div>
  );
}
