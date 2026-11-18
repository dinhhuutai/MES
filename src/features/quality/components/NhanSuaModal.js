import { useCallback, useMemo } from 'react';
import TichTemNhapModal from '../../../components/common/TichTemNhapModal';
import { listChoNhanSua, nhanSua } from '../../../services/qualityService';
import { fmtNum, timTheoMaTem } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "NHẬN SỬA" (mig 132, 14/11/2026 — người dùng chốt) — mở từ màn Sửa (và trang Hệ thống › Chờ nhận sửa).
// ⚠ 18/11/2026 (người dùng: "thao tác nhanh giống phân loại lỗi, bấm xuống là thêm hàng, bỏ input ở trên cùng, input theo từng
//   hàng"): dùng CHUNG khung `TichTemNhapModal` của KCS / Phân loại lỗi / Sửa — mở ra 1 dòng trống, mỗi dòng 1 ô quét mã tem,
//   tra được ⇒ con trỏ xuống ô quét của dòng dưới (xem ⚠ bên dưới). Xác nhận ⇒ mỗi dòng 1 lần
//   `POST /quality/sua/nhan` (tuần tự, dòng lỗi ở lại kèm câu lỗi). Danh sách đầy đủ tem chờ nhận: Hệ thống › Chờ nhận sửa.
//   Tra mã = gọi danh sách chờ nhận với ô tìm = mã quét (BE tự quy nhãn 16/17 về tem gốc) ⇒ luôn số mới nhất.
// ⚠ 18/11/2026 (người dùng: "tích thì nhảy xuống dòng dưới, focus input hàng dưới luôn, không cần nhảy vào SL nhận, tự động lấy
//   từ phân loại lỗi"): BỎ ô "SL nhận" — SL nhận = toàn bộ phần CHỜ NHẬN của tem (= SL sửa theo phiếu Phân loại lỗi − đã
//   nhận). Bảng không còn ô nhập ⇒ `TichTemNhapModal` quét xong tự sang ô quét dòng dưới. (API vẫn nhận một phần nếu sau này cần.)
// Luật + chặn ở BE `quality/nhansua.service.js` (SL ≤ chờ nhận, tem đã phân loại lỗi).
// ─────────────────────────────────────────────────────────────────────────────
const TRUONG = [];
const khoaDong = (r) => r.tem_id;
const maHien = (r) => r.ma_tem;
const soCan = (r) => Number(r.cho_nhan) || 0;
const formMoi = () => ({});
const danhGia = (r) => (soCan(r) > 0
  ? { ok: true, chu: `Nhận ${fmtNum(soCan(r))}` }
  : { ok: false, chu: 'Không còn phần chờ nhận' });

export default function NhanSuaModal({ open, onClose, show, onDone }) {
  const traMa = useCallback(async (code) => {
    const res = await listChoNhanSua({ search: code });
    if (res.data?.co_cot === false) return { loi: 'Chưa chạy migration 132 (Nhận sửa)' };
    const r = timTheoMaTem(res.data?.items || [], code);
    if (!r) return { loi: 'Không có phần chờ nhận sửa — chưa phân loại lỗi, hoặc đã nhận hết (xem màn Sửa)' };
    return { row: { ...r, ma_phan: r.phan_list } };
  }, []);
  const luu = useCallback((r) => nhanSua([{ temId: r.tem_id, soLuong: soCan(r) }], ''), []);
  const onXong = useMemo(() => (so, loi) => {
    if (so) onDone?.();
    if (!loi.length) {
      show?.(`Đã nhận sửa ${fmtNum(so)} tem — đã lên màn Sửa`);
      onClose();
    } else {
      show?.(`Đã nhận ${fmtNum(so)}/${fmtNum(so + loi.length)} tem — lỗi: ${loi.join(', ')}`, 'error');
    }
  }, [onDone, onClose, show]);

  return (
    <TichTemNhapModal open={open} onClose={onClose} show={show}
      title="Nhận sửa — quét tem (SL nhận lấy theo phân loại lỗi)" nhanXacNhan="Xác nhận nhận sửa" iconXacNhan="check"
      traMa={traMa} khoaDong={khoaDong} maHien={maHien} soCan={soCan} nhanSoCan="SL nhận"
      truong={TRUONG} formMoi={formMoi} danhGia={danhGia} luu={luu} onXong={onXong} />
  );
}
