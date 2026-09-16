import client from './axiosClient';

// Dashboard › Thời gian trạm (15/09/2026).
// `params`: { tuNgay, denNgay, loaiMoc: VAO|RA, trangThai: DA_ROI|DANG_O, tram (mã, ngăn phẩy),
//             timKiem, khach, don, maHang, codePhan, mauVai, chuyen }
export const getThoiGianTram = (params) => client.get('/thoi-gian-tram', { params });
