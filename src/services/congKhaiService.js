import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// API CÔNG KHAI — KHÔNG ĐĂNG NHẬP (26/11/2026, trang `/san-luong`). Axios RIÊNG: không gắn token, không có luật "401 ⇒ đăng
//   xuất" của `axiosClient` (trang này mở trên màn TV / máy không đăng nhập). Cùng envelope {success, message, data}.
//   Backend `modules/congkhai/congkhai.routes.js` — chỉ đọc, chỉ trả trường màn đang hiện.
// ─────────────────────────────────────────────────────────────────────────────

const congKhai = axios.create({
  baseURL: `${process.env.REACT_APP_BASE_URL || 'http://localhost:5000'}/api/cong-khai`,
  timeout: 45000,
});
congKhai.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { success: false, message: err.message, errorCode: 'NETWORK_ERROR' }),
);

// Chuyền đang chạy — cùng hình dạng `getMonitor` ({ running, queue }) nhưng đã lọc trường.
export const getSanLuongChuyen = () => congKhai.get('/san-luong/chuyen');
// Tổng nhà máy · Theo tổ — cùng hình dạng `getTheoDoiTo`.
export const getSanLuongTo = (ngay) => congKhai.get('/san-luong/to', { params: { ngay } });
