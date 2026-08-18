import api from './axiosClient';

// THÔNG BÁO (chuông cạnh avatar) — mig 085. Backend: `/api/thong-bao`.

// Chuông: chỉ lấy CON SỐ (gọi thường xuyên, đừng kéo cả danh sách về rồi đếm).
export const laySoChuaDoc = () => api.get('/thong-bao/so-chua-doc');

// `chuaDoc=true` để chỉ lấy chưa đọc; `timKiem` quét code phần/khách/đơn/mã hàng/màu/lý do/người trả về.
export const layThongBao = (params = {}) => api.get('/thong-bao', { params });

// `ids` rỗng/không truyền = ĐÁNH DẤU ĐỌC HẾT.
export const danhDauDoc = (ids) => api.post('/thong-bao/doc', { ids: ids || [] });

// Cấu hình CỦA CHÍNH MÌNH (trang Thông tin cá nhân).
export const layCaiDatCuaToi = () => api.get('/thong-bao/cua-toi');
export const luuCaiDatCuaToi = (maLoai, bat) => api.put('/thong-bao/cua-toi', { ma_loai: maLoai, bat });

// Cấu hình MỨC HỆ THỐNG (trang Hệ thống > Cài đặt thông báo) — cần WORKFLOW_VIEW/MANAGE.
export const layCaiDatHeThong = () => api.get('/thong-bao/he-thong');
export const luuCaiDatHeThong = (items) => api.put('/thong-bao/he-thong', { items });

// Web Push (nhận cả khi đóng app).
export const layKhoaPush = () => api.get('/thong-bao/push/khoa');
export const dangKyPush = (sub) => api.post('/thong-bao/push/dang-ky', sub);
export const huyPush = (endpoint) => api.post('/thong-bao/push/huy', { endpoint });
