import { Dialog } from '@headlessui/react';
import Icon from './Icon';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

// `canhTren` = neo modal lên ĐẦU màn hình thay vì canh giữa, cách mép trên `canhTren` px.
// Dùng cho modal CAO và hay đổi chiều cao (vd Quét/tích ở READY: danh sách quét dài dần ra) —
// canh giữa thì mỗi lần thêm dòng cả hộp lại nhích lên, nhìn rất khó chịu.
// ⚠ Mặc định `null` = canh giữa như cũ ⇒ mọi modal khác KHÔNG đổi.
export default function Modal({ open, onClose, title, children, footer, size = 'md', canhTren = null }) {
  const neoTren = canhTren != null;
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className={`fixed inset-0 flex justify-center p-4 ${neoTren ? 'items-start overflow-y-auto' : 'items-center'}`}
        style={neoTren ? { paddingTop: canhTren } : undefined}>
        {/* Neo trên: trừ luôn khoảng cách trên + lề dưới khỏi chiều cao tối đa để hộp không tràn đáy. */}
        <Dialog.Panel
          className={`flex w-full flex-col ${SIZES[size]} rounded-card bg-surface shadow-card-hover ${neoTren ? '' : 'max-h-[90vh]'}`}
          style={neoTren ? { maxHeight: `calc(100vh - ${canhTren + 16}px)` } : undefined}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <button onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-surface-muted">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">{footer}</div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
