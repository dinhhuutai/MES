// MÃ VẠCH PHẦN IN (ERP `BarcodePTHDH` → `phan_in.barcode`) — **CÓ THỂ LÀ DANH SÁCH** nhiều mã ngăn
// bằng dấu phẩy, vd `26021555120,26022218120,26024144120`.
//
// ⚠⚠ GƯƠNG của `backend/src/utils/maPhanIn.js` — **sửa luật phải sửa CẢ HAI**, lệch là màn quét ở
//   trình duyệt và câu tra cứu ở server ra 2 kết quả khác nhau cho cùng một mã.
//
// Vì sao có danh sách: ERP gửi nhiều mã cho cùng 1 phần in theo 2 cách — nhiều mã trong CÙNG 1 dòng,
// và mã ĐƠN khác nhau qua từng lần sync (MES gộp dồn lại). Chi tiết + số đo: CLAUDE.md §11.4.

const NGAN_CACH = ',';

// Tách chuỗi thành danh sách mã: cắt khoảng trắng, bỏ rỗng, khử trùng, GIỮ THỨ TỰ.
export function tachDsMa(s) {
  if (s == null) return [];
  const ra = [];
  for (const p of String(s).split(NGAN_CACH)) {
    const v = p.trim();
    if (v && !ra.includes(v)) ra.push(v);
  }
  return ra;
}

// Hiển thị cho người đọc: thêm khoảng trắng sau dấu phẩy để bảng/thẻ xuống dòng được, đỡ dính một cục.
// ⚠ CHỈ dùng để HIỂN THỊ — đừng gửi chuỗi này ngược lên API (server tự chuẩn hóa, nhưng giữ đúng
//   dạng đang lưu thì đối chiếu bằng mắt dễ hơn).
export function hienDsMa(s, khiRong = '—') {
  const ds = tachDsMa(s);
  return ds.length ? ds.join(', ') : khiRong;
}

// Một mã quét có nằm trong danh sách không.
export function khopMa(dsChuoi, ma) {
  const m = String(ma == null ? '' : ma).trim();
  return !!m && tachDsMa(dsChuoi).includes(m);
}
