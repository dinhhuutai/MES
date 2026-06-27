import client from './axiosClient';

export const apiLogin = (tenDangNhap, matKhau) =>
  client.post('/auth/login', { tenDangNhap, matKhau });

export const apiFetchMe = () => client.get('/auth/me');

export const apiLogout = () => client.post('/auth/logout');
