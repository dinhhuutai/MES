import client from './axiosClient';

export const getReadyConfig = () => client.get('/ready/config');
export const listReadyCandidates = (params) => client.get('/ready/candidates', { params });
export const listReadyQcCandidates = (params) => client.get('/ready/qc-candidates', { params });
// Đếm số phần in CHƯA xác nhận từng mục (KHUON/FILM/MUC) toàn hệ thống → { khuon, film, muc }.
export const getReadyItemCounts = () => client.get('/ready/item-counts');
// Tra cứu mã vừa quét khi KHÔNG khớp dòng nào ở READY/QC READY → { tim_thay, ma_phan, ly_do, mo_ta }.
// Chỉ để hiện LÝ DO cho người quét (đã QC xong / đã release / đã hủy) — không dùng cho nghiệp vụ.
export const traCuuMaQuet = (code) => client.get('/ready/tra-cuu', { params: { code } });
// `dotVaiIds` (tùy chọn, mig 098): thao tác/xem theo 1 DÒNG LOẠI ĐỢT VẢI của phần in chờ ≥2 loại.
export const getReadyDetail = (id, dotVaiIds) => client.get(`/ready/${id}`,
  { params: dotVaiIds && dotVaiIds.length ? { dotVaiIds: dotVaiIds.join(',') } : {} });
// Xác nhận 1 mục kỹ thuật: ma ∈ KHUON|FILM|MUC|HSKT; value cho KHUON/FILM/MUC.
export const confirmReadyItem = (id, ma, value, dotVaiIds) =>
  client.post(`/ready/${id}/confirm/${ma}`, { value, dotVaiIds });
// Xác nhận nhiều mục cùng lúc: items = [{ ma, value }].
export const confirmReadyItemsBatch = (id, items, dotVaiIds) =>
  client.post(`/ready/${id}/confirm-batch`, { items, dotVaiIds });
// Bulk 1 mục cho nhiều phần in (theo mã hàng): { phanInIds, ma, value }.
export const confirmReadyBulk = (payload) => client.post('/ready/confirm-bulk', payload);
export const confirmReadyQC = (id) => client.post(`/ready/${id}/confirm-qc`);
// QC trả về Ready kỹ thuật: { checklists: ['FILM',...], lyDo }.
export const returnReadyToTech = (id, body) => client.post(`/ready/${id}/tra-ve`, body);
// Hủy xác nhận 1 mục (Admin/READY_CANCEL): ma ∈ KHUON|FILM|MUC|HSKT|QC_XAC_NHAN.
export const cancelReadyItem = (id, ma) => client.post(`/ready/${id}/huy`, { ma });
// Bỏ tích 1 mục kỹ thuật ngay trong luồng Quét/tích (quyền tech, khi tích lộn): ma ∈ KHUON|FILM|MUC.
export const uncheckReadyItem = (id, ma, dotVaiIds) => client.post(`/ready/${id}/uncheck/${ma}`, { dotVaiIds });
// Lịch sử trạng thái (xác nhận READY đang hiệu lực) theo ngày — cho trang Hệ thống.
export const listConfirmHistory = (params) => client.get('/ready/lich-su-xac-nhan', { params });

// "Mở READY" (admin): phần in đi tắt READY (đợt mới tự vào Release 1) → ép quay lại READY.
export const listReopenReadyCandidates = (params) => client.get('/ready/reopen/candidates', { params });
export const reopenReady = (phanInId) => client.post(`/ready/reopen/${phanInId}`);
// QC xác nhận hàng loạt nhiều phần in.
export const confirmReadyQcBatch = (phanInIds) =>
  client.post('/ready/qc-confirm-batch', { phanInIds });
// Lịch sử theo ngày. scope: 'tech' | 'qc'.
export const readyHistory = (date, scope) => client.get('/ready/history', { params: { date, scope } });
// Danh sách phần in đã hoàn thành checkpoint READY theo ngày. scope: 'tech' | 'qc'.
export const readyDone = (date, scope) => client.get('/ready/done', { params: { date, scope } });
