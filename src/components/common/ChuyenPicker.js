import { useMemo, useState } from 'react';
import { Select, Input } from './controls';

// Chọn chuyền có LỌC THEO LOẠI (chip) + tìm kiếm mã/tên — dùng khi danh sách chuyền dài.
// Props: chuyen [{id, ma_chuyen, ten_chuyen, loai_chuyen}], value, onChange(id), placeholder.
export default function ChuyenPicker({ chuyen = [], value, onChange, placeholder = '— Chọn chuyền —' }) {
  const [loai, setLoai] = useState(''); // '' = tất cả loại
  const [q, setQ] = useState('');

  const loaiList = useMemo(
    () => [...new Set(chuyen.map((c) => c.loai_chuyen).filter(Boolean))],
    [chuyen],
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return chuyen.filter(
      (c) => (!loai || c.loai_chuyen === loai)
        && (!kw || `${c.ma_chuyen} ${c.ten_chuyen}`.toLowerCase().includes(kw)),
    );
  }, [chuyen, loai, q]);

  // Giữ chuyền đang chọn luôn có trong danh sách option (dù bị lọc ra) để Select không mất giá trị.
  const options = useMemo(() => {
    if (value && !filtered.some((c) => c.id === value)) {
      const sel = chuyen.find((c) => c.id === value);
      if (sel) return [sel, ...filtered];
    }
    return filtered;
  }, [filtered, chuyen, value]);

  const chip = (val, label) => (
    <button
      key={val || 'all'}
      type="button"
      onClick={() => setLoai(val)}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        loai === val ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {loaiList.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chip('', 'Tất cả')}
          {loaiList.map((l) => chip(l, l))}
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm mã / tên chuyền..."
        className="mb-2 h-10"
      />
      <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ma_chuyen} — {c.ten_chuyen}{c.loai_chuyen ? ` (${c.loai_chuyen})` : ''}
          </option>
        ))}
      </Select>
      <div className="mt-1 text-xs text-ink-soft">{filtered.length} chuyền</div>
    </div>
  );
}
