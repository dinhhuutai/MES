import client from './axiosClient';

export const listTemSanSang = (params) => client.get('/giao-hang/tem-san-sang', { params });
export const createGiaoHang = (body) => client.post('/giao-hang', body);
export const listGiaoHang = (params) => client.get('/giao-hang', { params });
export const getGiaoHang = (id) => client.get(`/giao-hang/${id}`);
export const confirmGiao = (id) => client.post(`/giao-hang/${id}/confirm`);
