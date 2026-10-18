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

// Ứng viên "Áp dụng cùng lựa chọn cho phần in khác" của `TraVeGnModal` từ các dòng MỨC LỆNH (18/10/2026): mỗi lệnh 1
// phần in ⇒ phạm vi = đợt của lệnh đó (`lenhId`); lệnh gom set cũ nhiều phần in bị bỏ qua (phải mở đúng lệnh để chọn
// phần in sai). `lenhKey` = khóa id lệnh của dòng (`id` · `lenh_id`).
export function ungVienTuLenh(rows, lenhKey = 'id') {
  return (rows || []).flatMap((r) => {
    const ds = dsPhanInCuaLenh(r);
    if (ds.length !== 1 || !r[lenhKey]) return [];
    return [{
      phanInId: ds[0].id, ma_phan: ds[0].ma_phan,
      mo_ta: [r.mau_vai, r.kich_vai, r.kich_phim, r.ma_lenh_san_xuat].filter(Boolean).join(' · '),
      lenhId: r[lenhKey],
    }];
  });
}
