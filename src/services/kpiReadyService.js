import client from './axiosClient';

// Dashboard > KPI READY (mig 093).
// `params`: { donHangIds, timKiem, khach, maHang, codePhan, mauVai, loaiNgay, ngayTu, ngayDen }
export const getKpiReady = (params) => client.get('/kpi-ready', { params });

// Danh mục 23 cột KPI + owner + ĐÍCH GÁN (id trạm/checklist) — dùng ở *Hệ thống → Owner
// checkpoint/checklist* để bày đủ cột mà gán owner. Nhẹ (không chạy câu KPI), nhận cả WORKFLOW_VIEW.
export const getKpiCot = () => client.get('/kpi-ready/cot');

// Hệ thống > Chọn đơn hàng (KPI) — quyền KPI_DON_HANG_MANAGE.
export const listDonHangKpi = (params) => client.get('/kpi-ready/cau-hinh/don-hang', { params });
export const saveDonHangKpi = (ids) => client.put('/kpi-ready/cau-hinh/don-hang', { ids });
