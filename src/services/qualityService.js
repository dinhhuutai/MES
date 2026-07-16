import client from './axiosClient';

export const listKcsCandidates = (params) => client.get('/quality/kcs/candidates', { params });
export const recordKcs = (temId, body) => client.post(`/quality/kcs/${temId}`, body);
export const gopTem = (body) => client.post('/quality/kcs/gop-tem', body);
export const getTemHanhTrinh = (temId) => client.get(`/quality/tem/${temId}/hanh-trinh`);
export const kcsHistory = (date) => client.get('/quality/kcs/history', { params: { date } });
export const kcsDone = (date) => client.get('/quality/kcs/done', { params: { date } });

export const listSuaCandidates = (params) => client.get('/quality/sua/candidates', { params });
export const recordSua = (temId, body) => client.post(`/quality/sua/${temId}`, body);
export const suaHistory = (date) => client.get('/quality/sua/history', { params: { date } });
export const suaDone = (date) => client.get('/quality/sua/done', { params: { date } });

export const listOqcCandidates = (params) => client.get('/quality/oqc/candidates', { params });
export const recordOqc = (temId, body) => client.post(`/quality/oqc/${temId}`, body);
export const returnOqcToKcs = (temId, body) => client.post(`/quality/oqc/${temId}/tra-ve`, body);
export const oqcHistory = (date) => client.get('/quality/oqc/history', { params: { date } });
export const oqcDone = (date) => client.get('/quality/oqc/done', { params: { date } });

// Hủy xác nhận KCS / Sửa / OQC (lỡ xác nhận lộn / nhập sai số) — trang Hủy lệnh xác nhận
export const listCancelKcs = (date) => client.get('/quality/kcs/cancelable', { params: { date } });
export const cancelKcs = (id, lyDo) => client.post(`/quality/kcs/${id}/huy`, { lyDo });
export const listCancelSua = (date) => client.get('/quality/sua/cancelable', { params: { date } });
export const cancelSua = (id, lyDo) => client.post(`/quality/sua/${id}/huy`, { lyDo });
export const listCancelOqc = (date) => client.get('/quality/oqc/cancelable', { params: { date } });
export const cancelOqc = (id, lyDo) => client.post(`/quality/oqc/${id}/huy`, { lyDo });

// Lịch sử QC trả về (toggle READY/TEST_RUN/OQC)
export const qcTraVeHistory = (loai, date) => client.get('/quality/qc-tra-ve', { params: { loai, date } });

// QC in-line (kiểm tại chuyền)
export const listInlineCandidates = (params) => client.get('/quality/inline/candidates', { params });
export const listInlineLoaiLoi = () => client.get('/quality/inline/loai-loi');
export const recordInline = (phieuId, body) => client.post(`/quality/inline/${phieuId}`, body);
export const inlineHistory = (date) => client.get('/quality/inline/history', { params: { date } });
export const inlineDone = (date) => client.get('/quality/inline/done', { params: { date } });

// Danh mục lỗi
export const listLoaiLoi = (params) => client.get('/quality/loai-loi', { params });
export const createLoaiLoi = (body) => client.post('/quality/loai-loi', body);
export const updateLoaiLoi = (id, body) => client.patch(`/quality/loai-loi/${id}`, body);
export const toggleLoaiLoi = (id, active) => client.patch(`/quality/loai-loi/${id}/active`, { active });

// Danh mục trường hợp giao đặc biệt (OQC)
export const listGiaoDacBietActive = () => client.get('/quality/giao-dac-biet');
export const listGiaoDacBiet = (params) => client.get('/quality/giao-dac-biet/all', { params });
export const createGiaoDacBiet = (body) => client.post('/quality/giao-dac-biet', body);
export const updateGiaoDacBiet = (id, body) => client.patch(`/quality/giao-dac-biet/${id}`, body);
export const toggleGiaoDacBiet = (id, active) => client.patch(`/quality/giao-dac-biet/${id}/active`, { active });
