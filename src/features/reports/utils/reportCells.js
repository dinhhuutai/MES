// ─────────────────────────────────────────────────────────────────────────────
// GIÁ TRỊ CỦA 1 Ô TRONG BÁO CÁO THÔNG MINH — nguồn CHUNG cho Xuất Excel và Xuất CSV.
//
// ⚠⚠ VÌ SAO TÁCH RA (21/08/2026): trước đây Excel và CSV mỗi bên tự dựng giá trị theo cách riêng.
//   Hậu quả thật: bản CSV chỉ đọc `ket_qua` (metric) nên **bỏ sót toàn bộ khối danh sách và các ô
//   chữ người dùng gõ** ⇒ tải về gần như rỗng. Nay 2 đường gọi chung `giaTriO()` — sửa 1 chỗ.
//
// ⚠⚠ PHÂN BIỆT `text` VÀ `so`: file Excel PHẢI ghi ô số bằng SỐ THẬT thì WPS/Excel mới cộng được.
//   Lỗi cũ: mọi ô đều ghi chuỗi (`fmtSo()` đã format sẵn) ⇒ bôi đen cột SLĐH chỉ thấy `Count=148`,
//   `Sum=0`. Nay trả kèm cờ `so` + `dinhDang` (mã numFmt của Excel) để bên xuất tự quyết.
// ⚠ CSV thì ngược lại: ghi SỐ THÔ không phân cách nghìn (`1234.5`), vì dấu `.`/`,` kiểu vi-VN sẽ
//   làm Excel đọc CSV hiểu sai cột. Bên CSV dùng `chuoiThoCsv()`.
//
// ⚠ File này CỐ Ý KHÔNG import gì từ `ReportGrid` (file React) — để chạy được trong test Node thuần.
// ─────────────────────────────────────────────────────────────────────────────

// Mã định dạng số của Excel, gương theo `fmtSo()` ở ReportGrid (đừng để 2 bên lệch nhau):
//   fmtNum = toLocaleString('vi-VN') ⇒ có phân cách nghìn, tối đa 3 số lẻ.
// ⚠ `percent` KHÔNG dùng numFmt `0%` của Excel — nó NHÂN 100 lần nữa. Giá trị của hệ đã là phần
//   trăm sẵn (85 nghĩa là 85%) nên phải nối chuỗi `"%"`.
export const NUM_FMT = {
  raw: 'General',
  thousand: '#,##0.###',
  dp2: '#,##0.00',
  percent: '#,##0.###"%"',
  currency: '#,##0.###" ₫"',
};

const soHopLe = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Giá trị 1 ô để XUẤT FILE.
 * @param cell ô thiết kế (`noi_dung_json.o[key]`) — có thể undefined
 * @param res  kết quả metric (`ket_qua[key]`) — có thể undefined
 * @param d    ô thuộc KHỐI DANH SÁCH (`buildDsMap().map[key]`) — có thể undefined
 * @returns {{ giaTri: any, so: boolean, dinhDang: string, laDau: boolean }}
 *          `so=true` ⇒ `giaTri` là Number thật, bên Excel ghi thẳng + gắn `dinhDang`.
 */
export function giaTriO(cell, res, d) {
  const dd = (cell && cell.dinh_dang) || {};
  const fmt = NUM_FMT[dd.dinh_dang_so] || NUM_FMT.thousand;

  // 1) Ô thuộc khối danh sách (ưu tiên cao nhất — nó đè lên ô thiết kế bên dưới).
  if (d) {
    if (d.la_dau) return { giaTri: d.text, so: false, dinhDang: fmt, laDau: true };
    if (d.kieu === 'so') {
      const n = soHopLe(d.val);
      if (n !== null) return { giaTri: n, so: true, dinhDang: fmt, laDau: false };
    }
    return { giaTri: d.text, so: false, dinhDang: fmt, laDau: false };
  }

  // 2) Ô có kết quả metric.
  if (res) {
    if (res.loi) return { giaTri: String(res.value ?? ''), so: false, dinhDang: fmt, laDau: false };
    if (res.kieu === 'bool') return { giaTri: res.value ? 'x' : '', so: false, dinhDang: fmt, laDau: false };
    if (res.kieu === 'text') return { giaTri: String(res.value ?? ''), so: false, dinhDang: fmt, laDau: false };
    const n = soHopLe(res.value);
    if (n !== null) return { giaTri: n, so: true, dinhDang: fmt, laDau: false };
    // ⚠ Giá trị không phải số: `fmtSo()` của ReportGrid cũng chỉ `String(value)` ở nhánh này
    //   (`!Number.isFinite` → trả nguyên chuỗi) ⇒ viết thẳng, khỏi kéo React vào file này.
    return { giaTri: String(res.value ?? ''), so: false, dinhDang: fmt, laDau: false };
  }

  // 3) Ô thiết kế thuần (chữ / số / hộp kiểm / thả xuống).
  if (!cell) return { giaTri: '', so: false, dinhDang: fmt, laDau: false };
  if (cell.loai === 'text') return { giaTri: cell.gia_tri || '', so: false, dinhDang: fmt, laDau: false };
  if (cell.loai === 'so') {
    const n = soHopLe(cell.gia_tri);
    if (n !== null) return { giaTri: n, so: true, dinhDang: fmt, laDau: false };
    return { giaTri: '', so: false, dinhDang: fmt, laDau: false };
  }
  if (cell.loai === 'hop_kiem') return { giaTri: cell.gia_tri ? 'x' : '', so: false, dinhDang: fmt, laDau: false };
  if (cell.loai === 'tha_xuong') return { giaTri: cell.gia_tri || '', so: false, dinhDang: fmt, laDau: false };
  return { giaTri: '', so: false, dinhDang: fmt, laDau: false };
}

// Chuỗi cho CSV: số ghi THÔ (dấu chấm thập phân, KHÔNG phân cách nghìn) để Excel/WPS đọc ra số.
export function chuoiThoCsv(o) {
  if (o.so) return String(o.giaTri);
  return String(o.giaTri ?? '');
}
