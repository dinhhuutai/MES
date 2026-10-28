import { Dialog } from '@headlessui/react';
import Icon from './Icon';

// `full` = gần trọn bề ngang màn hình — dành cho modal có BẢNG NHIỀU CỘT (vd Danh sách release 18 cột);
// `max-w-5xl` của `xl` khiến bảng phải cuộn ngang rất nhiều.
const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[96vw]' };
// Modal LỚN (bảng / biểu mẫu dài) ⇒ trên điện thoại chiếm TRỌN màn hình (28/10/2026). sm/md (hộp xác nhận, hỏi lý do)
//   vẫn là hộp nổi giữa màn hình, chỉ lề hẹp hơn.
const TOAN_MAN_DT = new Set(['lg', 'xl', 'full']);

// `canhTren` = neo modal lên ĐẦU màn hình thay vì canh giữa, cách mép trên `canhTren` px.
// Dùng cho modal CAO và hay đổi chiều cao (vd Quét/tích ở READY: danh sách quét dài dần ra) —
// canh giữa thì mỗi lần thêm dòng cả hộp lại nhích lên, nhìn rất khó chịu.
// ⚠ Mặc định `null` = canh giữa như cũ ⇒ mọi modal khác KHÔNG đổi.
//
// `lapDay` = modal LUÔN cao hết mức cho phép và **thân KHÔNG tự cuộn** — con tự lo phần cuộn của nó.
// Dùng cho modal có bảng: để mặc định thì vừa cuộn thân modal vừa cuộn bảng bên trong (2 thanh cuộn
// lồng nhau), thao tác rất khó chịu. Bật cờ này rồi cho vùng bảng `flex-1 min-h-0 overflow-auto` ⇒
// đầu modal (bộ lọc, chip) đứng yên, CHỈ bảng cuộn và luôn vừa khít chiều cao còn lại.
// ⚠ Mặc định `false` ⇒ mọi modal khác KHÔNG đổi.
//
// ⚠ Chiều cao / lề trên đi qua BIẾN CSS (`--modal-cao`, `--modal-tren`) + lớp `sm:` — để trên điện thoại modal lớn
//   bỏ được lề + chiều cao desktop (style inline không có media query).
export default function Modal({ open, onClose, title, children, footer, size = 'md', canhTren = null, lapDay = false }) {
  const neoTren = canhTren != null;
  const toanMan = TOAN_MAN_DT.has(size) || lapDay;
  // Neo trên: trừ luôn khoảng cách trên + lề dưới khỏi chiều cao để hộp không tràn đáy.
  const caoCss = neoTren ? `calc(100vh - ${canhTren + 16}px)` : '90vh';
  const bien = { '--modal-cao': caoCss, '--modal-tren': `${neoTren ? canhTren : 16}px` };
  const caoLop = lapDay
    ? (toanMan ? 'h-[100dvh] sm:h-[var(--modal-cao)]' : 'h-[var(--modal-cao)]')
    : (toanMan ? 'max-h-[100dvh] sm:max-h-[var(--modal-cao)]' : 'max-h-[92dvh] sm:max-h-[var(--modal-cao)]');
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div style={bien}
        className={`fixed inset-0 flex justify-center ${toanMan ? 'p-0 sm:p-4' : 'p-3 sm:p-4'} ${neoTren ? 'items-start overflow-y-auto sm:pt-[var(--modal-tren)]' : 'items-center'}`}>
        <Dialog.Panel
          className={`flex w-full flex-col ${SIZES[size]} ${toanMan ? 'rounded-none sm:rounded-card' : 'rounded-card'} bg-surface shadow-card-hover ${caoLop}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
            <Dialog.Title className="min-w-0 text-base font-semibold text-ink">{title}</Dialog.Title>
            <button onClick={onClose} aria-label="Đóng" className="shrink-0 rounded p-1.5 text-ink-soft hover:bg-surface-muted">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className={`min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-5 ${lapDay ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-3 py-3 sm:px-6 sm:py-4">{footer}</div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
