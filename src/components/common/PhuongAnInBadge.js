import Badge from './Badge';

// Phương án in (HSKT / ERP Pain): 1 Bàn · 2 Máy · 3 Robot · 4 Logo · 5 Ép (4 + 5 thêm 10/11/2026, người dùng chốt bộ số).
// ⚠ ERP CÓ gửi Pain = 0 = chưa xác định (chưa gán) — khớp `backend/src/utils/hskt.js`, đổi cả 2 nơi.
export const PHUONG_AN_IN = { 0: 'Chưa xác định', 1: 'Bàn', 2: 'Máy', 3: 'Robot', 4: 'Logo', 5: 'Ép' };
// Giá trị người dùng ĐẶT được (không có 0 — chỉ ERP ghi "chưa xác định"); gương BE `utils/hskt.js PAIN_HOP_LE`.
export const PAIN_HOP_LE = [1, 2, 3, 4, 5];

// Dải chip lọc theo PHƯƠNG ÁN IN (dùng ở màn Release 1) — dựng TỪ `PHUONG_AN_IN` để nhãn không bao
// giờ lệch với badge. `v` là chuỗi vì `ChipTabs` so sánh bằng `===`.
// ⚠ Chip "Chưa xác định" gộp cả Pain = 0 LẪN phần in KHÔNG CÓ HSKT active (`phuong_an_in` null) —
//   với người lập kế hoạch thì cả hai đều là "chưa biết in ở đâu", tách ra chỉ làm rối.
export const PAIN_TABS = [
  { v: '', label: 'Tất cả' },
  ...PAIN_HOP_LE.map((v) => ({ v: String(v), label: PHUONG_AN_IN[v] })),
  { v: '0', label: PHUONG_AN_IN[0] },
];

// Khóa gom nhóm của 1 hàng: null/rỗng/0 đều về '0'.
export const painKey = (r) => {
  const v = r && r.phuong_an_in;
  return v == null || v === '' ? '0' : String(Number(v) || 0);
};

export const hopChipPain = (row, v) => !v || painKey(row) === v;

export const nhanChipPain = (v) => (PAIN_TABS.find((t) => t.v === v) || {}).label || '';

// Đếm số hàng cho từng chip (giống `demChip` của khuChuyen) → số nhỏ trên mỗi chip.
export const demChipPain = (rows) => {
  const m = {};
  (rows || []).forEach((r) => { const k = painKey(r); m[k] = (m[k] || 0) + 1; });
  m[''] = (rows || []).length;
  return m;
};

export default function PhuongAnInBadge({ value, className }) {
  if (value == null || value === '') return <span className={`text-ink-soft ${className || ''}`}>—</span>;
  // 0 = chưa xác định → tone xám, để không lẫn với phương án in thật (xanh).
  const tone = Number(value) === 0 ? 'default' : 'info';
  return <Badge tone={tone} className={className}>{PHUONG_AN_IN[Number(value)] || value}</Badge>;
}
