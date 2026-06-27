import client from './axiosClient';

// Versions
export const listVersions = () => client.get('/wf/versions');
export const createVersion = (b) => client.post('/wf/versions', b);
export const updateVersion = (id, b) => client.patch(`/wf/versions/${id}`, b);
export const setHienHanh = (id) => client.post(`/wf/versions/${id}/hien-hanh`);

// Trams
export const listTrams = (versionId) => client.get('/wf/trams', { params: { versionId } });
export const tramOptions = (versionId) => client.get('/wf/tram-options', { params: { versionId } });
export const createTram = (b) => client.post('/wf/trams', b);
export const updateTram = (id, b) => client.patch(`/wf/trams/${id}`, b);
export const setTramActive = (id, dangHoatDong) => client.patch(`/wf/trams/${id}/active`, { dangHoatDong });

// Checkpoints
export const listCheckpoints = (tramId) => client.get('/wf/checkpoints', { params: { tramId } });
export const createCheckpoint = (b) => client.post('/wf/checkpoints', b);
export const updateCheckpoint = (id, b) => client.patch(`/wf/checkpoints/${id}`, b);
export const setCheckpointActive = (id, dangHoatDong) => client.patch(`/wf/checkpoints/${id}/active`, { dangHoatDong });

// Rules
export const listRules = (versionId) => client.get('/wf/rules', { params: { versionId } });
export const createRule = (b) => client.post('/wf/rules', b);
export const updateRule = (id, b) => client.patch(`/wf/rules/${id}`, b);
export const setRuleActive = (id, dangHoatDong) => client.patch(`/wf/rules/${id}/active`, { dangHoatDong });

// Conditions
export const listConditions = (ruleId) => client.get('/wf/conditions', { params: { ruleId } });
export const createCondition = (b) => client.post('/wf/conditions', b);
export const deleteCondition = (id) => client.delete(`/wf/conditions/${id}`);

// Owners
export const listTramOwners = (tramId) => client.get('/wf/tram-owners', { params: { tramId } });
export const addTramOwner = (b) => client.post('/wf/tram-owners', b);
export const removeTramOwner = (id) => client.delete(`/wf/tram-owners/${id}`);
export const listCheckpointOwners = (checkpointId) => client.get('/wf/checkpoint-owners', { params: { checkpointId } });
export const addCheckpointOwner = (b) => client.post('/wf/checkpoint-owners', b);
export const removeCheckpointOwner = (id) => client.delete(`/wf/checkpoint-owners/${id}`);

// Statuses
export const listStatuses = (params) => client.get('/wf/statuses', { params });
export const createStatus = (b) => client.post('/wf/statuses', b);
export const updateStatus = (id, b) => client.patch(`/wf/statuses/${id}`, b);
export const setStatusActive = (id, dangHoatDong) => client.patch(`/wf/statuses/${id}/active`, { dangHoatDong });

// Catalog
export const listLoaiCheckpoint = () => client.get('/catalog/loai-checkpoint');
