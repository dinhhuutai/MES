import client from './axiosClient';

// Hệ thống > Hiển thị theo phương án in (mig 067): mỗi trang có dòng chảy phần in là 1 dòng,
// bật/tắt 4 nhóm Máy / Bàn / Robot / Khác.
export const listHienThiPain = () => client.get('/hien-thi-pain');
export const saveHienThiPain = (items) => client.put('/hien-thi-pain', { items });

// Nhãn 4 nhóm — khớp `TRANG_PAIN` / `dieuKienPain` ở backend.
export const NHOM_PAIN = [
  { key: 'may', label: 'Máy' },
  { key: 'ban', label: 'Bàn' },
  { key: 'robot', label: 'Robot' },
  { key: 'khac', label: 'Khác' },
];
