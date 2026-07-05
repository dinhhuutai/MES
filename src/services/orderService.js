import client from './axiosClient';

export const listPhanIn = (params) => client.get('/phan-in', { params });
export const listVaiVe = (params) => client.get('/phan-in/vai-ve', { params });
export const getPhanIn = (id) => client.get(`/phan-in/${id}`);
export const setLoiNhuan = (id, loiNhuan) => client.patch(`/phan-in/${id}/loi-nhuan`, { loiNhuan });
export const setChoKho = (id, phut) => client.patch(`/phan-in/${id}/cho-kho`, { phut });
export const profitHistory = (date) => client.get('/phan-in/profit-history', { params: { date } });
