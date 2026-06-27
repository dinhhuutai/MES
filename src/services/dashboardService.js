import client from './axiosClient';

export const getSummary = () => client.get('/dashboard/summary');
export const getActivity = () => client.get('/dashboard/activity');
export const listReports = () => client.get('/dashboard/reports');
export const getReport = (ma) => client.get(`/dashboard/reports/${ma}`);
