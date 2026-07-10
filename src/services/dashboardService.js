import client from './axiosClient';

export const getSummary = () => client.get('/dashboard/summary');
export const getActivity = () => client.get('/dashboard/activity');
export const getStageCounts = () => client.get('/dashboard/stage-counts');
export const getChartDetail = () => client.get('/dashboard/chart-detail');
export const getBang2 = () => client.get('/dashboard/bang-2');
export const getNghenMap = () => client.get('/dashboard/nghen-map');
export const getHoanThanhHomNay = () => client.get('/dashboard/hoan-thanh-hom-nay');

// Kiosk: tình trạng đơn hàng theo trạm
export const getTinhTrangSummary = () => client.get('/dashboard/tinh-trang/summary');
export const listTinhTrangPhanIn = (params) => client.get('/dashboard/tinh-trang/phan-in', { params });
export const getTinhTrangPhanIn = (id) => client.get(`/dashboard/tinh-trang/phan-in/${id}`);

// Dòng chảy + SLA (theo dõi chủ động)
export const getFlow = (params) => client.get('/dashboard/flow', { params });
export const getFlowTimeline = (dotVaiId) => client.get(`/dashboard/flow/${dotVaiId}`);
export const getSlaOverview = () => client.get('/dashboard/sla-tong-quan');
export const getFlowOwners = () => client.get('/dashboard/owners');
export const listReports = () => client.get('/dashboard/reports');
export const getReport = (ma) => client.get(`/dashboard/reports/${ma}`);
