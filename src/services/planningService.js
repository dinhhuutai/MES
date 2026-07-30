import client from './axiosClient';

export const listChuyen = () => client.get('/catalog/chuyen');

// Cài đặt ca theo tuần
export const listCaTuan = () => client.get('/planning/ca-tuan');
export const saveCaTuan = (body) => client.post('/planning/ca-tuan', body);

// Kế hoạch tự động
export const autoPlanCandidates = (params) => client.get('/planning/auto-plan/candidates', { params });

// Release 1
export const listRelease1Candidates = (params) => client.get('/planning/release1/candidates', { params });
export const createRelease1 = (body) => client.post('/planning/release1', body);
// Trả đợt vải ở Release 1 ngược về Kỹ thuật (mở lại READY).
export const release1TraVeKyThuat = (body) => client.post('/planning/release1/tra-ve-ky-thuat', body);
// Tạo đợt sản xuất (gộp/tách nhiều đợt vải + SL từng đợt) — màn "Tạo đợt sản xuất"
export const createDotSanXuat = (body) => client.post('/planning/dot-san-xuat', body);
export const release1History = (date) => client.get('/planning/release1/history', { params: { date } });
// Danh sách release theo ngày kế hoạch (modal/report + Excel/In)
export const getReleaseList = (date) => client.get('/planning/release-list', { params: { date } });
export const release1Done = (date) => client.get('/planning/release1/done', { params: { date } });
export const listReleaseSets = (params) => client.get('/planning/release1/sets', { params });
export const releaseSet = (setId, body) => client.post(`/planning/release1/set/${setId}`, body);

// Gộp số lượng đợt vải
export const listGopCandidates = (params) => client.get('/planning/gop/candidates', { params });
export const gopDotVai = (body) => client.post('/planning/gop', body);
export const gopHistory = (date) => client.get('/planning/gop/history', { params: { date } });

// Test Run
export const listTestRunCandidates = (params) => client.get('/planning/test-run/candidates', { params });
export const getLenhDetail = (id) => client.get(`/planning/lenh/${id}`);
export const recordTestRun = (id, body) => client.post(`/planning/test-run/${id}/run`, body);
export const confirmCNSP = (id) => client.post(`/planning/test-run/${id}/confirm-cnsp`);
export const confirmQA = (id, payload = {}) => client.post(`/planning/test-run/${id}/confirm-qa`, payload);
export const cancelCNSP = (id) => client.post(`/planning/test-run/${id}/cancel-cnsp`);
export const cancelQA = (id) => client.post(`/planning/test-run/${id}/cancel-qa`);
// Test Run QC trả về Release 1 (hủy lệnh + lý do)
// Test không đạt → trả về KỸ THUẬT (READY) theo mục rớt: body {checklists:['KHUON'|'FILM'|'MUC'], lyDo}.
// Lệnh GIỮ NGUYÊN → QC xác nhận READY xong là tự quay lại Test Run (không qua Release 1).
export const returnTestRunToReady = (id, body) => client.post(`/planning/test-run/${id}/tra-ve-ky-thuat`, body);
export const skipTestRun = (id) => client.post(`/planning/test-run/${id}/skip`);
export const confirmCNSPBatch = (lenhIds) => client.post('/planning/test-run/cnsp-confirm-batch', { lenhIds });
export const confirmQABatch = (lenhIds, payload = {}) => client.post('/planning/test-run/qa-confirm-batch', { lenhIds, ...payload });
export const testRunHistory = (date) => client.get('/planning/test-run/history', { params: { date } });
export const testCnspDone = (date) => client.get('/planning/test-run/cnsp-done', { params: { date } });
export const testQaDone = (date) => client.get('/planning/test-run/qa-done', { params: { date } });

// Release 2
export const listRelease2Candidates = (params) => client.get('/planning/release2/candidates', { params });
export const approveRelease2 = (id) => client.post(`/planning/release2/${id}`);
export const approveRelease2Batch = (lenhIds) => client.post('/planning/release2/batch', { lenhIds });

// Lập kế hoạch lại + lịch sử kế hoạch (Release 2 + lập lại)
export const listReplanCandidates = (params) => client.get('/planning/replan/candidates', { params });
export const replan = (id, body) => client.post(`/planning/replan/${id}`, body);
export const replanBatch = (body) => client.post('/planning/replan/batch', body);
export const planHistory = (date) => client.get('/planning/plan-history', { params: { date } });

// Gia công: Kế hoạch nhận lại hàng gia công → chuyển OQC
export const listGiaCong = (params) => client.get('/planning/gia-cong', { params });
export const giaCongToOqc = (lenhId) => client.post(`/planning/gia-cong/${lenhId}/chuyen-oqc`);
export const giaCongHistory = (date) => client.get('/planning/gia-cong/history', { params: { date } });

// Kế hoạch tạm (lập kế hoạch sớm cho phần in chưa Ready)
export const listKeHoachTam = (params) => client.get('/planning/ke-hoach-tam', { params });
// Gom set chưa đủ Ready: lưu kế hoạch tạm cho CẢ SET (không tạo lệnh) — release chung khi cả set Ready.
export const keHoachTamSet = (setId, body) => client.post(`/planning/ke-hoach-tam/set/${setId}`, body);
export const confirmKeHoachTam = (id) => client.post(`/planning/ke-hoach-tam/${id}/xac-nhan`);
export const updateKeHoachTam = (id, body) => client.patch(`/planning/ke-hoach-tam/${id}`, body);
export const deleteKeHoachTam = (id) => client.delete(`/planning/ke-hoach-tam/${id}`);
// Lịch sử thao tác (lập/sửa/xóa/xác nhận) + Đã hoàn thành (đã xác nhận Release 1) — theo ngày.
export const keHoachTamHistory = (date) => client.get('/planning/ke-hoach-tam/history', { params: { date } });
export const keHoachTamDone = (date) => client.get('/planning/ke-hoach-tam/done', { params: { date } });

// Hủy lệnh / hoàn tác release
export const listCancelableLenh = (params) => client.get('/planning/huy-lenh/candidates', { params });
export const cancelLenh = (lenhId, body) => client.post(`/planning/huy-lenh/${lenhId}`, body);
export const release2Done = (date) => client.get('/planning/release2/done', { params: { date } });
export const replanDone = (date) => client.get('/planning/replan/done', { params: { date } });
