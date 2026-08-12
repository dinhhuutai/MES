import client from './axiosClient';

// QUẢN TRỊ PHẦN IN (mig 078, quyền `PHAN_IN_ADMIN`) — xem/sửa mọi thứ của 1 phần in.
const P = '/quan-tri-phan-in';

export const traCuuPhanIn = (q) => client.get(`${P}/tra-cuu`, { params: { q } });
export const getQuanTriPhanIn = (phanInId) => client.get(`${P}/${phanInId}`);
export const suaPhanIn = (phanInId, patch) => client.patch(`${P}/${phanInId}`, patch);
export const suaDotVai = (dotVaiId, patch) => client.patch(`${P}/dot-vai/${dotVaiId}`, patch);
export const datGiaiDoan = (dotVaiId, body) => client.post(`${P}/dot-vai/${dotVaiId}/dat-giai-doan`, body);
export const huyDotVaiQt = (dotVaiIds, lyDo) => client.post(`${P}/dot-vai/huy`, { dotVaiIds, lyDo });
export const moDotVaiQt = (dotVaiIds) => client.post(`${P}/dot-vai/mo`, { dotVaiIds });
export const huyMucReady = (phanInId, muc) => client.post(`${P}/${phanInId}/huy-muc-ready`, { muc });
