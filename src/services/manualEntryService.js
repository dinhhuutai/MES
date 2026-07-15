import client from './axiosClient';

// Nhập tay: khách → đơn → mã hàng → phần in → đợt vải.
export const searchKhach = (q) => client.get('/nhap-tay/khach-hang', { params: { q } });
export const searchDon = (khachId, q) => client.get('/nhap-tay/don-hang', { params: { khachId, q } });
export const searchMaHang = (donId, q) => client.get('/nhap-tay/ma-hang', { params: { donId, q } });
export const listLoaiDotVai = () => client.get('/nhap-tay/loai-dot-vai');
export const createManualChain = (payload) => client.post('/nhap-tay', payload);
