import client from './axiosClient';

export const listUsers = (params) => client.get('/users', { params });
// Chọn người cho combobox (owner...) — chỉ cần đăng nhập, KHÔNG đòi quyền USER_VIEW như listUsers.
export const listUserOptions = (params) => client.get('/users/options', { params });
export const getUser = (id) => client.get(`/users/${id}`);
export const createUser = (body) => client.post('/users', body);
export const updateUser = (id, body) => client.patch(`/users/${id}`, body);
export const setUserActive = (id, dangHoatDong) => client.patch(`/users/${id}/active`, { dangHoatDong });
export const setUserRoles = (id, roleIds) => client.patch(`/users/${id}/roles`, { roleIds });
export const resetUserPassword = (id, matKhauMoi) =>
  client.post(`/users/${id}/reset-password`, { matKhauMoi });
