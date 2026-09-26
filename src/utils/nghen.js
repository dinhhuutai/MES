import { evalSla } from './sla';

// ─────────────────────────────────────────────────────────────────────────────
// Luật chung "nghẽn bao lâu" + khớp LÝ DO NGHẼN (mig 106) — dùng cho NghenListModal, hộp hỏi lý do
// khi xác nhận (`hooks/useLyDoNghen`) và bảng theo dõi ở Dashboard. Thuần JS.
// ─────────────────────────────────────────────────────────────────────────────

// Vị từ SLA của họ màn mang `tg_vao` + `sla_phut` (READY · QC READY · KCS · Sửa · OQC · Giao) — gương
// đúng biểu thức các màn đó dùng tô đỏ hàng. Khai ở mức module ⇒ tham chiếu ỔN ĐỊNH.
export const trangThaiSla = (r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, Date.now()).status;

// Số đo thời gian của 1 hàng: ưu tiên `thoiGian(r)` do màn truyền (họ `useNghenMap` — `{phut, sla}`),
// không có thì tự tính từ `tg_vao` + `sla_phut` (họ `evalSla`). Trả null nếu không đủ dữ kiện.
export function doNghen(r, thoiGian, now = Date.now()) {
  let phut = null; let sla = null;
  const t = thoiGian ? thoiGian(r) : null;
  if (t && t.phut != null) { phut = Number(t.phut); sla = Number(t.sla) || 0; }
  else if (r && r.tg_vao) {
    phut = Math.floor((now - new Date(r.tg_vao).getTime()) / 60000);
    sla = Number(r.sla_phut) || 0;
  }
  if (phut == null || !Number.isFinite(phut)) return null;
  const qua = sla > 0 ? phut - sla : null;
  // Thời điểm BẮT ĐẦU nghẽn = mốc vào + SLA = bây giờ − (phút đã ở − SLA).
  const batDau = qua != null ? new Date(now - qua * 60000) : null;
  return { phut, sla, qua, batDau };
}

// Khóa đối tượng → chuỗi (ưu tiên đối tượng HẸP nhất: tem > lệnh > đợt vải > phần in).
export function khoaChuoi(k) {
  if (!k) return '';
  if (k.tem_id) return `T:${k.tem_id}`;
  if (k.lenh_san_xuat_id) return `L:${k.lenh_san_xuat_id}`;
  if (k.dot_vai_ve_id) return `D:${k.dot_vai_ve_id}`;
  if (k.phan_in_id) return `P:${k.phan_in_id}`;
  return '';
}

// Dựng map khóa → lý do MỚI NHẤT từ danh sách backend (đã sắp mới nhất trước). Mỗi dòng đăng ký ở
// MỌI khóa nó có ⇒ màn đếm theo lệnh vẫn tra được lý do ghi theo phần in và ngược lại.
export function dungMapLyDo(items = []) {
  const m = new Map();
  items.forEach((x) => {
    [['T', x.tem_id], ['L', x.lenh_san_xuat_id], ['D', x.dot_vai_ve_id], ['P', x.phan_in_id]].forEach(([p, id]) => {
      if (id && !m.has(`${p}:${id}`)) m.set(`${p}:${id}`, x);
    });
  });
  return m;
}

// Tra lý do cho 1 khóa: thử lần lượt từ khóa hẹp nhất tới phần in.
export function timLyDo(map, k) {
  if (!map || !k) return null;
  for (const [p, id] of [['T', k.tem_id], ['L', k.lenh_san_xuat_id], ['D', k.dot_vai_ve_id], ['P', k.phan_in_id]]) {
    if (id && map.has(`${p}:${id}`)) return map.get(`${p}:${id}`);
  }
  return null;
}

// Khóa cho màn mức LỆNH mà `r.id` = id lệnh (Test Run · Release 2 · Gia công).
export const KHOA_LENH = (r) => ({
  lenh_san_xuat_id: r.id, phan_in_id: r.phan_in_id || null, ma: r.ma_lenh_san_xuat || r.ma_phan || null,
});

// Khóa mặc định đọc tên trường CHUNG — màn nào khác thì truyền `khoa` riêng.
export function khoaMacDinh(r) {
  return {
    phan_in_id: r.phan_in_id || null,
    dot_vai_ve_id: r.dot_vai_ve_id || r.dot_vai_id || null,
    lenh_san_xuat_id: r.lenh_id || r.lenh_san_xuat_id || null,
    tem_id: r.tem_id || null,
    ma: r.ma_tem || r.ma_lenh_san_xuat || r.ma_phan || null,
  };
}
