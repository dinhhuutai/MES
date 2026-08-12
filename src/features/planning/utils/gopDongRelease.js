// GOM DÒNG "Danh sách release" THEO ĐỢT SẢN XUẤT.
//
// Danh sách trả về 1 dòng / (đợt SX × PHẦN IN) — lệnh GOM SET ra nhiều dòng. Nhưng đơn vị điều hành
// là **ĐỢT SẢN XUẤT**, nên STT phải đếm theo đợt SX và các ô ở MỨC LỆNH được hợp nhất (rowSpan) trên
// các dòng của cùng 1 đợt.
//
// ⚠⚠ SPAN PHẢI TÍNH TRÊN TẬP ĐANG HIỂN THỊ, KHÔNG dùng `so_phan_in` của backend: bộ lọc / chip loại
//   chuyền có thể ẩn bớt dòng của 1 lệnh ⇒ lấy `so_phan_in` = 2 mà chỉ còn 1 dòng thì `rowSpan=2` sẽ
//   phá vỡ bảng (ô tràn xuống hàng của lệnh khác).
// ⚠ Đầu vào PHẢI đã sắp xếp sao cho các dòng cùng 1 lệnh liền nhau (`releaseListByDate` đã ORDER BY
//   `… ls.id, pin.ma_phan`). Hàm này gom theo lần gặp liên tiếp nên thứ tự sai là gom sai.
//
// Trả về mảng cùng thứ tự, mỗi phần tử thêm:
//   `_stt`  số thứ tự ĐỢT SX (1..N) — chỉ có ở dòng đầu của đợt
//   `_dau`  true nếu là dòng ĐẦU của đợt SX (nơi duy nhất vẽ ô hợp nhất)
//   `_span` số dòng đang hiển thị của đợt SX đó (dùng cho rowSpan / mergeCells)
export function gopTheoLenh(items) {
  const ds = items || [];
  const dem = new Map();          // lenh_id -> số dòng đang hiển thị
  ds.forEach((r) => dem.set(r.lenh_id, (dem.get(r.lenh_id) || 0) + 1));

  let stt = 0;
  let truoc = null;
  return ds.map((r) => {
    const dau = r.lenh_id !== truoc;
    if (dau) { stt += 1; truoc = r.lenh_id; }
    return { ...r, _dau: dau, _stt: dau ? stt : null, _span: dem.get(r.lenh_id) || 1 };
  });
}

// Số ĐỢT SX trong tập đang hiển thị.
export const demLenh = (items) => new Set((items || []).map((r) => r.lenh_id)).size;

// Các cột ở MỨC LỆNH — hợp nhất ô trên các dòng của cùng 1 đợt SX.
// ⚠ CỐ Ý KHÔNG gộp Khách hàng / PO / Mã hàng: dữ liệu prod hiện cho thấy mọi lệnh gom set đều CÙNG
//   khách·đơn·mã hàng nên gộp cũng đúng, NHƯNG nếu về sau ERP gửi set trộn đơn thì gộp sẽ GIẤU MẤT
//   thông tin của dòng dưới. Để lặp lại giá trị thì cùng lắm là hơi thừa, không sai.
export const COT_MUC_LENH = ['stt', 'chuyen', 'sl_da_in', 'sl_da_giao', 'owner', 'gio_bd', 'gio_kt', 'xac_nhan'];
