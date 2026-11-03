import { lazy } from 'react';

// TẢI TRANG THEO NHU CẦU (03/11/2026). Mỗi trang là 1 file JS riêng ⇒ lần mở đầu không phải tải cả 3,2 MB.
// Sau khi deploy bản mới, file của bản cũ không còn trên máy chủ ⇒ tab đang mở sẽ lỗi khi vào trang chưa từng mở.
// Xử lý: thử lại 1 lần (phòng mạng chập chờn) ⇒ vẫn lỗi thì tải lại cả trang để nhận index.html mới, tối đa 1 lần
// (có cờ trong sessionStorage), tránh vòng lặp tải lại khi máy chủ thật sự hỏng. Hết cách thì ném lỗi cho `KhungTaiTrang`.
const KHOA = 'mes.da_tai_lai_vi_chunk';
const doc = () => { try { return sessionStorage.getItem(KHOA); } catch (e) { return '1'; } };
const ghi = (v) => {
  try {
    if (v) sessionStorage.setItem(KHOA, v);
    else sessionStorage.removeItem(KHOA);
  } catch (e) { /* trình duyệt chặn lưu trữ */ }
};

export default function taiLuoi(nap) {
  return lazy(async () => {
    try {
      const m = await nap();
      ghi(null);
      return m;
    } catch (loi1) {
      await new Promise((r) => { setTimeout(r, 800); });
      try {
        const m = await nap();
        ghi(null);
        return m;
      } catch (loi2) {
        if (!doc()) {
          ghi('1');
          window.location.reload();
          return new Promise(() => {}); // đang tải lại, giữ màn chờ
        }
        throw loi2;
      }
    }
  });
}
