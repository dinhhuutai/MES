// Style + control nhập liệu dùng chung.
// ⚠⚠ CỠ CHỮ `text-base md:text-sm` — KHÔNG đổi thành `text-sm` trơn: **iOS Safari TỰ PHÓNG TO cả trang
// khi focus vào input/select/textarea có font-size < 16px**, và vì viewport (`public/index.html`) cố ý
// KHÔNG đặt `maximum-scale` (để người dùng còn pinch-zoom được) nên nó **KHÔNG tự thu lại** ⇒ giao diện
// kẹt ở trạng thái phóng to. Lỗi đã gặp thật trên PWA iPhone (bấm ô "Quét đầu đọc" trong modal quét).
// ⇒ Mobile (<md) dùng 16px để iOS khỏi zoom · desktop (md+) giữ 14px như thiết kế cũ.
export const inputClass =
  'h-11 w-full rounded-input border border-line px-3.5 text-base md:text-sm outline-none transition ' +
  'focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-surface-muted';

export function Field({ label, required, error, hint, children }) {
  return (
    <div className="mb-4">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-ink">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className={`${inputClass} ${props.className || ''}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${inputClass} bg-surface ${props.className || ''}`}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-input border border-line px-3.5 py-2.5 text-base md:text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${props.className || ''}`}
    />
  );
}
