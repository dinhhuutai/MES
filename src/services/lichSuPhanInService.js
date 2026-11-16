import client from './axiosClient';

// Lịch sử phần in (16/11/2026) — BE `modules/lichsuphanin`. Chỉ đọc.
export const timPhanInLichSu = (q) => client.get('/lich-su-phan-in/tim', { params: { q } });
export const getLichSuPhanIn = (phanInId) => client.get(`/lich-su-phan-in/${phanInId}`);
