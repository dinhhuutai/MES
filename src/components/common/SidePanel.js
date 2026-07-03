import { Dialog } from '@headlessui/react';
import Icon from './Icon';

// Drawer trượt từ phải (mặc định) hoặc trái — dùng cho xem chi tiết (thay vì chuyển trang).
export default function SidePanel({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg', side = 'right' }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className={`fixed inset-y-0 flex max-w-full ${side === 'left' ? 'left-0' : 'right-0'}`}>
        <Dialog.Panel className={`flex w-screen ${width} flex-col bg-surface shadow-card-hover`}>
          <div className="flex items-start justify-between border-b border-line px-4 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
              {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-surface-muted">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">{footer}</div>}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
