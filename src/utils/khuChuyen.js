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
