import client from './axiosClient';

// Dashboard › Thời gian trạm (15/09/2026).
// `params`: { tuNgay, denNgay, loaiMoc: VAO|RA, trangThai: DA_ROI|DANG_O, tram (mã, ngăn phẩy),
//             timKiem, khach, don, maHang, codePhan, mauVai, chuyen }
export const getThoiGianTram = (params) => client.get('/thoi-gian-tram', { params });

// Checklist sổ xuống của 1 trạm (bấm mũi tên ở dòng trạm). CÙNG bộ lọc với `getThoiGianTram` —
// cùng tập đơn vị, cùng mốc VÀO, chỉ đổi mốc RA sang lúc xác nhận checklist đó.
// ⚠ Tải LƯỜI: mỗi checklist là một lượt query nặng ngang dòng trạm cha.
export const getThoiGianTramChecklist = (maTram, params) =>
  client.get(`/thoi-gian-tram/checklist/${maTram}`, { params });
