import Icon from './Icon';
import Spinner from './Spinner';
import useChiXem, { NHAC_CHI_XEM } from '../../hooks/useChiXem';

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
  // ⚠⚠ TÀI KHOẢN CHỈ XEM (mig 096): nút **KHÓA THEO MẶC ĐỊNH**, khai `chiXemOk` để mở.
  //   Khóa-mặc-định là cố ý — nút GHI mới thêm về sau tự động an toàn; nếu làm ngược
  //   lại (mở mặc định, khai cờ để khóa) thì mỗi nút mới quên khai là một lỗ hổng.
  //   Đặt `chiXemOk` cho nút KHÔNG đụng dữ liệu: Xuất Excel · In/Xem trước · Đóng ·
  //   Bộ lọc · Xóa lọc · Lịch sử · Đã hoàn thành · Nghẽn · phân trang · đổi tab…
  chiXemOk = false,
  ...rest
}) {
  const chiXem = useChiXem();
  const khoaChiXem = chiXem && !chiXemOk;

  return (
    <button
      type={type}
      disabled={disabled || loading || khoaChiXem}
      className={`inline-flex items-center justify-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold
        transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
      // ⚠ Đặt SAU `{...rest}` để thắng `title` của nơi gọi khi nút đang bị khóa;
      // không khóa thì giữ nguyên title cũ (nếu trang có truyền).
      {...(khoaChiXem ? { title: NHAC_CHI_XEM } : null)}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
