import client from './axiosClient';

// Xác nhận chạy + in tem
export const listProductionCandidates = (params) => client.get('/production/candidates', { params });
export const startProduction = (lenhId) => client.post(`/production/${lenhId}/start`);
export const getRun = (lenhId) => client.get(`/production/run/${lenhId}`);
export const printTem = (phieuId, soLuong) => client.post(`/production/phieu/${phieuId}/tem`, { soLuong });
export const finishRun = (phieuId) => client.post(`/production/phieu/${phieuId}/finish`);
export const stopLine = (phieuId, lyDo) => client.post(`/production/phieu/${phieuId}/ngung`, { lyDo });
export const resumeLine = (phieuId) => client.post(`/production/phieu/${phieuId}/hoat-dong-lai`);

// Theo dõi chuyền
export const getMonitor = () => client.get('/production/monitor');

// Xe phơi
export const getXePhoi = () => client.get('/production/xe-phoi');
export const listTemChoPhoi = (params) => client.get('/production/tem-cho-phoi', { params });
export const addTemToXe = (body) => client.post('/production/xe-phoi/them-tem', body);
export const adjustPhoi = (temXeId, phut) => client.patch(`/production/tem-xe-phoi/${temXeId}`, { phut });

// Chờ khô
export const listDrying = (params) => client.get('/production/drying', { params });
export const confirmDry = (temId) => client.post(`/production/drying/${temId}/confirm`);
