import client from './axiosClient';

// Lý do nghẽn (mig 106) — backend `/api/ly-do-nghen`.
// `maTrang` rỗng = mọi màn (Dashboard). Trả `{ items, co_bang }`, mới nhất trước.
export const listLyDoNghen = (params) => client.get('/ly-do-nghen', { params });
// body: { maTrang, lyDo, hanhDong: 'XAC_NHAN'|'GHI_TAY', items: [{ phan_in_id, dot_vai_ve_id, lenh_san_xuat_id, tem_id, ma, tg_bat_dau_nghen, so_phut_nghen, sla_phut }] }
export const ghiLyDoNghen = (body) => client.post('/ly-do-nghen', body);
