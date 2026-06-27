import client from './axiosClient';

export const listKcsCandidates = (params) => client.get('/quality/kcs/candidates', { params });
export const recordKcs = (temId, body) => client.post(`/quality/kcs/${temId}`, body);

export const listSuaCandidates = (params) => client.get('/quality/sua/candidates', { params });
export const recordSua = (temId, body) => client.post(`/quality/sua/${temId}`, body);

export const listOqcCandidates = (params) => client.get('/quality/oqc/candidates', { params });
export const recordOqc = (temId, body) => client.post(`/quality/oqc/${temId}`, body);
