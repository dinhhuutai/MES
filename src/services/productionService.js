import client from './axiosClient';

// Xác nhận chạy + in tem
export const listProductionCandidates = (params) => client.get('/production/candidates', { params });
export const startProduction = (lenhId, chuyenId) => client.post(`/production/${lenhId}/start`, { chuyenId });
export const listChuyen = () => client.get('/catalog/chuyen');
export const getRun = (lenhId) => client.get(`/production/run/${lenhId}`);
export const printTem = (phieuId, soLuong) => client.post(`/production/phieu/${phieuId}/tem`, { soLuong });
export const reprintTem = (temId, lyDo) => client.post(`/production/tem/${temId}/in-lai`, { lyDo });
export const getTemLabel = (temId) => client.get(`/production/tem/${temId}/label`);
export const getTemLogs = (phieuId) => client.get(`/production/phieu/${phieuId}/tem-logs`);
export const finishRun = (phieuId) => client.post(`/production/phieu/${phieuId}/finish`);
export const stopLine = (phieuId, lyDo) => client.post(`/production/phieu/${phieuId}/ngung`, { lyDo });
// Ghi vải hủy trong sản xuất (theo đợt vải / phần in của lệnh)
export const addVaiHuy = (phieuId, body) => client.post(`/production/phieu/${phieuId}/vai-huy`, body);
export const resumeLine = (phieuId) => client.post(`/production/phieu/${phieuId}/hoat-dong-lai`);

// Theo dõi chuyền
export const getMonitor = () => client.get('/production/monitor');

// Xe phơi
export const getXePhoi = () => client.get('/production/xe-phoi');
export const listTemChoPhoi = (params) => client.get('/production/tem-cho-phoi', { params });
export const addTemToXe = (body) => client.post('/production/xe-phoi/them-tem', body);
export const adjustPhoi = (temXeId, phut) => client.patch(`/production/tem-xe-phoi/${temXeId}`, { phut });

// Hủy lệnh in tem (tem chưa kiểm) — trang Hủy lệnh xác nhận
export const listCancelableTem = (params) => client.get('/production/huy-tem/candidates', { params });
export const cancelPrintTem = (temId, lyDo) => client.post(`/production/huy-tem/${temId}`, { lyDo });

// Đóng lệnh sản xuất (= Chạy hoàn tất) — trang Hủy lệnh xác nhận
export const listCloseCandidates = () => client.get('/production/dong-lenh/candidates');
export const closeProduction = (phieuId, lyDo) => client.post(`/production/dong-lenh/${phieuId}`, { lyDo });

// Mở lại lệnh sản xuất (đã đóng/hoàn tất trong 2 ngày) — trang Đóng lệnh sản xuất
export const listReopenCandidates = () => client.get('/production/mo-lai/candidates');
export const reopenProduction = (phieuId) => client.post(`/production/mo-lai/${phieuId}`);

// Ngừng lệnh chạy (ngừng phần in để in hàng gấp) → lệnh về chờ chạy — màn Xác nhận chạy
export const pauseLenhChay = (phieuId) => client.post(`/production/phieu/${phieuId}/ngung-lenh`);
// Vượt sản xuất: cộng SL vượt vào release + trừ đợt vải chưa release cùng phần in
export const vuotSanXuat = (phieuId, soLuong) => client.post(`/production/phieu/${phieuId}/vuot-san-xuat`, { soLuong });

// Hủy lệnh đang chạy (bấm nhầm Xác nhận chạy) → về chờ chạy — trang Hủy lệnh xác nhận
export const listUndoStartCandidates = () => client.get('/production/huy-chay/candidates');
export const undoStartProduction = (phieuId) => client.post(`/production/huy-chay/${phieuId}`);

// Chạy đặc biệt (bỏ Test Run) — cùng danh sách Test Run, chạy thẳng đợt còn RELEASE_1
export const listChayDacBietCandidates = (params) => client.get('/production/chay-dac-biet/candidates', { params });
export const chayDacBiet = (lenhId, body) => client.post(`/production/chay-dac-biet/${lenhId}`, body);

// Chờ khô
export const listDrying = (params) => client.get('/production/drying', { params });
export const confirmDry = (temId) => client.post(`/production/drying/${temId}/confirm`);
// Phơi lại 1 tem (từ KCS)
export const redryTem = (temId, phut) => client.post(`/production/tem/${temId}/phoi-lai`, { phut });
