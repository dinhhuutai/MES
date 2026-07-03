import client from './axiosClient';

export const listKcsCandidates = (params) => client.get('/quality/kcs/candidates', { params });
export const recordKcs = (temId, body) => client.post(`/quality/kcs/${temId}`, body);
export const kcsHistory = (date) => client.get('/quality/kcs/history', { params: { date } });
export const kcsDone = (date) => client.get('/quality/kcs/done', { params: { date } });

export const listSuaCandidates = (params) => client.get('/quality/sua/candidates', { params });
export const recordSua = (temId, body) => client.post(`/quality/sua/${temId}`, body);
export const suaHistory = (date) => client.get('/quality/sua/history', { params: { date } });
export const suaDone = (date) => client.get('/quality/sua/done', { params: { date } });

export const listOqcCandidates = (params) => client.get('/quality/oqc/candidates', { params });
export const recordOqc = (temId, body) => client.post(`/quality/oqc/${temId}`, body);
export const oqcHistory = (date) => client.get('/quality/oqc/history', { params: { date } });
export const oqcDone = (date) => client.get('/quality/oqc/done', { params: { date } });

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
