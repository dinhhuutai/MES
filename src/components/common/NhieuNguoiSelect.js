import { useMemo, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import Icon from './Icon';
import { inputClass } from './controls';
import { chuanTim as norm } from '../../utils/timKiem';

// Ô chọn NHIỀU NGƯỜI — giá trị lưu là 1 CHUỖI các tên ngăn cách bằng dấu phẩy (vd "Nguyễn A, Trần B").
//
// Vì sao lưu chuỗi: cột đích (`phan_cong_san_xuat.tho_in`) là VARCHAR/TEXT sẵn có ⇒ KHÔNG cần
// migration, và mọi màn đang đọc chuỗi đó (tem, Excel, báo cáo) chạy y như cũ.
//
// Cách dùng: chọn 1 người trong danh sách → tên được THÊM vào danh sách, ô tìm trống lại để chọn
// tiếp. Gõ tên KHÔNG có trong danh sách rồi Enter cũng thêm được (thợ khoán / người mới chưa có tài
// khoản) — đó là lý do không dùng `SearchableSelect` (component đó chỉ chọn được trong options).
// Tìm KHÔNG DẤU qua `utils/timKiem`.
export default function NhieuNguoiSelect({
  value = '',
  onChange,
  options = [],
  getLabel = (o) => o.ho_ten || o.ten_dang_nhap || '',
  getSearch,
  placeholder = 'Gõ tên để tìm rồi Enter...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const q = norm(query);
  const searchText = getSearch || getLabel;

  const ten = useMemo(
    () => String(value || '').split(',').map((s) => s.trim()).filter(Boolean),
    [value]
  );
  const daCo = (t) => ten.some((x) => norm(x) === norm(t));

  const ghi = (list) => onChange(list.join(', '));
  const them = (t) => {
    const s = String(t || '').trim();
    if (!s || daCo(s)) return;
    ghi([...ten, s]);
  };
  const bo = (i) => ghi(ten.filter((_, j) => j !== i));

  // Ẩn người ĐÃ CHỌN khỏi danh sách gợi ý cho khỏi bấm trùng.
  const filtered = useMemo(() => {
    const conLai = options.filter((o) => !daCo(getLabel(o)));
    return q === '' ? conLai : conLai.filter((o) => norm(searchText(o)).includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, q, value]);

  return (
    <div>
      {ten.length > 0 && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {ten.map((t, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={`${t}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-2.5 py-1 text-xs font-medium text-primary">
              {t}
              {!disabled && (
                <button type="button" onClick={() => bo(i)} aria-label={`Bỏ ${t}`}
                  className="hover:text-danger"><Icon name="x" size={12} /></button>
              )}
            </span>
          ))}
          {!disabled && ten.length > 1 && (
            <button type="button" onClick={() => ghi([])}
              className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa hết</button>
          )}
        </div>
      )}

      <Combobox
        value=""
        onChange={(v) => { them(v); setQuery(''); }}
        onClose={() => setQuery('')}
        immediate
        disabled={disabled}
      >
        <div className="relative">
          <ComboboxInput
            className={`${inputClass} bg-surface`}
            placeholder={placeholder}
            autoComplete="off"
            value={query}
            displayValue={() => query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Gõ tên KHÔNG khớp ai trong danh sách rồi Enter ⇒ thêm nguyên văn.
              // ⚠ Chỉ làm khi danh sách gợi ý RỖNG — còn gợi ý thì để Headless UI chọn dòng đang
              //   focus (nếu không sẽ thêm chuỗi đang gõ dở thay vì người vừa tìm ra).
              if (e.key === 'Enter' && query.trim() && filtered.length === 0) {
                e.preventDefault();
                them(query);
                setQuery('');
              }
            }}
          />
          <ComboboxOptions
            anchor="bottom start"
            className="z-[70] max-h-64 w-[var(--input-width)] overflow-auto rounded-input border border-line bg-surface shadow-card [--anchor-gap:4px]"
          >
            {filtered.map((o) => (
              <ComboboxOption key={getLabel(o)} value={getLabel(o)}
                className="cursor-pointer px-3 py-2 text-sm text-ink data-[focus]:bg-primary-wash data-[focus]:text-primary">
                {getLabel(o)}
              </ComboboxOption>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-ink-soft">
                {query.trim() ? 'Không có trong danh sách — bấm Enter để thêm tên này' : 'Đã chọn hết'}
              </div>
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>
  );
}
