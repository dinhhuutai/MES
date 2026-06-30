import client from './axiosClient';

export const getReadyConfig = () => client.get('/ready/config');
export const listReadyCandidates = (params) => client.get('/ready/candidates', { params });
export const listReadyQcCandidates = (params) => client.get('/ready/qc-candidates', { params });
export const getReadyDetail = (id) => client.get(`/ready/${id}`);
// Xác nhận 1 mục kỹ thuật: ma ∈ KHUON|FILM|MUC|HSKT; value cho KHUON/FILM/MUC.
export const confirmReadyItem = (id, ma, value) =>
  client.post(`/ready/${id}/confirm/${ma}`, { value });
// Xác nhận nhiều mục cùng lúc: items = [{ ma, value }].
export const confirmReadyItemsBatch = (id, items) =>
  client.post(`/ready/${id}/confirm-batch`, { items });
// Bulk 1 mục cho nhiều phần in (theo mã hàng): { phanInIds, ma, value }.
export const confirmReadyBulk = (payload) => client.post('/ready/confirm-bulk', payload);
export const confirmReadyQC = (id) => client.post(`/ready/${id}/confirm-qc`);
// QC xác nhận hàng loạt nhiều phần in.
export const confirmReadyQcBatch = (phanInIds) =>
  client.post('/ready/qc-confirm-batch', { phanInIds });
// Lịch sử theo ngày. scope: 'tech' | 'qc'.
export const readyHistory = (date, scope) => client.get('/ready/history', { params: { date, scope } });
