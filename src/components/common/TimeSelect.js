import { Select } from './controls';

// Chọn giờ theo hệ 24h (0h–23h) + phút — KHÔNG có AM/PM như `<input type="time">` (ô đó hiện AM/PM
// theo locale của máy, người dùng xưởng hay chọn nhầm). value/onChange dạng "HH:MM" (rỗng = chưa chọn).
// `minuteStep`: 5 cho màn Kế hoạch (chọn nhanh), 1 cho màn Sản xuất (giờ in tem là giờ thật, vd 14:23).
// ⚠ Phút đang có mà KHÔNG nằm trong danh sách bước nhảy thì vẫn phải chèn vào options — nếu không,
// <select> không khớp option nào sẽ hiện rỗng và người dùng tưởng mất dữ liệu.
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0h → 23h

export default function TimeSelect({ value, onChange, minuteStep = 5 }) {
  const [rawH = '', rawM = ''] = value ? value.split(':') : [];
  const hh = rawH === '' ? '' : String(Number(rawH));
  const mm = rawM === '' ? '' : String(Number(rawM));

  const buoc = Math.max(1, Number(minuteStep) || 1);
  const phut = [];
  for (let i = 0; i < 60; i += buoc) phut.push(i);
  if (mm !== '' && !phut.includes(Number(mm))) phut.push(Number(mm));
  phut.sort((a, b) => a - b);

  const emit = (nh, nm) => {
    if (nh === '' && nm === '') { onChange(''); return; } // xóa cả hai → bỏ chọn
    const H = String(nh === '' ? 0 : Number(nh)).padStart(2, '0');
    const M = String(nm === '' ? 0 : Number(nm)).padStart(2, '0');
    onChange(`${H}:${M}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={hh} onChange={(e) => emit(e.target.value, mm)} className="!px-2 tabular-nums" aria-label="Giờ">
        <option value="">-- giờ --</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}h</option>)}
      </Select>
      <span className="text-ink-soft">:</span>
      <Select value={mm} onChange={(e) => emit(hh, e.target.value)} className="!px-2 tabular-nums" aria-label="Phút">
        <option value="">phút</option>
        {phut.map((x) => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
      </Select>
    </div>
  );
}
