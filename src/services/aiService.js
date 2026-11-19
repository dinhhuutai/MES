import client from './axiosClient';

// Agent MES THLA (19/11/2026, mig 138) — BE `modules/ai`. Câu hỏi có thể chạy nhiều vòng công cụ ⇒ timeout 120 giây.
export const layTrangThaiAi = () => client.get('/ai/trang-thai');
export const hoiAi = (body) => client.post('/ai/hoi', body, { timeout: 120000 });
export const dsHoiThoaiAi = () => client.get('/ai/hoi-thoai');
export const chiTietHoiThoaiAi = (id) => client.get(`/ai/hoi-thoai/${id}`);
export const xoaHoiThoaiAi = (id) => client.delete(`/ai/hoi-thoai/${id}`);
export const danhGiaTinNhanAi = (id, danhGia) => client.post(`/ai/tin-nhan/${id}/danh-gia`, { danh_gia: danhGia });
// Mẫu robot của chính người dùng: VANG_NANG | VANG_KEM (Thông tin cá nhân).
export const datMauRobotAi = (mau) => client.put('/ai/mau-robot', { mau_robot: mau });
// Sự kiện trình duyệt khi người dùng đổi mẫu robot (`ChonMauRobot` phát, `AgentLoader` nghe). Để ở đây (file nhỏ,
// đã nằm trong bundle chính) ⇒ AgentLoader không kéo code robot vào bundle chính.
export const SU_KIEN_DOI_MAU_ROBOT = 'agent-mes:mau-robot';

// Chỗ hiện robot của chính người dùng (Thông tin cá nhân) — gương BE `modules/ai/ai.service.js CHE_DO_HIEN`.
export const CHE_DO_HIEN = [
  { ma: 'MOI_TRANG', ten: 'Mọi trang', mo_ta: 'Robot ở trang chủ, các màn khác thu gọn ở góc.' },
  { ma: 'TRANG_CHU', ten: 'Chỉ trang chủ', mo_ta: 'Chỉ hiện khi ở trang chủ, màn khác ẩn hẳn.' },
  { ma: 'AN', ten: 'Ẩn', mo_ta: 'Ẩn robot ở mọi trang. Bật lại ở đây.' },
];
export const HIEN_MAC_DINH = 'MOI_TRANG';
export const datCheDoHienAi = (hien) => client.put('/ai/che-do-hien', { hien });
export const SU_KIEN_DOI_CHE_DO_HIEN = 'agent-mes:che-do-hien';
