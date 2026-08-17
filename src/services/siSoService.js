import client from './axiosClient';

// SĨ SỐ CHECKPOINT (Tồn đầu · Nhận · Làm được · Tồn cuối) — xem `backend/src/utils/siSoTram.js`.
export const layDanhMucSiSo = () => client.get('/si-so/danh-muc');

// `params`: { tu, den, timKiem, khach, don, maHang, codePhan, mauVai, kichVai, kichPhim,
//             chuyen, nhaGiaCong, loaiNgay, ngayTu, ngayDen }
export const laySiSo = (maTrang, params) => client.get(`/si-so/${maTrang}`, { params });

// `o`: ton_dau | nhan | lam_duoc | ton_cuoi. `limit: 0` = lấy HẾT (dùng cho xuất Excel).
export const laySiSoChiTiet = (maTrang, o, params) => client.get(`/si-so/${maTrang}/${o}`, { params });
