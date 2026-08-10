import React from 'react';
import { Dialog } from '@headlessui/react';
import ReportDesignerPage from '../pages/ReportDesignerPage';

// ─────────────────────────────────────────────────────────────────────────────
// TRÌNH THIẾT KẾ BÁO CÁO — MODAL TOÀN MÀN HÌNH (giống trình Thiết kế tem).
// Bấm "Mở" ở danh sách báo cáo là bung ra đây, không rời trang ⇒ đóng lại là về đúng chỗ cũ
// (còn nguyên bộ lọc / vị trí cuộn của danh sách).
//
// ⚠ Dùng lại NGUYÊN `ReportDesignerPage` qua prop `idProp`/`onClose` thay vì chép ra bản thứ hai —
//   trang đó gần 750 dòng, tách đôi là sớm muộn 2 bên lệch tính năng.
// ⚠ `onClose` rỗng ở Dialog: KHÔNG cho Esc / bấm nền đóng — đang thiết kế dở mà lỡ tay là mất công.
//   Đóng bằng nút ✕ ở góc trái header (chính là nút "về danh sách" của trang khi chạy dạng route).
// ⚠ Các modal con bên trong (Chọn chỉ số · Khối danh sách · Biểu đồ · Lịch sử…) cũng là Dialog z-50;
//   Headless UI xếp chồng theo thứ tự mở nên chúng vẫn nằm TRÊN modal này.
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportDesignerModal({ open, id, onClose }) {
  if (!open || !id) return null;
  return (
    <Dialog open onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0">
        <Dialog.Panel className="h-full w-full overflow-hidden bg-surface p-4">
          {/* `key` để mở báo cáo khác là dựng lại state sạch (grid, lịch sử hoàn tác, ô đang chọn) */}
          <ReportDesignerPage key={id} idProp={id} onClose={onClose} />
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
