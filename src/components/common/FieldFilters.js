import Button from './Button';
import Icon from './Icon';
import { khop, chuanTuKhoa } from '../../utils/timKiem';

// Panel LỌC NHIỀU TRƯỜNG (kết hợp AND) + chip hiển thị lọc đang bật — dùng chung nhiều trang.
// props: fields [{key,label}], values {key:val}, onField(key,val), onClear, open, labelMap? (nhãn chip).
export default function FieldFilters({ fields, values, onField, onClear, open, labelMap }) {
  const active = Object.entries(values || {}).filter(([, v]) => v);
  const nameOf = (k) => (labelMap && labelMap[k]) || (fields.find((f) => f.key === k) || {}).label || k;
  return (
    <>
      {open && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={onClear} disabled={!active.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={values[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
              </div>
            ))}
          </div>
        </div>
      )}
      {active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {active.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary">
              {nameOf(k)}: {v}
              <button onClick={() => onField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa"><Icon name="x" size={12} /></button>
            </span>
          ))}
          <button onClick={onClear} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
        </div>
      )}
    </>
  );
}

// Lọc CLIENT-SIDE danh sách theo các trường (fields có `col` = tên thuộc tính hàng). Kết hợp AND,
// khớp CHỨA — **không phân biệt hoa–thường, KHÔNG PHÂN BIỆT DẤU**, tự bỏ khoảng trắng thừa (`khop`).
//
// ⚠⚠ HÀNG CỦA LỆNH **GOM SET** MANG NHIỀU PHẦN IN: các query mức lệnh dùng `PHAN_INFO_LATERAL`
//   với `LIMIT 1` nên `r.ma_phan`/`r.ma_hang`/`r.mau_vai`… chỉ là **phần in ĐẠI DIỆN**. Chỉ so
//   `r[f.col]` thì lọc theo phần in THỨ HAI sẽ **LÀM MẤT CẢ LỆNH** — người dùng tưởng hàng không
//   tồn tại. (Lỗi thật 14/08/2026 ở màn Lập kế hoạch lại: lọc `SL-2608-006-A07-F01-C05` không ra
//   vì lệnh LSX0605 hiện phần in đại diện `…-C02`. Đo prod: 175/837 lệnh Replan · 166/608 Test Run
//   · 74/211 Gia công là gom set.)
// ⇒ Hàng nào có `phan_in_list` thì khớp khi **BẤT KỲ phần in nào** trong đó khớp — cùng cách hiểu
//   với dòng gom set ở màn Release 1. Hàng không có `phan_in_list` chạy y như cũ.
const khopHang = (r, col, kw) => {
  if (khop(r[col], kw)) return true;
  const ds = r.phan_in_list;
  return Array.isArray(ds) && ds.some((p) => khop(p[col], kw));
};

export function filterRows(rows, filters, fields) {
  const active = fields.filter((f) => chuanTuKhoa(filters[f.key]));
  if (!active.length) return rows || [];
  return (rows || []).filter((r) => active.every((f) => khopHang(r, f.col, filters[f.key])));
}

// Nút bật/tắt panel lọc (kèm số lọc đang bật).
export function FilterToggle({ open, count, onClick }) {
  return (
    <Button variant={open || count ? 'secondary' : 'ghost'} icon="filter" onClick={onClick}>
      Bộ lọc{count ? ` (${count})` : ''}
    </Button>
  );
}
