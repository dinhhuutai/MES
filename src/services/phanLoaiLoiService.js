import client from './axiosClient';

// PHÂN LOẠI LỖI (mig 075) — trang trong module Sản xuất, nằm dưới KCS.
// Endpoint nằm trong prefix `/quality` vì code dùng chung sổ cái tem + danh mục lỗi của module này.
export const listPhanLoaiLoi = (params) => client.get('/quality/phan-loai-loi', { params });
export const traTemPhanLoai = (code) => client.get('/quality/phan-loai-loi/tra-tem', { params: { code } });
export const getPhanLoaiLoi = (temId) => client.get(`/quality/phan-loai-loi/${temId}`);
export const luuPhanLoaiLoi = (temId, body) => client.post(`/quality/phan-loai-loi/${temId}`, body);

// Danh mục biện pháp xử lý
export const listBienPhap = (params) => client.get('/quality/bien-phap', { params });
export const createBienPhap = (body) => client.post('/quality/bien-phap', body);
export const updateBienPhap = (id, body) => client.patch(`/quality/bien-phap/${id}`, body);
export const toggleBienPhap = (id, active) => client.patch(`/quality/bien-phap/${id}/active`, { active });
