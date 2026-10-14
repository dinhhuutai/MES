import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Field, Textarea } from './controls';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "HỦY — NHẬP LÝ DO" dùng chung cho nút Hủy ở các bảng lịch sử (14/10/2026):
// Tem đã in (Xác nhận chạy) · Lịch sử KCS / Sửa / OQC · Lịch sử phiếu giao · Lịch sử chuyển (Gia công) ·
// Phân loại lỗi. Hủy xong backend tự báo ERP hủy chứng từ theo IDMES của lượt đó.
//
// · `muc`        = dòng đang hủy (null ⇒ hộp đóng).
// · `tieuDe`     = tiêu đề hộp · `moTa(muc)` = dòng nói rõ đang hủy cái gì · `hauQua` = câu nhắc hậu quả.
// · `onXacNhan(muc, lyDo)` = hàm async gọi API; NÉM lỗi thì hộp ở lại (trang tự báo toast).
// · LÝ DO BẮT BUỘC — nút khóa tới khi có chữ.
// · Dùng lại cho thao tác NGƯỢC (vd "Mở lại tem in", 14/10/2026): `nhanLyDo` · `ghiChuErp` (câu cuối về ERP; `''` = ẩn)
//   · `kieuNut` ('danger' | 'primary').
// ─────────────────────────────────────────────────────────────────────────────
export default function HuyLyDoModal({
  muc, onClose, onXacNhan, tieuDe = 'Hủy', moTa, hauQua, nhanNut = 'Hủy', goiY = 'Vì sao hủy (vd: nhập nhầm số lượng)...',
  nhanLyDo = 'Lý do hủy',
  ghiChuErp = 'Hủy xong hệ thống tự báo ERP hủy chứng từ tương ứng (nếu lượt này đã gửi sang ERP).',
  kieuNut = 'danger',
}) {
  const [lyDo, setLyDo] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  // Mở cho dòng khác ⇒ xóa lý do của dòng trước.
  useEffect(() => { if (muc) { setLyDo(''); setDangLuu(false); } }, [muc]);

  const bam = async () => {
    const ly = lyDo.trim();
    if (!ly || dangLuu) return;
    setDangLuu(true);
    try {
      await onXacNhan(muc, ly);
    } catch { /* trang gọi đã báo lỗi — giữ hộp để sửa lý do / thử lại */ } finally {
      setDangLuu(false);
    }
  };

  return (
    <Modal open={!!muc} onClose={onClose} title={tieuDe} size="md"
      footer={
        <>
          <Button variant="ghost" chiXemOk onClick={onClose}>Đóng</Button>
          <Button variant={kieuNut} onClick={bam} loading={dangLuu} disabled={!lyDo.trim()}>{nhanNut}</Button>
        </>
      }>
      {muc && (
        <div className="space-y-3">
          {moTa && <div className="rounded-card border border-line bg-surface-muted p-3 text-sm text-ink">{moTa(muc)}</div>}
          <Field label={nhanLyDo} required>
            <Textarea rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder={goiY} autoFocus />
          </Field>
          {(hauQua || ghiChuErp) && (
            <p className="text-xs text-ink-soft">{[hauQua, ghiChuErp].filter(Boolean).join(' ')}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
