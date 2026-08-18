// Hiển thị THÔNG BÁO — dùng chung cho chuông (Topbar) và trang Thông báo (mig 085).
// ⚠ Để ở 1 chỗ vì 2 nơi phải ra CÙNG đường dẫn và CÙNG mô tả; lệch nhau thì bấm ở chuông và bấm ở
//   trang lại vào 2 màn khác nhau.

// Thông báo thuộc họ DUYỆT (mig 086) hay họ TRẢ VỀ (mig 085)?
// ⚠ Dựa vào `ma_loai` chứ không vào sự có mặt của trường nào đó — 2 nguồn cố ý trả CÙNG bộ cột.
export const laThongBaoDuyet = (t) => String(t?.ma_loai || '').startsWith('DUYET_');

// Bấm thông báo → đi đâu.
//   · họ TRẢ VỀ  → màn READY Kỹ thuật, tìm sẵn code phần (`ReadyPage` đọc `?q=`)
//   · họ DUYỆT   → màn **Danh sách phần in vải về**, chip **"Tất cả"**, tìm sẵn code phần
//     (người dùng chốt 18/08/2026).
// ⚠⚠ `boNgay=1` là BẮT BUỘC: `PhanInListPage` khi vào chip "Tất cả" TỰ đặt lọc ngày vải về =
//   HÔM NAY ⇒ không có cờ này thì bấm thông báo của phần in ngày khác sẽ ra bảng TRỐNG.
// ⚠ Bản backend gương y hệt ở `backend/src/utils/thongBao.js duongDanDoiPa` (dùng cho Web Push) —
//   sửa thì sửa CẢ HAI, lệch nhau là bấm ở chuông và bấm ở popup vào 2 màn khác nhau.
export const duongDanThongBao = (t) => {
  // Với họ duyệt, `ma_phan_dau` là MỘT mã sạch; `ma_phan` có thể là danh sách "A, B" (gom set)
  // hoặc câu ngữ cảnh của dữ liệu cũ ⇒ nhét cả câu vào `?q=` thì tra không ra gì.
  if (laThongBaoDuyet(t)) {
    const ma = t?.ma_phan_dau || String(t?.ma_phan || '').split(',')[0].trim();
    return `/don-hang/phan-in?stage=ALL&boNgay=1&q=${encodeURIComponent(ma || '')}`;
  }
  return `/ky-thuat/ready?q=${encodeURIComponent(t?.ma_phan || '')}`;
};

// Câu mô tả LUỒNG: "Release 1 → trả về READY Kỹ thuật" / "Thay đổi phương án in — chờ duyệt".
// ⚠ Backend đã dựng sẵn `nhan_luong` (nguồn duy nhất ở `utils/thongBao.js`); chỉ tự ghép khi thiếu
//   để dữ liệu cũ / bản backend chưa cập nhật vẫn hiện được gì đó thay vì rỗng.
// ⚠ Câu tự ghép phải TÁCH 2 HỌ: nói "trả về" cho yêu cầu duyệt là sai nghiệp vụ.
export const luongThongBao = (t) => t?.nhan_luong
  || (laThongBaoDuyet(t)
    ? 'Thay đổi phương án in'
    : (t?.tu_tram && t?.den_tram ? `${t.tu_tram} → trả về ${t.den_tram}` : (t?.ten_tram || '')));

// Tiêu đề popup hệ điều hành — TÙY HỌ.
// ⚠ Trước đây chuông ghi cứng 'Phần in bị trả về' cho MỌI thông báo ⇒ yêu cầu đổi phương án in cũng
//   hiện thành "phần in bị trả về", sai hẳn nội dung.
export const tieuDeThongBao = (t) => {
  if (!laThongBaoDuyet(t)) return 'Phần in bị trả về';
  if (t?.ma_loai === 'DUYET_PA_IN_MOI') return 'Có yêu cầu đổi phương án in chờ duyệt';
  if (t?.duyet_trang_thai === 'TU_CHOI') return 'Yêu cầu đổi phương án in bị từ chối';
  return 'Phương án in đã được đổi';
};

// Câu "Bàn → Máy" của thông báo đổi phương án in ('' nếu không phải họ duyệt / thiếu dữ liệu).
export const doiPhuongAnIn = (t) => (laThongBaoDuyet(t) && t?.pa_cu_ten && t?.pa_moi_ten
  ? `${t.pa_cu_ten} → ${t.pa_moi_ten}` : '');

// Dòng mô tả ngắn cho popup hệ điều hành + dòng phụ trên chuông.
// ⚠ Họ DUYỆT phải nói rõ: đổi CODE PHẦN NÀO, TỪ phương án in nào SANG cái nào (yêu cầu 18/08/2026).
//   Trước đây dùng chung khuôn "trả về" nên chỉ hiện mỗi câu luồng, người nhận không biết đổi cái gì.
export const moTaThongBao = (t) => {
  if (laThongBaoDuyet(t)) {
    const pa = doiPhuongAnIn(t);
    const dong1 = `Thay đổi phương án in${t?.ma_phan ? `: ${t.ma_phan}` : ''}`;
    return [dong1, pa ? `Phương án in: ${pa}` : '', t?.ly_do ? `Lý do: ${t.ly_do}` : '']
      .filter(Boolean).join('\n');
  }
  const dong1 = [t?.ma_phan, luongThongBao(t)].filter(Boolean).join(' · ');
  const muc = t?.checklist_list ? `\nMục cần làm lại: ${t.checklist_list}` : '';
  return `${dong1}${muc}${t?.ly_do ? `\nLý do: ${t.ly_do}` : ''}`;
};

// "vừa xong" / "5 phút" / "3 giờ" / "12/08 09:15" — kiểu Zalo.
// ⚠ Quá 1 ngày thì hiện NGÀY GIỜ thật, đừng để "37 giờ trước" (khó đối chiếu với lịch sử).
export function nhanThoiGian(v) {
  if (!v) return '';
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return '';
  const giay = Math.floor((Date.now() - t) / 1000);
  if (giay < 60) return 'vừa xong';
  if (giay < 3600) return `${Math.floor(giay / 60)} phút`;
  if (giay < 86400) return `${Math.floor(giay / 3600)} giờ`;
  return new Date(v).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
