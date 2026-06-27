import Icon from './Icon';

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-primary-wash text-primary hover:bg-blue-100',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90',
};

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold
        transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Icon name="loader" size={16} className="animate-spin" /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
