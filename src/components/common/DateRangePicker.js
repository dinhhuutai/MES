import { useState, useEffect, useRef, useMemo } from 'react';
import Icon from './Icon';

// Chọn KHOẢNG ngày (bắt đầu → kết thúc) trong 1 ô duy nhất, dùng lịch popover — không cần thư viện.
// value = { from, to } (chuỗi 'YYYY-MM-DD'); onChange({ from, to }).
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dispVN = (s) => { const d = fromISO(s); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; };
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// ⚠ LỊCH NỔI `fixed` (28/10/2026): bản cũ `absolute` bị CẮT khi ô nằm trong vùng cuộn (dải nút cuộn ngang của Toolbar
//   trên điện thoại, thân modal `overflow-y-auto`). Nay tính vị trí theo ô bấm, canh trong màn hình (thiếu chỗ phía
//   dưới ⇒ mở lên trên), cuộn / đổi cỡ cửa sổ thì tính lại.
const RONG_LICH = 280;
const CAO_LICH = 340;
const viTriLich = (el) => {
  const r = el.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - RONG_LICH - 8));
  const duoi = window.innerHeight - r.bottom;
  const top = duoi >= CAO_LICH + 8 || r.top < CAO_LICH + 8 ? r.bottom + 4 : r.top - CAO_LICH - 4;
  return { left, top: Math.max(8, top) };
};

// `gon` (29/10/2026) ⇒ ô thấp + chữ nhỏ, lớn dần theo màn — trang Xác nhận chạy dồn đầu trang còn 3 hàng.
export default function DateRangePicker({ value = {}, onChange, placeholder = 'Chọn khoảng ngày', gon = false }) {
  const { from, to } = value;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromISO(from) || new Date());
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const nutRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const tinhLai = () => { if (nutRef.current) setPos(viTriLich(nutRef.current)); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    window.addEventListener('resize', tinhLai);
    window.addEventListener('scroll', tinhLai, true);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
      window.removeEventListener('resize', tinhLai);
      window.removeEventListener('scroll', tinhLai, true);
    };
  }, [open]);

  const fromD = fromISO(from);
  const toD = fromISO(to);

  const cells = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const startIdx = (new Date(y, m, 1).getDay() + 6) % 7; // thứ 2 đầu tuần
    const days = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startIdx; i += 1) arr.push(null);
    for (let d = 1; d <= days; d += 1) arr.push(new Date(y, m, d));
    return arr;
  }, [view]);

  const pick = (d) => {
    if (!fromD || (fromD && toD)) {
      onChange({ from: toISO(d), to: '' }); // bắt đầu khoảng mới
    } else {
      if (d < fromD) onChange({ from: toISO(d), to: from });
      else onChange({ from, to: toISO(d) });
      setOpen(false); // đã đủ bắt đầu + kết thúc
    }
  };

  const toggle = () => {
    if (!open) {
      setView(fromISO(from) || new Date());
      if (nutRef.current) setPos(viTriLich(nutRef.current));
    }
    setOpen(!open);
  };
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const inRange = (d) => fromD && toD && d > fromD && d < toD;
  const label = from ? `${dispVN(from)}${to && to !== from ? ' – ' + dispVN(to) : ''}` : '';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} ref={nutRef}
        className={`flex items-center whitespace-nowrap rounded-input border border-line bg-surface ${gon
          ? 'h-8 min-w-[150px] gap-1.5 px-2 text-xs 2xl:h-9 2xl:min-w-[190px] 2xl:text-sm'
          : 'h-10 min-w-[200px] gap-2 px-3 text-sm sm:min-w-[220px]'}`}>
        <Icon name="calendar-days" size={gon ? 14 : 16} className="shrink-0 text-ink-soft" />
        <span className={label ? 'text-ink' : 'text-ink-soft'}>{label || placeholder}</span>
      </button>
      {open && (
        <div className="fixed z-[75] w-[280px] rounded-card border border-line bg-surface p-3 shadow-card-hover"
          style={pos || undefined}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded p-1 hover:bg-surface-muted"><Icon name="chevron-left" size={16} /></button>
            <span className="text-sm font-semibold text-ink">Th{view.getMonth() + 1}/{view.getFullYear()}</span>
            <button type="button" onClick={() => shift(1)} className="rounded p-1 hover:bg-surface-muted"><Icon name="chevron-right" size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-soft">
            {WD.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const sel = sameDay(d, fromD) || sameDay(d, toD);
              const mid = inRange(d);
              return (
                <button key={i} type="button" onClick={() => pick(d)}
                  className={`h-9 rounded text-sm sm:h-8 sm:text-xs ${sel ? 'bg-primary font-semibold text-white' : mid ? 'bg-primary-wash text-primary' : 'text-ink hover:bg-surface-muted'}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => { const t = toISO(new Date()); onChange({ from: t, to: t }); setOpen(false); }}
              className="text-xs text-primary hover:underline">Hôm nay</button>
            <button type="button" onClick={() => { onChange({ from: '', to: '' }); setOpen(false); }}
              className="text-xs text-ink-soft hover:text-danger">Xóa</button>
          </div>
          {from && !to && <p className="mt-1 text-center text-[11px] text-ink-soft">Chọn tiếp ngày kết thúc</p>}
        </div>
      )}
    </div>
  );
}
