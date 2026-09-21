import client from './axiosClient';

export const syncPhieuNhanVai = (fromDate) => client.post('/erp/sync/phieu-nhan-vai', fromDate ? { fromDate } : {});
export const syncHistory = (params) => client.get('/erp/sync/history', { params });
export const syncRaw = (id) => client.get(`/erp/sync/${id}/raw`);

// Cập nhật lại dữ liệu theo code phần + ngày (21/09/2026). ⚠ Proc ERP chạy LÂU khi lùi nhiều ngày
// (backend chờ tới 10 phút) ⇒ đè timeout 45s mặc định của axiosClient, không thì FE báo lỗi giả.
const LAU = { timeout: 11 * 60 * 1000 };
export const xemTruocCodePhan = (codeParts, ngay) =>
  client.post('/erp/sync/cap-nhat-code-phan/xem-truoc', { codeParts, ngay }, LAU);
export const capNhatCodePhan = (token, chon) =>
  client.post('/erp/sync/cap-nhat-code-phan', { token, chon }, LAU);
