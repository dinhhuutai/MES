// KHU CHUYỀN BÀN — chia nhỏ loại chuyền `BAN` theo bố trí thật của xưởng (chốt 2026-08-03).
// Dùng chung cho toggle lọc ở "Theo dõi chuyền" (Sản xuất) và "Test Run - QA" (Kế hoạch)
// ⇒ sửa 1 chỗ, 2 màn cùng đổi.
//
// Khớp theo `ma_chuyen` (mã chuyền trong `chuyen_san_xuat`), KHÔNG khớp theo tên hiển thị vì tên
// có thể đổi. Chuyền Bàn không nằm trong khu nào (vd dữ liệu cũ M1A/M1B/C03 đã ngừng hoạt động)
// vẫn thuộc chip "Bàn" tổng nhưng không lọt khu nào — cố ý, để không bịa nhóm.
export const KHU_BAN = [
  { key: 'BAN_A', label: 'Bàn khu A', ma: ['M4A-4B', 'M5A-5B', 'M6A-6B', 'M7A-7B', 'M8A-8B', 'M9A-9B'] },
  { key: 'BAN_B', label: 'Bàn khu B', ma: ['M10A', 'M11A', 'M12A', 'M13A', 'M14A', 'M10B', 'M11B', 'M12B', 'M13B', 'M14B'] },
  { key: 'MAU', label: 'Mẫu', ma: ['M3A-3B'] },
  { key: 'CANH_HANG', label: 'Canh hàng', ma: ['M1A-1B'] },
  { key: 'BO_SUNG_MTD', label: 'Bổ sung MTĐ', ma: ['M2A-2B'] },
];

// Tra nhanh: ma_chuyen → key khu.
const MA_TO_KHU = {};
KHU_BAN.forEach((k) => k.ma.forEach((m) => { MA_TO_KHU[m.toUpperCase()] = k.key; }));

export const khuCuaChuyen = (maChuyen) => MA_TO_KHU[String(maChuyen || '').trim().toUpperCase()] || null;

// Hàng có thuộc chip khu đang chọn không (khớp theo ma_chuyen của hàng).
export const thuocKhu = (maChuyen, khuKey) => !!khuKey && khuCuaChuyen(maChuyen) === khuKey;

// ─── DẢI CHIP LỌC THEO LOẠI CHUYỀN + KHU BÀN ────────────────────────────────
// Dùng chung 3 màn: "Theo dõi chuyền" · "Test Run - QA" · "Xác nhận chạy" (2 bảng Đang/Chờ chạy).
// ⚠ Trước đây mỗi màn tự khai 1 bản giống hệt nhau; khi thêm màn thứ 3 thì gom về đây — sửa 1 chỗ,
// mọi màn cùng đổi. Giữ chip "Bàn" TỔNG để vẫn xem được toàn bộ Bàn; 5 chip khu nằm ngay sau nó.
export const LOAI_TABS = [
  { v: '', label: 'Tất cả' },
  { v: 'BAN', label: 'Bàn' },
  ...KHU_BAN.map((k) => ({ v: `KHU:${k.key}`, label: k.label, khu: k.key })),
  { v: 'MAY', label: 'Máy' },
  { v: 'ROBOT', label: 'Robot' },
  { v: 'EP', label: 'Ép' },
  { v: 'LOGO', label: 'Logo' },
  { v: 'GIA_CONG', label: 'Gia công' },
];

// 1 hàng có khớp chip đang chọn không: chip khu lọc theo `ma_chuyen`, còn lại theo `ma_loai_chuyen`.
export const hopChipChuyen = (row, v) => {
  if (!v) return true;
  if (v.startsWith('KHU:')) return thuocKhu(row.ma_chuyen, v.slice(4));
  return row.ma_loai_chuyen === v;
};

// Chip đang chọn → bộ lọc gửi cho dải "Theo dõi" (sĩ số). Cùng luật với `hopChipChuyen` ở trên,
// chỉ khác là diễn đạt cho SQL thay vì cho 1 hàng đã tải sẵn:
//   chip khu  → `maChuyen`   = danh sách mã chuyền của khu (backend khớp NGUYÊN TOKEN)
//   chip loại → `loaiChuyen` = mã loại (`MAY` · `BAN` · `ROBOT` …)
// ⚠ TUYỆT ĐỐI KHÔNG gửi chip khu dưới dạng `loaiChuyen='KHU:BAN_A'` — backend không hiểu tiền tố
//   đó, sẽ khớp rỗng và dải số ra 0 trong khi bảng vẫn đầy hàng.
export const locSiSoTheoChip = (v) => {
  if (!v) return {};
  if (v.startsWith('KHU:')) {
    const khu = KHU_BAN.find((k) => k.key === v.slice(4));
    return khu ? { maChuyen: khu.ma.join(',') } : {};
  }
  return { loaiChuyen: v };
};

// Nhãn chip (cho phụ đề Excel / câu "không có hàng nào thuộc loại …").
export const nhanChip = (v) => (LOAI_TABS.find((t) => t.v === v) || {}).label || '';

// Đếm số hàng cho từng chip (kể cả chip khu) → hiện số nhỏ trên mỗi chip.
export const demChip = (rows) => {
  const m = {};
  (rows || []).forEach((x) => {
    if (x.ma_loai_chuyen) m[x.ma_loai_chuyen] = (m[x.ma_loai_chuyen] || 0) + 1;
    const k = khuCuaChuyen(x.ma_chuyen);
    if (k) m[`KHU:${k}`] = (m[`KHU:${k}`] || 0) + 1;
  });
  m[''] = (rows || []).length;
  return m;
};
