// ─────────────────────────────────────────────────────────────────────────────
// CHỜ KÝ TÊN — màn READY Kỹ thuật + QC READY (26/11/2026, người dùng chốt).
//   Kỹ thuật xác nhận xong thì đem hồ sơ đi ký tên ⇒ chuột phải dòng (hoặc tích dòng trong modal Quét / tích) ⇒ "Chờ ký tên";
//   ký xong ⇒ "Bỏ chờ ký tên". STT khoanh Ô VUÔNG ĐỎ. QC READY cũng đánh dấu được (KT quên đánh dấu mà đã xác nhận xong).
//   Đợt KT đã xong mà đang chờ ký tên ⇒ SLA QC READY CHƯA đếm (BE `technical/choKyTen.apSlaQc`).
//   Đánh dấu THEO ĐỢT VẢI của dòng (`dot_vai_ids`); trạng thái ở `row.cho_ky_ten` (BE `technical/choKyTen.ganVaoDong`).
// ⚠ Component khai ở MỨC MODULE (luật §9).
// ─────────────────────────────────────────────────────────────────────────────
import { fmtDateTime } from '../../../utils/format';

// Dòng có đợt ĐANG chờ ký tên (dòng thường 1 đợt; dòng nhiều đợt — có ít nhất 1 đợt đang chờ).
export const coChoKyTen = (r) => !!(r && r.cho_ky_ten && r.cho_ky_ten.so_dot_cho > 0);
// MỌI đợt của dòng đang chờ (menu: hết việc "đánh dấu").
export const daChoKyTenHet = (r) => !!(r && r.cho_ky_ten && r.cho_ky_ten.dang);
export const moTaChoKyTen = (ck) => (ck ? `Chờ ký tên${ck.nguoi ? ` — ${ck.nguoi}` : ''}${ck.tg ? ` · ${fmtDateTime(ck.tg)}` : ''}` : '');

// Ô STT màn READY / QC READY: chờ ký tên ⇒ Ô VUÔNG ĐỎ bao ngoài `children` (màn KT truyền STT đã khoanh tròn nhận file BH).
export function SttChoKyTen({ row, children }) {
  if (!coChoKyTen(row)) return children;
  return (
    <span title={moTaChoKyTen(row.cho_ky_ten)}
      className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-[3px] px-0.5 font-semibold text-red-700 ring-2 ring-red-500 dark:text-red-300">
      {children}
    </span>
  );
}

// Badge "Chờ ký tên" (cột trạng thái / kỹ thuật).
export function ChoKyTenBadge({ row, className = '' }) {
  if (!coChoKyTen(row)) return null;
  return (
    <span title={moTaChoKyTen(row.cho_ky_ten)}
      className={`inline-flex items-center rounded-[3px] border border-red-400 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300 ${className}`}>
      Chờ ký tên
    </span>
  );
}
