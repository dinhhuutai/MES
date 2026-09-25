import client from './axiosClient';

// PHÒNG BAN & TỔ (mig 104) — chỉ sửa TÊN + ghi chú; mã phòng/tổ nạp bằng script
// `database/scripts/gan_phong_ban_to_nhan_vien.sql`. `co_bang_to = false` ⇒ chưa chạy mig 104.
export const listPhongBan = () => client.get('/phong-ban');
export const updatePhongBan = (id, data) => client.patch(`/phong-ban/${id}`, data);
export const updateToPhongBan = (id, data) => client.patch(`/phong-ban/to/${id}`, data);
