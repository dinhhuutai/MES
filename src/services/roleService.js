import client from './axiosClient';

export const listRoles = (params) => client.get('/roles', { params });
export const getRole = (id) => client.get(`/roles/${id}`);
export const getRoleUsers = (id) => client.get(`/roles/${id}/users`);
export const createRole = (body) => client.post('/roles', body);
export const updateRole = (id, body) => client.patch(`/roles/${id}`, body);
export const setRoleActive = (id, dangHoatDong) => client.patch(`/roles/${id}/active`, { dangHoatDong });
export const setRolePermissions = (id, permissionIds) =>
  client.patch(`/roles/${id}/permissions`, { permissionIds });
