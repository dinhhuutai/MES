import client from './axiosClient';

// Hệ thống > Cài đặt API (mig 083): bật/tắt từng API ERP ngay trên giao diện.
// `list` trả `{ items: [{ ma, ten, mo_ta, canh_bao, url, bat, theo_mac_dinh, mac_dinh,
//                          ghi_chu, nguoi_sua, tg_sua }] }`.
//   · `theo_mac_dinh = true` ⇒ chưa ai đụng tới, đang chạy theo giá trị trong `.env` của máy chủ.
export const listCaiDatApi = () => client.get('/cai-dat-api');
export const saveCaiDatApi = (items) => client.put('/cai-dat-api', { items });

// Thử kết nối — CHỈ ping máy chủ ERP, KHÔNG gọi endpoint nghiệp vụ (gọi thật sẽ tiêu mã tem /
// ghi bản ghi rác / chạy proc nặng). Trả `{ ok, url, goc, http, ms, thong_diep }`.
export const thuKetNoiApi = (ma) => client.post(`/cai-dat-api/thu/${ma}`);
