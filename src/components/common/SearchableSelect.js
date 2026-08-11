import { useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { inputClass } from './controls';
import { chuanTim as norm } from '../../utils/timKiem';

// Select có ô tìm kiếm (combobox) — dùng khi danh sách dài (vd chọn người trong hàng trăm user).
// Dropdown portal (anchor) để không bị cắt trong Modal/SidePanel.
// getSearch: chuỗi để KHỚP tìm kiếm (mặc định = getLabel). Truyền để tìm theo cả tên + username...
//
// `moNgay`: BẤM VÀO Ô LÀ BUNG SẴN CẢ DANH SÁCH, không cần gõ chữ nào (prop `immediate` của Headless UI
//   — mặc định combobox chỉ mở khi bắt đầu gõ). Bật cho danh mục vừa phải mà người dùng hay muốn
//   "xem có những gì" (vd Lý do ngừng chuyền); danh sách RẤT dài (hàng trăm user) thì để mặc định
//   tắt cho khỏi đổ một đống ngay khi chạm ô, nhất là trên điện thoại.
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  getValue = (o) => o.id,
  getLabel = (o) => o.label,
  getSearch,
  placeholder = 'Tìm kiếm...',
  emptyLabel = '— Không —',
  moNgay = false,
}) {
  const [query, setQuery] = useState('');
  const q = norm(query);
  const searchText = getSearch || getLabel;
  const filtered = q === '' ? options : options.filter((o) => norm(searchText(o)).includes(q));
  const selected = options.find((o) => getValue(o) === value) || null;

  return (
    <Combobox value={value || ''} onChange={(v) => onChange(v || '')} onClose={() => setQuery('')}
      immediate={moNgay}>
      <div className="relative">
        <ComboboxInput
          className={`${inputClass} bg-surface`}
          placeholder={placeholder}
          autoComplete="off"
          displayValue={() => (selected ? getLabel(selected) : '')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ComboboxOptions
          anchor="bottom start"
          className="z-[70] max-h-64 w-[var(--input-width)] overflow-auto rounded-input border border-line bg-surface shadow-card [--anchor-gap:4px]"
        >
          <ComboboxOption
            value=""
            className="cursor-pointer px-3 py-2 text-sm text-ink-soft data-[focus]:bg-surface-muted"
          >
            {emptyLabel}
          </ComboboxOption>
          {filtered.map((o) => (
            <ComboboxOption
              key={getValue(o)}
              value={getValue(o)}
              className="cursor-pointer px-3 py-2 text-sm text-ink data-[focus]:bg-primary-wash data-[focus]:text-primary"
            >
              {getLabel(o)}
            </ComboboxOption>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-ink-soft">Không tìm thấy</div>}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
