import client from './axiosClient';

export const apiLogin = (tenDangNhap, matKhau) =>
  client.post('/auth/login', { tenDangNhap, matKhau });

export const apiFetchMe = () => client.get('/auth/me');

export const apiUpdateProfile = (payload) => client.patch('/auth/me', payload);

export const apiUploadAvatar = (file) => {
  const fd = new FormData();
  fd.append('avatar', file);
  return client.post('/auth/me/avatar', fd); // axios tự set multipart boundary
};

export const apiResetAvatar = () => client.delete('/auth/me/avatar');

export const apiLogout = () => client.post('/auth/logout');
