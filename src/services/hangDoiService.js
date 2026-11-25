import client from './axiosClient';

// Hàng đợi tích tem (19/11/2026, BE `modules/hangdoi`) — KCS · Phân loại lỗi · Nhận sửa · Sửa.
// Bảng Tích tem lưu quá `HANG_DOI_SAU_MS` mà còn tem ⇒ đẩy PHẦN CÒN LẠI vào đây, máy chủ chạy từng tem.
export const HANG_DOI_SAU_MS = 5000;
export const LOAI_HANG_DOI = {
  KCS: 'Xác nhận KCS', PHAN_LOAI_LOI: 'Phân loại lỗi', NHAN_SUA: 'Nhận sửa', SUA: 'Xác nhận sửa',
};
// items = [{ temId, body }] — body = đúng body của API lưu lẻ của màn.
export const xepHangDoi = (loai, items, nguon = 'TICH_TEM') => client.post('/hang-doi', { loai, items, nguon });
export const dsHangDoi = (params) => client.get('/hang-doi', { params });
export const boHangDoi = (id, lyDo) => client.post(`/hang-doi/${id}/bo`, { lyDo });
// 25/11/2026 — quét tem ở màn `loai` mà tem còn chờ BƯỚC TRƯỚC trong hàng đợi ⇒ { row (số dự kiến, `qua_hang_doi`) } | { loi } |
//   { row: null } (không có bước trước đang chờ).
export const duKienHangDoi = (loai, ma) => client.get('/hang-doi/du-kien', { params: { loai, ma } });
