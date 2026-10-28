import { useState } from 'react';
import Button from '../components/common/Button';
import HuyLyDoModal from '../components/common/HuyLyDoModal';

// ─────────────────────────────────────────────────────────────────────────────
// NÚT "HỦY" Ở TỪNG DÒNG LỊCH SỬ (14/10/2026) — dùng chung cho các màn có gửi dữ liệu sang ERP:
// Lịch sử KCS / Sửa / OQC · Lịch sử phiếu giao · Lịch sử chuyển (Gia công) · Tem đã in · Phân loại lỗi.
// Bấm Hủy ⇒ hộp nhập LÝ DO (bắt buộc) ⇒ gọi API hủy của màn đó (backend hủy trong MES rồi tự báo ERP hủy
// chứng từ theo IDMES) ⇒ tăng `taiLai` để bảng lịch sử tải lại.
//
// Trả:
//   · `cotHuy`            — cột nút Hủy cho `extraColumns` (rỗng khi không có quyền)
//   · `taoCot(hienNut)`   — như trên nhưng tự quyết dòng nào có nút
//   · `moHuy(dong)`       — mở hộp hủy cho 1 dòng (khi nút nằm ngoài bảng)
//   · `modal`             — hộp nhập lý do, đặt 1 lần trong JSX của trang
//   · `taiLai`            — số đếm, truyền cho `HistoryPanel taiLai` / dùng làm `key` tải lại
//
// ⚠ `show` = hàm toast của trang (`useToast().show`) — KHÔNG tạo toast riêng ở đây để khỏi chồng 2 khung báo.
// ─────────────────────────────────────────────────────────────────────────────
// `modalProps` (14/10/2026) = props thêm cho hộp lý do khi dùng cho thao tác NGƯỢC (vd "Mở lại tem in"):
//   { nhanLyDo, ghiChuErp, kieuNut, goiY } — xem `HuyLyDoModal`.
export default function useHuyLichSu({
  goiHuy, show, coQuyen = true, tieuDe = 'Hủy', moTa, hauQua, nhanNut = 'Hủy',
  hienNut = (r) => !!r.id, baoXong = 'Đã hủy', sauKhiHuy, modalProps,
}) {
  const [muc, setMuc] = useState(null);
  const [taiLai, setTaiLai] = useState(0);

  const xacNhan = async (r, lyDo) => {
    try {
      const res = await goiHuy(r, lyDo);
      // `baoXong(dong, duLieuTraVe)` — tham số 2 = `data` API trả (vd `gui_lai_erp` của Mở lại tem in).
      if (show) show(typeof baoXong === 'function' ? baoXong(r, (res && res.data) || {}) : baoXong);
      setMuc(null);
      setTaiLai((n) => n + 1);
      if (sauKhiHuy) sauKhiHuy(r);
    } catch (e) {
      if (show) show(e.message || 'Hủy thất bại', 'error');
      throw e; // để hộp ở lại cho người dùng thử lại
    }
  };

  const taoCot = (duocHien = hienNut) => (coQuyen ? [{
    key: '_huy',
    header: '',
    className: 'text-right',
    render: (r) => (duocHien(r) ? (
      <Button variant="danger" className="px-2.5 py-1 text-xs"
        onClick={(e) => { e.stopPropagation(); setMuc(r); }}>Hủy</Button>
    ) : null),
  }] : []);

  const modal = (
    <HuyLyDoModal muc={muc} onClose={() => setMuc(null)} onXacNhan={xacNhan}
      tieuDe={tieuDe} moTa={moTa} hauQua={hauQua} nhanNut={nhanNut} {...(modalProps || {})} />
  );

  return { cotHuy: taoCot(), taoCot, moHuy: setMuc, modal, taiLai };
}
