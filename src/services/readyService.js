import client from './axiosClient';

export const getReadyConfig = () => client.get('/ready/config');
export const listReadyCandidates = (params) => client.get('/ready/candidates', { params });
export const getReadyDetail = (id) => client.get(`/ready/${id}`);
export const saveReadyDraft = (id, body) => client.post(`/ready/${id}/draft`, body);
export const confirmReadyTech = (id) => client.post(`/ready/${id}/confirm-tech`);
export const confirmReadyQC = (id) => client.post(`/ready/${id}/confirm-qc`);
