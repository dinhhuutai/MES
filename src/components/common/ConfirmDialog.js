import Modal from './Modal';
import Button from './Button';

// `children` (tùy chọn, 09/10/2026) = nội dung thêm dưới câu hỏi (vd cảnh báo + danh sách) — `message` nằm trong
// `<p>` nên không nhét khối/danh sách vào đó được.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  variant = 'primary',
  loading = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {/* Nút ĐÓNG hộp thoại — luôn bấm được, kể cả tài khoản chỉ xem (nếu khóa
              luôn thì hộp thoại lỡ mở ra sẽ không có đường thoát). Nút xác nhận bên
              phải KHÔNG khai `chiXemOk` ⇒ tự khóa. */}
          <Button variant="ghost" chiXemOk onClick={onClose}>
            Hủy
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
      {children && <div className="mt-3">{children}</div>}
    </Modal>
  );
}
