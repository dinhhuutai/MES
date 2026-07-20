import client from './axiosClient';

// Nhập tay: khách → đơn → mã hàng → phần in → đợt vải.
export const searchKhach = (q) => client.get('/nhap-tay/khach-hang', { params: { q } });
export const searchDon = (khachId, q) => client.get('/nhap-tay/don-hang', { params: { khachId, q } });
export const searchMaHang = (donId, q) => client.get('/nhap-tay/ma-hang', { params: { donId, q } });
export const searchPhanIn = (maHangId, q) => client.get('/nhap-tay/phan-in', { params: { maHangId, q } });
export const listLoaiDotVai = () => client.get('/nhap-tay/loai-dot-vai');
export const createManualChain = (payload) => client.post('/nhap-tay', payload);

// Cập nhật SL nhận vải / SL release.
export const searchVaiVe = (q) => client.get('/nhap-tay/vai-ve', { params: { q } });
export const updateVaiVe = (id, soLuong) => client.patch(`/nhap-tay/vai-ve/${id}`, { so_luong_vai_ve: soLuong });
export const updateRelease = (lenhId, dotId, soLuong) =>
  client.patch('/nhap-tay/release', { lenh_san_xuat_id: lenhId, dot_vai_ve_id: dotId, so_luong: soLuong });
