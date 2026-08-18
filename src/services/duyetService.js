import client from './axiosClient';

// HÀNG ĐỢI DUYỆT (mig 086) — xem `backend/src/utils/duyet.js`.
// `params`: { loai, trangThai, timKiem, page, limit }
export const layHangDoiDuyet = (params) => client.get('/duyet', { params });

// Số yêu cầu đang chờ CHÍNH MÌNH duyệt → badge trên menu (0 nếu không có quyền duyệt).
export const demChoDuyet = () => client.get('/duyet/dem-cho-duyet');

// Gửi yêu cầu đổi phương án in.
// ⚠ Người CÓ quyền duyệt → backend áp dụng NGAY và trả `da_ap_dung = true`;
//   người khác → tạo yêu cầu chờ duyệt, `da_ap_dung = false`. FE phải phân biệt 2 ca này khi báo.
export const guiYeuCauDoiPain = ({ hsktId, phuongAnIn, lyDo }) =>
  client.post('/duyet/doi-phuong-an-in', { hsktId, phuongAnIn, lyDo });

export const duyetYeuCau = (id, ghiChu) => client.post(`/duyet/${id}/duyet`, { ghiChu });
export const tuChoiYeuCau = (id, lyDo) => client.post(`/duyet/${id}/tu-choi`, { lyDo });
export const huyYeuCau = (id) => client.post(`/duyet/${id}/huy`);
