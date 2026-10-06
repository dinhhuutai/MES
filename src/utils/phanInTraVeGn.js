// Danh sách phần in (khử trùng) của 1 dòng MỨC LỆNH để mở modal "Trả về GN" (`TraVeGnModal`):
// lệnh gom set cũ mang `phan_in_list` (mỗi phần tử có `phan_in_id`), lệnh thường chỉ có phần in đại diện
// (`phan_in_id` của dòng). Dùng chung Release 2 · Chờ chạy.
export function dsPhanInCuaLenh(r) {
  if (!r) return [];
  const nguon = Array.isArray(r.phan_in_list) && r.phan_in_list.length
    ? r.phan_in_list
    : [{ phan_in_id: r.phan_in_id, ma_phan: r.ma_phan, mau_vai: r.mau_vai }];
  const m = new Map();
  nguon.forEach((p) => {
    if (p && p.phan_in_id && !m.has(String(p.phan_in_id))) {
      m.set(String(p.phan_in_id), { id: p.phan_in_id, ma_phan: p.ma_phan, mau_vai: p.mau_vai });
    }
  });
  return [...m.values()];
}
