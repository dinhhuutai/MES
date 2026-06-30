import client from './axiosClient';

export const listCongNo = (params) => client.get('/tai-chinh/don-hang', { params });
export const getCongNo = (id) => client.get(`/tai-chinh/don-hang/${id}`);
export const saveCongNo = (id, payload) => client.post(`/tai-chinh/don-hang/${id}/cong-no`, payload);
export const confirmCongNo = (id) => client.post(`/tai-chinh/don-hang/${id}/xac-nhan`);
export const congNoHistory = (date) => client.get('/tai-chinh/history', { params: { date } });
