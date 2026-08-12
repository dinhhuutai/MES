import client from './axiosClient';

// Xác nhận chạy + in tem
export const listProductionCandidates = (params) => client.get('/production/candidates', { params });
export const startProduction = (lenhId, chuyenId) => client.post(`/production/${lenhId}/start`, { chuyenId });
export const listChuyen = () => client.get('/catalog/chuyen');
export const getRun = (lenhId) => client.get(`/production/run/${lenhId}`);
// `meta` (mig 066) = { ngayCa, gioBd, gioKt, btpTruoc, btpCuoi } — ngày ca / giờ SX từ→đến / cờ BTP
// của LƯỢT IN, lưu vào từng tem (không in lên nhãn).
export const printTem = (phieuId, soLuong, meta) =>
  client.post(`/production/phieu/${phieuId}/tem`, { soLuong, ...(meta || {}) });
// In tem NHIỀU phần in 1 lượt (lệnh gom set): items = [{ dotVaiId, soLuong, soLuongHuy, soLuongThieu }]
export const printTemBatch = (phieuId, items, meta) =>
  client.post(`/production/phieu/${phieuId}/tem-batch`, { items, ...(meta || {}) });
export const reprintTem = (temId, lyDo) => client.post(`/production/tem/${temId}/in-lai`, { lyDo });
// dotVaiId (tùy chọn) → nhãn lấy đúng phần in của đợt vải đó (in tem lệnh gom set)
export const getTemLabel = (temId, dotVaiId) =>
  client.get(`/production/tem/${temId}/label`, { params: dotVaiId ? { dotVaiId } : undefined });
export const getTemLogs = (phieuId) => client.get(`/production/phieu/${phieuId}/tem-logs`);
export const finishRun = (phieuId) => client.post(`/production/phieu/${phieuId}/finish`);
// `gioBd`/`gioKt` dạng 'HH:MM' (tùy chọn) — giờ ngừng / hoạt động lại nhập tay; bỏ trống = giờ hệ thống.
// `lyDoId` = lý do chọn từ danh mục (mig 076); `lyDo` = ghi chú thêm / lý do gõ tay.
export const stopLine = (phieuId, lyDo, gioBd, lyDoId) => client.post(`/production/phieu/${phieuId}/ngung`, { lyDo, gioBd, lyDoId });

// Danh mục LÝ DO NGỪNG CHUYỀN (mig 076)
export const listLyDoNgung = (params) => client.get('/production/ly-do-ngung', { params });
export const createLyDoNgung = (body) => client.post('/production/ly-do-ngung', body);
export const updateLyDoNgung = (id, body) => client.patch(`/production/ly-do-ngung/${id}`, body);
export const toggleLyDoNgung = (id, active) => client.patch(`/production/ly-do-ngung/${id}/active`, { active });

// Danh mục LÝ DO BỔ SUNG (mig 077) + ghi lý do cho 1 đợt vải
export const listLyDoBoSung = (params) => client.get('/production/ly-do-bo-sung', { params });
export const createLyDoBoSung = (body) => client.post('/production/ly-do-bo-sung', body);
export const updateLyDoBoSung = (id, body) => client.patch(`/production/ly-do-bo-sung/${id}`, body);
export const toggleLyDoBoSung = (id, active) => client.patch(`/production/ly-do-bo-sung/${id}/active`, { active });
export const luuLyDoBoSungDotVai = (dotVaiId, body) => client.post(`/production/dot-vai/${dotVaiId}/ly-do-bo-sung`, body);
// Ghi vải hủy (= vải hư) / vải THIẾU trong sản xuất — body.loai: 'HUY' | 'THIEU' (theo đợt vải/phần in)
export const addVaiHuy = (phieuId, body) => client.post(`/production/phieu/${phieuId}/vai-huy`, body);
// Phân công sản xuất: { caTruongId, chuyenTruong, items: [{ dotVaiId, thoIn, soLuongHuy, soLuongThieu }] }
export const savePhanCong = (phieuId, body) => client.post(`/production/phieu/${phieuId}/phan-cong`, body);
export const resumeLine = (phieuId, gioKt) => client.post(`/production/phieu/${phieuId}/hoat-dong-lai`, { gioKt });

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
// Đổi chuyền của lượt chạy (máy hỏng / dồn tải) — đổi CẢ phiếu lẫn lệnh, giữ nguyên tem đã in.
export const doiChuyen = (phieuId, body) => client.post(`/production/phieu/${phieuId}/doi-chuyen`, body);
// Trả về Kỹ thuật từ màn Xác nhận chạy (chờ chạy / đang chạy) → hủy lệnh + phần in quay lại READY.
// ⚠ Theo LỆNH, không phải phiếu — bảng "Chờ chạy" chưa có phiếu SX nào.
export const traVeKyThuatSanXuat = (lenhId, lyDo) =>
  client.post(`/production/lenh/${lenhId}/tra-ve-ky-thuat`, { lyDo });
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
