// ─────────────────────────────────────────────────────────────────────────────
// TÌM KIẾM THÔNG MINH (phía trình duyệt) — dùng CHUNG cho mọi ô tìm / ô lọc lọc-tại-chỗ.
//   · Bỏ khoảng trắng đầu–cuối, gộp nhiều khoảng trắng giữa thành 1
//   · KHÔNG phân biệt hoa–thường
//   · KHÔNG phân biệt DẤU tiếng Việt (gõ "thi" ra "THỊ", "duc" ra "Đức", "do" ra "đỏ")
//
// ⚠ Gương đúng luật của backend `src/utils/timKiem.js` (ở đó dựng regex cho toán tử `~*` của
//   PostgreSQL, ở đây so chuỗi trong JS) — SỬA LUẬT PHẢI SỬA CẢ HAI, nếu không màn lọc server-side
//   và màn lọc client-side sẽ ra 2 kết quả khác nhau cho cùng một từ khóa.
//
// ⚠⚠ TRƯỚC ĐÂY mỗi nơi tự khai một hàm `norm` riêng (DonePanel, SearchableSelect) còn phần lớn chỗ
//   khác chỉ `toLowerCase().includes()` — tức là **có dấu mới tìm ra**. Nay mọi nơi đi qua file này.
// ─────────────────────────────────────────────────────────────────────────────

// Bỏ dấu tiếng Việt + hạ chữ thường. `NFD` tách dấu thành ký tự tổ hợp rồi xóa; `đ/Đ` phải xử riêng
// vì nó là CHỮ CÁI riêng trong Unicode, không phải "d + dấu".
export const khongDau = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase();

// Chuẩn hóa TỪ KHÓA: bỏ khoảng trắng đầu–cuối + gộp khoảng trắng giữa (gõ "GL  2607" = "GL 2607").
export const chuanTuKhoa = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

// Dạng dùng để SO KHỚP: vừa bỏ dấu vừa chuẩn hóa khoảng trắng.
export const chuanTim = (s) => chuanTuKhoa(khongDau(s));

// `hay` có CHỨA `tu` không (đã bỏ dấu, bỏ hoa–thường, bỏ khoảng trắng thừa).
// Từ khóa rỗng ⇒ true (không lọc gì) — giữ đúng thói quen của `filterRows` cũ.
export function khop(hay, tu) {
  const t = chuanTim(tu);
  if (!t) return true;
  return chuanTim(hay).includes(t);
}

// Khớp trên NHIỀU trường (bất kỳ trường nào chứa từ khóa là được).
export function khopNhieu(giaTriList, tu) {
  const t = chuanTim(tu);
  if (!t) return true;
  return (giaTriList || []).some((v) => chuanTim(v).includes(t));
}

// Khớp TỪNG TỪ của từ khóa (07/10/2026): mọi từ đều có trong chuỗi, thứ tự nào cũng được ⇒ gõ "nguyen an"
// ra "Nguyễn Văn An", gõ "an 0210" ra "Nguyễn Văn An (021000123)". Mọi chuỗi khớp kiểu `khop` (chứa liền)
// đều vẫn khớp ở đây — chỉ rộng hơn, không hẹp đi.
export function khopTungTu(hay, tu) {
  const t = chuanTim(tu);
  if (!t) return true;
  const h = chuanTim(hay);
  return t.split(' ').every((x) => h.includes(x));
}

// Chuỗi để TÌM 1 NGƯỜI trong ô chọn người: nhãn hiển thị + họ tên + tên đăng nhập (= MSNV) + mã nhân viên
// (khóa nào có thì lấy) ⇒ gõ tên (không dấu) hay username đều ra. Option không phải người thì chỉ còn nhãn.
export const chuoiTimNguoi = (o, nhan = '') => [nhan, o && o.ho_ten, o && o.ten_dang_nhap, o && o.username, o && o.ma_user]
  .filter(Boolean).join(' ');
