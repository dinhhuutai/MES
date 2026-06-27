import client from './axiosClient';

export const listChuyen = () => client.get('/catalog/chuyen');

// Release 1
export const listRelease1Candidates = (params) => client.get('/planning/release1/candidates', { params });
export const createRelease1 = (body) => client.post('/planning/release1', body);

// Test Run
export const listTestRunCandidates = (params) => client.get('/planning/test-run/candidates', { params });
export const getLenhDetail = (id) => client.get(`/planning/lenh/${id}`);
export const recordTestRun = (id, body) => client.post(`/planning/test-run/${id}/run`, body);
export const confirmCNSP = (id) => client.post(`/planning/test-run/${id}/confirm-cnsp`);
export const confirmQA = (id) => client.post(`/planning/test-run/${id}/confirm-qa`);

// Release 2
export const listRelease2Candidates = (params) => client.get('/planning/release2/candidates', { params });
export const approveRelease2 = (id) => client.post(`/planning/release2/${id}`);
