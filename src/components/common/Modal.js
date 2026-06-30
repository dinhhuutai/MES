import { Dialog } from '@headlessui/react';
import Icon from './Icon';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`w-full ${SIZES[size]} rounded-card bg-surface shadow-card-hover`}>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <button onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-surface-muted">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
