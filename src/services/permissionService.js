import client from './axiosClient';

export const listPermissions = (params) => client.get('/permissions', { params });
export const createPermission = (body) => client.post('/permissions', body);
export const updatePermission = (id, body) => client.patch(`/permissions/${id}`, body);
export const setPermissionActive = (id, dangHoatDong) =>
  client.patch(`/permissions/${id}/active`, { dangHoatDong });
