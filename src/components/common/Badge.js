// Badge trạng thái dạng pill. Map nhóm → màu; mặc định xám.
const TONES = {
  default: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-50 text-primary',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
};

export default function Badge({ children, tone = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.default} ${className}`}
    >
      {children}
    </span>
  );
}
