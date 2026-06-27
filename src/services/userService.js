import client from './axiosClient';

export const listUsers = (params) => client.get('/users', { params });
export const getUser = (id) => client.get(`/users/${id}`);
export const createUser = (body) => client.post('/users', body);
export const updateUser = (id, body) => client.patch(`/users/${id}`, body);
export const setUserActive = (id, dangHoatDong) => client.patch(`/users/${id}/active`, { dangHoatDong });
export const setUserRoles = (id, roleIds) => client.patch(`/users/${id}/roles`, { roleIds });
export const resetUserPassword = (id, matKhauMoi) =>
  client.post(`/users/${id}/reset-password`, { matKhauMoi });
