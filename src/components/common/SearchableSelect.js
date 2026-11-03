import { useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { inputClass } from './controls';
import { khopTungTu, chuoiTimNguoi } from '../../utils/timKiem';

// Select có ô tìm kiếm (combobox) — dùng khi danh sách dài (vd chọn người trong hàng trăm user).
// Dropdown portal (anchor) để không bị cắt trong Modal/SidePanel.
// getSearch: chuỗi để KHỚP tìm kiếm. Mặc định (07/10/2026) = nhãn + họ tên/tên đăng nhập/mã nhân viên nếu
//   option là NGƯỜI (`chuoiTimNguoi`) ⇒ mọi ô chọn người tự tìm được bằng tên không dấu HOẶC username.
//   Khớp TỪNG TỪ (`khopTungTu`): "nguyen an" ra "Nguyễn Văn An".
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
//
// `onMuiTen(huong, giaTri)` (tùy chọn, ô nằm trong BẢNG nhập theo dòng): phím ↑ ↓ dùng để ĐI SANG DÒNG KHÁC khi danh
//   sách đang đóng, khi gõ ra đúng 1 gợi ý (tự chọn gợi ý đó) hoặc khi gõ tên ngoài danh sách (tự nhận). Danh sách đang
//   mở nhiều gợi ý thì ↑ ↓ vẫn đi trong danh sách. `huong` = 'xuong' | 'len'; `giaTri` = giá trị ô sau khi chốt.
// `inputRef`: ref tới ô nhập, để bảng đặt con trỏ khi đổi dòng.
export default function SearchableSelect({
  inputRef,
  onMuiTen,
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
  const searchText = getSearch || ((o) => chuoiTimNguoi(o, getLabel(o)));
  const filtered = !query.trim() ? options : options.filter((o) => khopTungTu(searchText(o), query));
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
          ref={inputRef}
          className={`${inputClass} bg-surface`}
          placeholder={placeholder}
          autoComplete="off"
          /* ⚠ Giá trị TỰ DO không có trong `options` ⇒ `selected` là null; phải hiện chính `value`,
             nếu không ô trông như trống dù đã nhận giá trị. */
          displayValue={() => (selected ? getLabel(selected) : (chapNhanTuDo ? (value || '') : ''))}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (onMuiTen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              const dangMo = e.currentTarget.getAttribute('aria-expanded') === 'true';
              const go = query.trim();
              const tuDo = chapNhanTuDo && go && filtered.length === 0;
              const motGoiY = go && filtered.length === 1;
              if (!dangMo || tuDo || motGoiY) {
                // ⚠ preventDefault TRƯỚC: Headless UI bỏ qua phím đã bị chặn, không tự bung danh sách.
                e.preventDefault();
                let giaTri = value || '';
                if (tuDo) { giaTri = go; chotTuDo(); } else if (motGoiY) { giaTri = getValue(filtered[0]); onChange(giaTri); }
                setQuery('');
                // ⚠ Danh sách đang mở thì Headless UI khóa (`inert`) mọi ô khác ⇒ phải ĐÓNG trước (rời ô là đóng + ô hiện
                //   lại đúng giá trị đã chốt), bảng mới đặt con trỏ sang dòng khác được.
                if (dangMo) e.currentTarget.blur();
                onMuiTen(e.key === 'ArrowDown' ? 'xuong' : 'len', giaTri);
                return;
              }
            }
            if (e.key === 'Enter' && chapNhanTuDo && query.trim() && filtered.length === 0) {
              e.preventDefault();
              chotTuDo();
              setQuery('');
              // Ô trong bảng nhập theo dòng: đóng danh sách, giữ con trỏ ⇒ bấm ↓ đi tiếp được ngay.
              if (onMuiTen) {
                const el = e.currentTarget;
                el.blur();
                setTimeout(() => el.focus(), 0);
              }
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
          {!query.trim() && (
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
