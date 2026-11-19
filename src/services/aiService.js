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
