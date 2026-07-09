import client from './axiosClient';

export const syncPhieuNhanVai = (fromDate) => client.post('/erp/sync/phieu-nhan-vai', fromDate ? { fromDate } : {});
export const syncHistory = (params) => client.get('/erp/sync/history', { params });
export const syncRaw = (id) => client.get(`/erp/sync/${id}/raw`);
