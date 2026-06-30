import client from './axiosClient';

export const syncPhieuNhanVai = (fromDate) => client.post('/erp/sync/phieu-nhan-vai', fromDate ? { fromDate } : {});
export const syncHistory = (limit = 50) => client.get('/erp/sync/history', { params: { limit } });
export const syncRaw = (id) => client.get(`/erp/sync/${id}/raw`);
