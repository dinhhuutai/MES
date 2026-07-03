import client from './axiosClient';

// Gom set (gom đợt vải để in chung) — module Chuẩn bị kỹ thuật.
export const listGomCandidates = (params) => client.get('/gom-set/candidates', { params });
export const listSets = (params) => client.get('/gom-set', { params });
export const getSet = (id) => client.get(`/gom-set/${id}`);
export const createSet = (body) => client.post('/gom-set', body);
export const addToSet = (id, dotVaiIds) => client.post(`/gom-set/${id}/them`, { dotVaiIds });
export const removeFromSet = (id, dotVaiId) => client.delete(`/gom-set/${id}/dot-vai/${dotVaiId}`);
export const cancelSet = (id) => client.post(`/gom-set/${id}/huy`);
export const gomHistory = (date) => client.get('/gom-set/history', { params: { date } });
export const gomDone = (date) => client.get('/gom-set/done', { params: { date } });
