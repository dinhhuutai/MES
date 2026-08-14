// TẢI HẾT mọi trang của một endpoint danh sách.
//
// ⚠⚠ VÌ SAO CẦN: `backend/src/utils/pagination.js` `getPaging` CAP CỨNG `limit > 200 → 200`.
// Truyền `limit: 500` / `limit: 100000` KHÔNG lấy được nhiều hơn — backend âm thầm cắt còn 200 dòng,
// KHÔNG báo lỗi gì. Trang nào lọc/quét/xuất Excel ở CLIENT mà dựa vào "đã tải hết" sẽ cho kết quả
// SAI một cách im lặng khi dữ liệu vượt 200 (đã gặp thật 06/08/2026: xuất Excel 396 phần in ra 200;
// và 14/08/2026: màn Lập kế hoạch lại có 760 lệnh nhưng chỉ tải về 200).
//
// Cách dùng:
//   const { items, total, thieu } = await taiHetTrang((p) => listReplanCandidates({ search, ...p }));
//
// `fetcher(p)` nhận `{ page, limit }` và phải trả về `res` có `res.data.items` + `res.data.meta.total`.
// Trả `thieu = true` khi chạm trần an toàn mà vẫn chưa gom đủ ⇒ trang gọi NÊN báo cho người dùng
// thay vì lặng lẽ hiển thị thiếu.

export const LIMIT_TAI = 200;   // đúng trần của getPaging — xin hơn cũng không được cho
export const MAX_TRANG = 100;   // trần an toàn: 20.000 dòng, phòng backend trả meta sai → lặp vô hạn

export default async function taiHetTrang(fetcher) {
  const items = [];
  let total = 0;
  let trang = 1;
  for (; trang <= MAX_TRANG; trang += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetcher({ page: trang, limit: LIMIT_TAI });
    const ds = res?.data?.items || [];
    total = res?.data?.meta?.total ?? ds.length;
    items.push(...ds);
    // Hết dòng, hoặc đã gom đủ theo `total` → dừng. Danh sách ≤ 200 dòng chỉ tốn ĐÚNG 1 lời gọi.
    if (!ds.length || items.length >= total) break;
  }
  return { items, total, thieu: items.length < total };
}
