import client from './axiosClient';

export const listChuyen = (params) => client.get('/chuyen', { params });
export const createChuyen = (body) => client.post('/chuyen', body);
export const updateChuyen = (id, body) => client.patch(`/chuyen/${id}`, body);
export const setChuyenActive = (id, dangHoatDong) => client.patch(`/chuyen/${id}/active`, { dangHoatDong });
export const listLoaiChuyen = () => client.get('/chuyen/loai');
export const createLoaiChuyen = (body) => client.post('/chuyen/loai', body);
