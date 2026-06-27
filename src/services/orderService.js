import client from './axiosClient';

export const listPhanIn = (params) => client.get('/phan-in', { params });
export const getPhanIn = (id) => client.get(`/phan-in/${id}`);
export const setLoiNhuan = (id, loiNhuan) => client.patch(`/phan-in/${id}/loi-nhuan`, { loiNhuan });
