import client from './axiosClient';

// PHIÊN ĐĂNG NHẬP THEO THIẾT BỊ (mig 081) — Hệ thống → Phiên đăng nhập.
// `tatCa=1` để xem cả phiên đã đăng xuất (mặc định chỉ phiên đang hoạt động).
export const listPhien = (params) => client.get('/phien', { params });

// Đăng xuất 1 thiết bị.
export const dangXuatPhien = (id, lyDo) => client.post(`/phien/${id}/dang-xuat`, { lyDo });

// Đăng xuất MỌI thiết bị của 1 tài khoản (chặn được cả token cũ chưa có mã phiên).
export const dangXuatMoiThietBi = (userId, lyDo) =>
  client.post(`/phien/nguoi-dung/${userId}/dang-xuat-tat-ca`, { lyDo });
