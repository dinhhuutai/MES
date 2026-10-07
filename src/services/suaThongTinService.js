import client from './axiosClient';

// READY trả về Giao nhận sửa thông tin (mig 105) — backend `/api/sua-thong-tin`.
export const danhMucTraVeGn = () => client.get('/sua-thong-tin/danh-muc');
// body: { phanInId, thongTin: [mã], khac, nguon: 'KT' | 'QC' | 'RELEASE1' | 'TEST_RUN' | 'RELEASE2' | 'CHO_CHAY' }
// ⇒ backend hủy đợt READY bên ERP ngay (chạy ngầm, 07/10/2026).
export const traVeGn = (body) => client.post('/sua-thong-tin/tra-ve', body);
// params: { search, trangThai: 'CHO' | 'DA' | '', tuNgay, denNgay }
export const listSuaThongTin = (params) => client.get('/sua-thong-tin', { params });
export const chiTietSuaThongTin = (phanInId) => client.get(`/sua-thong-tin/${phanInId}`);
export const suaPhanInGn = (id, patch) => client.patch(`/sua-thong-tin/phan-in/${id}`, patch);
export const suaDotVaiGn = (id, patch) => client.patch(`/sua-thong-tin/dot-vai/${id}`, patch);
// ⚠ 07/10/2026 BỎ "Lấy từ ERP" · "Hủy vải" · "Xác nhận lại" hàng loạt — phần in tự quay về khi ERP gửi lại đợt.
// Dự phòng khi lệnh hủy CHƯA tới được ERP: gửi (lại) lệnh hủy / xác nhận lại tay (ERP đã nhận ⇒ 409 CHO_ERP).
export const guiHuyErpGn = (phanInId) => client.post(`/sua-thong-tin/${phanInId}/gui-huy-erp`);
export const xacNhanLaiGn = (phanInId, body) => client.post(`/sua-thong-tin/${phanInId}/xac-nhan`, body);
