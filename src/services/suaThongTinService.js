import client from './axiosClient';

// READY trả về Giao nhận sửa thông tin (mig 105) — backend `/api/sua-thong-tin`.
export const danhMucTraVeGn = () => client.get('/sua-thong-tin/danh-muc');
// body: { phanInId, thongTin: [mã], khac, nguon: 'KT' | 'QC' }
export const traVeGn = (body) => client.post('/sua-thong-tin/tra-ve', body);
// params: { search, trangThai: 'CHO' | 'DA' | '', tuNgay, denNgay }
export const listSuaThongTin = (params) => client.get('/sua-thong-tin', { params });
export const chiTietSuaThongTin = (phanInId) => client.get(`/sua-thong-tin/${phanInId}`);
export const suaPhanInGn = (id, patch) => client.patch(`/sua-thong-tin/phan-in/${id}`, patch);
export const suaDotVaiGn = (id, patch) => client.patch(`/sua-thong-tin/dot-vai/${id}`, patch);
// Kéo thông tin đã sửa từ ERP (/ds-phan-in-sua-thong-tin) — job 5 phút tự chạy; nút bấm tay chỉ GN.
export const erpTrangThaiGn = () => client.get('/sua-thong-tin/erp/trang-thai');
export const erpDongBoGn = () => client.post('/sua-thong-tin/erp/dong-bo');
export const xacNhanLaiGn = (phanInId, body) => client.post(`/sua-thong-tin/${phanInId}/xac-nhan`, body);
// Xác nhận lại NHIỀU phần in cùng lúc (tích checkbox đầu bảng). body: { phanInIds: [], ghiChu }
export const xacNhanLaiNhieuGn = (body) => client.post('/sua-thong-tin/xac-nhan', body);
