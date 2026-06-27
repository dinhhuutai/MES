import client from './axiosClient';

// Module (bảng module) + danh mục dùng chung.
export const listModules = () => client.get('/modules');
export const updateModule = (id, body) => client.patch(`/modules/${id}`, body);
export const setModuleActive = (id, dangHoatDong) =>
  client.patch(`/modules/${id}/active`, { dangHoatDong });

export const listPhongBan = () => client.get('/catalog/phong-ban');
export const listRoleOptions = () => client.get('/catalog/roles');
export const listTrangThai = () => client.get('/catalog/trang-thai');
