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
//
// `chapNhanTuDo`: cho GÕ GIÁ TRỊ NGOÀI DANH SÁCH (Enter hoặc rời ô là nhận). CHỈ dùng khi `value`
//   CHÍNH LÀ nhãn (vd Chuyền trưởng / Người sửa lưu TÊN) — với ô lưu `id` thì nhận chữ thô là ghi
//   rác vào DB. Có nó thì **1 ô là đủ**: đừng đặt thêm 1 `<input>` "hoặc gõ tay" bên dưới nữa —
//   người dùng thấy 2 ô nhập tên cạnh nhau sẽ tưởng lỗi (đã mắc thật ở modal In tem trang Sửa).
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
  chapNhanTuDo = false,
}) {
  const [query, setQuery] = useState('');
  const q = norm(query);
  const searchText = getSearch || getLabel;
  const filtered = q === '' ? options : options.filter((o) => norm(searchText(o)).includes(q));
  const selected = options.find((o) => getValue(o) === value) || null;

  // Gõ chữ không khớp ai trong danh sách → nhận nguyên văn. Chỉ chốt khi KHÔNG còn gợi ý nào, để
  // không cướp Enter của dòng đang focus (đang tìm ra người mà Enter lại nhận chuỗi gõ dở).
  const chotTuDo = () => {
    const t = query.trim();
    if (chapNhanTuDo && t && filtered.length === 0 && t !== value) onChange(t);
  };

  return (
    <Combobox value={value || ''} onChange={(v) => onChange(v || '')}
      onClose={() => { chotTuDo(); setQuery(''); }}
      immediate={moNgay}>
      <div className="relative">
        <ComboboxInput
          className={`${inputClass} bg-surface`}
          placeholder={placeholder}
          autoComplete="off"
          /* ⚠ Giá trị TỰ DO không có trong `options` ⇒ `selected` là null; phải hiện chính `value`,
             nếu không ô trông như trống dù đã nhận giá trị. */
          displayValue={() => (selected ? getLabel(selected) : (chapNhanTuDo ? (value || '') : ''))}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && chapNhanTuDo && query.trim() && filtered.length === 0) {
              e.preventDefault();
              chotTuDo();
              setQuery('');
            }
          }}
        />
        <ComboboxOptions
          anchor="bottom start"
          className="z-[70] max-h-64 w-[var(--input-width)] overflow-auto rounded-input border border-line bg-surface shadow-card [--anchor-gap:4px]"
        >
          {/* ⚠⚠ CHỈ hiện dòng "— Không —" KHI CHƯA GÕ GÌ (fix 2026-08-12). Headless UI tự đặt con trỏ
              vào OPTION ĐẦU TIÊN của danh sách ⇒ để dòng này ở đầu lúc đang gõ thì gõ "HA1" rồi bấm
              Enter sẽ chọn "— Không —" (kết quả khớp nằm ở dòng 2), người dùng phải bấm chuột mới
              chọn được — chậm hẳn thao tác nhập lỗi/biện pháp. Ẩn khi có từ khóa ⇒ Enter lấy đúng
              dòng khớp đầu tiên. Muốn bỏ chọn thì xóa hết chữ trong ô, dòng này hiện lại. */}
          {q === '' && (
            <ComboboxOption
              value=""
              className="cursor-pointer px-3 py-2 text-sm text-ink-soft data-[focus]:bg-surface-muted"
            >
              {emptyLabel}
            </ComboboxOption>
          )}
          {filtered.map((o) => (
            <ComboboxOption
              key={getValue(o)}
              value={getValue(o)}
              className="cursor-pointer px-3 py-2 text-sm text-ink data-[focus]:bg-primary-wash data-[focus]:text-primary"
            >
              {getLabel(o)}
            </ComboboxOption>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-ink-soft">
              {chapNhanTuDo && query.trim()
                ? 'Không có trong danh sách — bấm Enter để dùng tên này'
                : 'Không tìm thấy'}
            </div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
