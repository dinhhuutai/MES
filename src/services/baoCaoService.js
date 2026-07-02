import client from './axiosClient';

// Catalog dữ liệu có sẵn
export const getMetrics = () => client.get('/bao-cao/metrics');

// Báo cáo của tôi / tất cả
export const listMyReports = (params) => client.get('/bao-cao', { params });
export const listAllReports = (params) => client.get('/bao-cao/tat-ca', { params });
export const getReport = (id) => client.get(`/bao-cao/${id}`);
export const createReport = (body) => client.post('/bao-cao', body);
export const updateReport = (id, body) => client.put(`/bao-cao/${id}`, body);
export const undoReport = (id) => client.post(`/bao-cao/${id}/hoan-tac`);
export const deleteReport = (id) => client.delete(`/bao-cao/${id}`);
export const renderReport = (id, body) => client.post(`/bao-cao/${id}/render`, body);
export const reportHistory = (id, date) => client.get(`/bao-cao/${id}/lich-su`, { params: { date } });

// Phòng ban
export const listPhongBanApDung = () => client.get('/bao-cao/phong-ban');
export const getPhongBanHienHanh = (phongBanId, params) => client.get(`/bao-cao/phong-ban/${phongBanId}/hien-hanh`, { params });
export const deXuatApDung = (phongBanId, body) => client.post(`/bao-cao/phong-ban/${phongBanId}/de-xuat`, body);
export const duyetApDung = (id) => client.post(`/bao-cao/phong-ban-ap-dung/${id}/duyet`);
export const tuChoiApDung = (id, lyDo) => client.post(`/bao-cao/phong-ban-ap-dung/${id}/tu-choi`, { lyDo });
