import client from './axiosClient';

// Hệ thống > Thiết kế tem (mig 073). Người dùng tự dựng bố cục tem trên lưới kiểu Excel rồi GẮN
// mẫu vào nút in mong muốn — thay vì phải nhờ sửa `printTemLabel.js`.
//
// ⚠ Danh mục VỊ TRÍ IN + TRƯỜNG DỮ LIỆU lấy TỪ BACKEND (`/mau-tem/danh-muc`), KHÔNG chép cứng sang
//   FE: nguồn thật là `backend/src/utils/mauTem.js`, chép sang đây là sớm muộn 2 bên lệch nhau.
export const layDanhMucMauTem = () => client.get('/mau-tem/danh-muc');

export const listMauTem = () => client.get('/mau-tem');
export const getMauTem = (id) => client.get(`/mau-tem/${id}`);
export const taoMauTem = (body) => client.post('/mau-tem', body);
export const nhanBanMauTem = (id, body) => client.post(`/mau-tem/${id}/nhan-ban`, body);
export const suaMauTem = (id, body) => client.put(`/mau-tem/${id}`, body);
export const xoaMauTem = (id) => client.delete(`/mau-tem/${id}`);

// Gắn mẫu vào 1 vị trí in; `mauTemId` rỗng = GỠ gắn (nút in lùi về bố cục mặc định trong code).
export const ganMauTem = (maViTri, mauTemId) => client.put(`/mau-tem/gan/${maViTri}`, { mau_tem_id: mauTemId || null });

// Mẫu đang dùng cho 1 vị trí in — gọi NGAY TRƯỚC KHI IN.
// Ai đăng nhập cũng gọi được (thợ in không có quyền TEM_DESIGN nhưng vẫn phải in được).
export const mauChoViTri = (maViTri) => client.get(`/mau-tem/vi-tri/${maViTri}`);
