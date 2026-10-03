// DANH SÁCH FINISH (màn OQC, 03/10/2026) — phần dùng chung giữa modal và file Excel.
// Luật từng cột ở backend `utils/danhSachFinish.js` (dòng đã có sẵn số); ở đây chỉ: bộ lọc, chip chuyền,
// khối tổng MỤC TIÊU / KẾT QUẢ (tính trên tập ĐANG XEM để khớp bảng khi lọc).
import { hopChipChuyen, demChip } from '../../../utils/khuChuyen';

// Bộ lọc từng trường — áp cho CẢ dòng finish LẪN tập mục tiêu (cùng tên cột).
export const FILTER_FIELDS = [
  { key: 'chuyen', label: 'Máy / bàn', col: 'ma_chuyen' },
  { key: 'khach', label: 'Cty (khách)', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích film', col: 'kich_phim' },
  { key: 'barcode', label: 'Barcode', col: 'barcode' },
];
export const oTimCols = (r) => [
  r.ma_chuyen, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.ma_phan, r.mau_vai, r.kich_vai, r.kich_phim, r.barcode,
];

// 1 dòng có thể ứng NHIỀU chuyền (phần in OQC trong ngày từ nhiều lệnh) ⇒ `r.chuyen` = mảng {ma_chuyen, ma_loai_chuyen};
// khớp chip khi BẤT KỲ chuyền nào khớp (cùng luật `hopChipChuyen` của Danh sách release / Theo dõi chuyền).
export const khopChip = (r, chip) => !chip || (r.chuyen || []).some((c) => hopChipChuyen(c, chip));
// Số trên chip: đếm DÒNG (khử trùng theo chỉ số dòng — 1 dòng 2 chuyền cùng loại vẫn tính 1).
export const demChipFinish = (rows) => demChip(
  rows.flatMap((r, i) => ((r.chuyen || []).length ? r.chuyen : [{}]).map((c) => ({ ...c, _i: i }))),
  (x) => [x._i],
);

// Khối tổng (khuôn tờ giấy): TỔNG PO · TỔNG MÃ · PHẦN · SLĐH · SLNV — đếm KHÔNG TRÙNG theo phần in (1 phần in
// finish nhiều ngày vẫn tính 1; SLĐH/SLNV cộng 1 lần mỗi phần in).
export function tongHop(rows) {
  const po = new Set(); const ma = new Set(); const pin = new Map();
  for (const r of rows || []) {
    if (r.ma_don_hang) po.add(r.ma_don_hang);
    if (r.ma_hang) ma.add(`${r.ma_don_hang || ''}|${r.ma_hang}`);
    if (r.phan_in_id && !pin.has(r.phan_in_id)) pin.set(r.phan_in_id, r);
  }
  let sldh = 0; let slnv = 0;
  for (const r of pin.values()) { sldh += Number(r.so_luong_don_hang) || 0; slnv += Number(r.slnv) || 0; }
  return { tong_po: po.size, tong_ma: ma.size, phan: pin.size, sldh, slnv };
}

export const fmtDMY = (s) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : ''; };
