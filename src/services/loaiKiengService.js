import client from './axiosClient';

// Hệ thống › Danh mục kiếng (mig 126) — chọn loại kiếng khi in tem in kiếng.
// `list({ ca: true })` gồm cả loại đã ngưng dùng (trang quản trị); không tham số = chỉ loại đang dùng.
export const listLoaiKieng = (opts = {}) => client.get('/loai-kieng', { params: opts.ca ? { ca: 1 } : {} });
export const addLoaiKieng = (item) => client.post('/loai-kieng', item);
export const saveLoaiKieng = (id, item) => client.put(`/loai-kieng/${id}`, item);
