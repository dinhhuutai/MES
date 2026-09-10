import client from './axiosClient';

// THIẾT KẾ PHIẾU (mig 094) — quyền `PHIEU_DESIGN`.
// ⚠ `mauChoViTriPhieu` là ĐƯỜNG IN THẬT nên route backend KHÔNG gác `PHIEU_DESIGN` (tổ giao hàng
//   phải in được mà không cần quyền thiết kế).
export const danhMucPhieu = () => client.get('/mau-phieu/danh-muc');
export const listMauPhieu = () => client.get('/mau-phieu');
export const getMauPhieu = (id) => client.get(`/mau-phieu/${id}`);
export const taoMauPhieu = (body) => client.post('/mau-phieu', body);
export const suaMauPhieu = (id, body) => client.put(`/mau-phieu/${id}`, body);
export const nhanBanMauPhieu = (id, body) => client.post(`/mau-phieu/${id}/nhan-ban`, body);
export const xoaMauPhieu = (id) => client.delete(`/mau-phieu/${id}`);
export const ganMauPhieu = (maViTri, mauPhieuId) =>
  client.put(`/mau-phieu/gan/${maViTri}`, { mau_phieu_id: mauPhieuId || null });
export const mauChoViTriPhieu = (maViTri) => client.get(`/mau-phieu/vi-tri/${maViTri}`);
