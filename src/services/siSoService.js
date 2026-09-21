import client from './axiosClient';

// SĨ SỐ CHECKPOINT (Tồn đầu · Nhận · Làm được · Tồn cuối) — xem `backend/src/utils/siSoTram.js`.
export const layDanhMucSiSo = () => client.get('/si-so/danh-muc');

// `params`: { tu, den, timKiem, khach, don, maHang, codePhan, mauVai, kichVai, kichPhim,
//             chuyen, nhaGiaCong, loaiNgay, ngayTu, ngayDen }
export const laySiSo = (maTrang, params) => client.get(`/si-so/${maTrang}`, { params });

// BẢNG THEO DÕI 10 CHECKPOINT (Dashboard → Tổng quan). `params`: { tu, den }.
// ⚠ Backend cache 30s (10 query nặng, ~2,5s lượt chạy thật) — đừng gọi trong vòng lặp render.
export const layBangTheoDoi = (params) => client.get('/si-so/bang-theo-doi', { params });

// `o`: ton_dau | nhan | lam_duoc | ton_cuoi. `limit: 0` = lấy HẾT (dùng cho xuất Excel).
export const laySiSoChiTiet = (maTrang, o, params) => client.get(`/si-so/${maTrang}/${o}`, { params });

// Tách con số của 1 ô theo NGÀY GIAO (popover khi rê chuột vào ô). Cùng bộ lọc với `laySiSo` nên
// Σ các dòng trả về LUÔN bằng đúng con số đang hiện trên ô.
export const laySiSoNgayGiao = (maTrang, o, params) =>
  client.get(`/si-so/${maTrang}/${o}/ngay-giao`, { params });
