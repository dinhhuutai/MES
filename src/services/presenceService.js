import client from './axiosClient';

export const getOnline = () => client.get('/presence/online');
export const getHistory = (params = {}) => client.get('/presence/history', { params });
export const getActivity = (params = {}) => client.get('/presence/activity', { params });
