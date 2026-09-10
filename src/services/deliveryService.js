import client from './axiosClient';

export const listTemSanSang = (params) => client.get('/giao-hang/tem-san-sang', { params });
export const createGiaoHang = (body) => client.post('/giao-hang', body);
export const listGiaoHang = (params) => client.get('/giao-hang', { params });
export const getGiaoHang = (id) => client.get(`/giao-hang/${id}`);
export const confirmGiao = (id) => client.post(`/giao-hang/${id}/confirm`);

// Sidebar Lịch sử / Đã hoàn thành của màn *Danh sách tem giao* (khuôn chung các màn xác nhận).
export const historyGiao = (date) => client.get('/giao-hang/history', { params: { date } });
export const doneGiao = (date) => client.get('/giao-hang/done', { params: { date } });

// Hủy phiếu giao (tab ở *Hệ thống → Hủy lệnh xác nhận*) — đảo sổ cái đã giao, tem quay lại màn Giao.
export const listPhieuGiaoCancelable = (params) => client.get('/giao-hang/huy/cancelable', { params });
export const huyPhieuGiao = (id, lyDo) => client.post(`/giao-hang/${id}/huy`, { lyDo });

// ─── Chốt chặn "bán hàng tích tem" (mig 092) — trang ở module Hệ thống ───────────────────────
// `daTich=1` ⇒ tab "Đã tích" (để bỏ tích khi bấm nhầm). Trả `{ items, co_cot }` — `co_cot=false`
// nghĩa là môi trường CHƯA chạy mig 092, FE hiện banner thay vì bảng trống khó hiểu.
export const listTemChoTich = (params) => client.get('/giao-hang/tich/cho', { params });
export const tichTemGiao = (temIds) => client.post('/giao-hang/tich', { temIds });
export const boTichTemGiao = (temIds) => client.post('/giao-hang/tich/bo', { temIds });
export const traCuuTemTich = (code) => client.get('/giao-hang/tich/tra-cuu', { params: { code } });
