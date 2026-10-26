// Ô LỌC CA (26/10/2026, người dùng: "chọn ngày rồi chọn ca: HC, CA1, CA2, CA3, D1, D2") — dùng chung Danh sách tem
// in + Danh sách release. Mã ô ↔ 2 ký tự cuối mã ngày ca (`261024C2`, `261024D1`, `261024HC`) — gương backend
// `utils/ca.js HAU_TO_CA`.
export const CA_LOC = ['HC', 'CA1', 'CA2', 'CA3', 'D1', 'D2'];
const TU_HAU_TO = { HC: 'HC', TC: 'HC', C1: 'CA1', C2: 'CA2', C3: 'CA3', D1: 'D1', D2: 'D2' };

// Mã ngày ca (hoặc chỉ mã ca) → mã ô lọc; không nhận ra ⇒ ''.
export const caCuaMaNgayCa = (ma) => TU_HAU_TO[String(ma || '').trim().toUpperCase().slice(-2)] || '';
