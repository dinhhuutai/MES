import client from './axiosClient';

export const listPhanIn = (params) => client.get('/phan-in', { params });
export const listVaiVe = (params) => client.get('/phan-in/vai-ve', { params });
export const getPhanIn = (id) => client.get(`/phan-in/${id}`);
export const setLoiNhuan = (id, loiNhuan) => client.patch(`/phan-in/${id}/loi-nhuan`, { loiNhuan });
export const setChoKho = (id, phut) => client.patch(`/phan-in/${id}/cho-kho`, { phut });
export const profitHistory = (date) => client.get('/phan-in/profit-history', { params: { date } });
// Hủy phần in (xóa mềm): tìm kiếm theo code phần rồi hủy nhiều phần in cùng lúc.
export const searchPhanInForCancel = (q, stage) => client.get('/phan-in/huy/search', { params: { q, stage } });
export const huyPhanIn = (phanInIds, lyDo) => client.post('/phan-in/huy', { phanInIds, lyDo });
export const listDeletedPhanIn = (q) => client.get('/phan-in/mo/deleted', { params: { q } });
export const moPhanIn = (phanInIds) => client.post('/phan-in/mo', { phanInIds });

// Hủy / Mở ĐỢT VẢI (mức đợt — ERP đẩy lên đợt sai thì bỏ đúng đợt đó, giữ nguyên phần in).
// `huyDotVai`/`moDotVai` trả `{count, items, loi[]}` — `loi[]` = đợt bị chặn kèm lý do.
export const searchDotVaiForCancel = (q, stage) => client.get('/phan-in/dot-vai/huy/search', { params: { q, stage } });
export const huyDotVai = (dotVaiIds, lyDo) => client.post('/phan-in/dot-vai/huy', { dotVaiIds, lyDo });
export const listDeletedDotVai = (q) => client.get('/phan-in/dot-vai/mo/deleted', { params: { q } });
export const moDotVai = (dotVaiIds) => client.post('/phan-in/dot-vai/mo', { dotVaiIds });
