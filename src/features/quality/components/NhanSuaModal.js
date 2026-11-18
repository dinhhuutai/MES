import { useCallback, useMemo } from 'react';
import TichTemNhapModal from '../../../components/common/TichTemNhapModal';
import { listChoNhanSua, nhanSua } from '../../../services/qualityService';
import { fmtNum, timTheoMaTem } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "NHẬN SỬA" (mig 132, 14/11/2026 — người dùng chốt) — mở từ màn Sửa (và trang Hệ thống › Chờ nhận sửa).
// ⚠ 18/11/2026 (người dùng: "thao tác nhanh giống phân loại lỗi, bấm xuống là thêm hàng, bỏ input ở trên cùng, input theo từng
//   hàng"): dùng CHUNG khung `TichTemNhapModal` của KCS / Phân loại lỗi / Sửa — mở ra 1 dòng trống, mỗi dòng 1 ô quét mã tem,
//   tra được ⇒ con trỏ sang ô "SL nhận" (điền sẵn = còn chờ nhận), Enter / ↓ ⇒ dòng mới. Xác nhận ⇒ mỗi dòng 1 lần
//   `POST /quality/sua/nhan` (tuần tự, dòng lỗi ở lại kèm câu lỗi). Danh sách đầy đủ tem chờ nhận: Hệ thống › Chờ nhận sửa.
//   Tra mã = gọi danh sách chờ nhận với ô tìm = mã quét (BE tự quy nhãn 16/17 về tem gốc) ⇒ luôn số mới nhất.
// Luật + chặn ở BE `quality/nhansua.service.js` (SL ≤ chờ nhận, tem đã phân loại lỗi).
// ─────────────────────────────────────────────────────────────────────────────
const soNguyen = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : 0;
};
const TRUONG = [{ k: 'sl', label: 'SL nhận' }];
const khoaDong = (r) => r.tem_id;
const maHien = (r) => r.ma_tem;
const soCan = (r) => Number(r.cho_nhan) || 0;
const formMoi = (r) => ({ sl: String(soCan(r)) });
const danhGia = (r, f) => {
  const sl = soNguyen(f.sl);
  const con = soCan(r);
  if (!sl) return { ok: false, chu: 'Nhập SL nhận (số nguyên > 0)' };
  if (sl > con) return { ok: false, chu: `Tối đa ${fmtNum(con)}` };
  if (sl < con) return { ok: true, motPhan: true, chu: `Nhận ${fmtNum(sl)} · còn ${fmtNum(con - sl)} chờ` };
  return { ok: true, chu: 'Nhận đủ' };
};

export default function NhanSuaModal({ open, onClose, show, onDone }) {
  const traMa = useCallback(async (code) => {
    const res = await listChoNhanSua({ search: code });
    if (res.data?.co_cot === false) return { loi: 'Chưa chạy migration 132 (Nhận sửa)' };
    const r = timTheoMaTem(res.data?.items || [], code);
    if (!r) return { loi: 'Không có phần chờ nhận sửa — chưa phân loại lỗi, hoặc đã nhận hết (xem màn Sửa)' };
    return { row: { ...r, ma_phan: r.phan_list } };
  }, []);
  const luu = useCallback((r, f) => nhanSua([{ temId: r.tem_id, soLuong: soNguyen(f.sl) }], ''), []);
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
      title="Nhận sửa — quét tem, nhập số lượng nhận" nhanXacNhan="Xác nhận nhận sửa" iconXacNhan="check"
      traMa={traMa} khoaDong={khoaDong} maHien={maHien} soCan={soCan} nhanSoCan="Chờ nhận"
      truong={TRUONG} formMoi={formMoi} danhGia={danhGia} luu={luu} onXong={onXong} />
  );
}
