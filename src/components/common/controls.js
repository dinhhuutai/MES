// Style + control nhập liệu dùng chung.
export const inputClass =
  'h-11 w-full rounded-input border border-line px-3.5 text-sm outline-none transition ' +
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
    <select {...props} className={`${inputClass} bg-white ${props.className || ''}`}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-input border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${props.className || ''}`}
    />
  );
}
