import client from './axiosClient';

// KHÁCH HÀNG (mig 099) — chỉ sửa được 3 trường MES tự quản: địa chỉ, địa chỉ giao mặc định, ghi chú.
// ⚠ Mã + tên khách do ERP đẩy sang (`erpsync.upsertKhachHang`) nên KHÔNG có API sửa — sửa cũng bị
//   lần đồng bộ sau ghi đè.
// ⚠ `meta.co_cot = false` ⇒ môi trường CHƯA chạy mig 099: trang hiện banner nhắc thay vì cột trống.
export const listKhachHang = (params) => client.get('/khach-hang', { params });
export const updateKhachHang = (id, data) => client.patch(`/khach-hang/${id}`, data);
