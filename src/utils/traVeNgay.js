import { ngayLocalISO, trongKhoangNgay } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// LỌC "PHẦN IN BỊ TRẢ VỀ" THEO NGÀY TRẢ VỀ — nguồn luật dùng chung cho 3 màn có ô tick
// "Chỉ hiện phần bị trả về": READY (Kỹ thuật) · Release 1 (Kế hoạch) · KCS.
//
// ⚠ MỖI MÀN CÓ SỐ NGUỒN TRẢ VỀ KHÁC NHAU — đó là lý do phải gom về 1 chỗ:
//     READY      : 3 nguồn (QC READY · Kế hoạch/Release 1 · Test Run QA)
//     Release 1  : 1 nguồn (QC trả về)
//     KCS        : 1 nguồn (OQC trả về)
//   Dòng khớp khi CÓ ÍT NHẤT MỘT lần trả về rơi trong khoảng ngày (không phải "lần mới nhất"):
//   phần in bị trả về 2 lần, hỏi ngày của lần đầu thì vẫn phải ra — nếu chỉ xét lần mới nhất,
//   người dùng lọc đúng ngày mình nhớ mà không thấy gì và tưởng mất dữ liệu.
//
// ⚠⚠ ĐỌC OBJECT `tra_ve*` CHỨ KHÔNG ĐỌC `tra_ve_ly_do`: backend trả SONG SONG cả hai —
//   `tra_ve` = object đầy đủ `{ly_do, checklist_list, tg, nguoi, so_lan}`, còn `tra_ve_ly_do`
//   chỉ là CHUỖI lý do (giữ tương thích cũ). Chuỗi không mang `tg` nên không lọc ngày được, và
//   bản ghi trả về có `ly_do` rỗng sẽ bị rơi mất. Object là nguồn đúng.
//
// ⚠ Ngày cắt bằng `ngayLocalISO` (giờ LOCAL), TUYỆT ĐỐI không `toISOString().slice(0,10)`:
//   giờ VN là UTC+7 nên quy về UTC sẽ LÙI 1 NGÀY với mọi mốc trước 07:00 sáng ⇒ lọc trượt.
//   Cùng mốc với `fmtDate` đang hiển thị và với chuỗi `DateRangePicker` phát ra.
// ─────────────────────────────────────────────────────────────────────────────

// Các khóa mang bản ghi trả về ĐANG TREO trên 1 dòng, theo thứ tự nguồn.
// ⚠ Thêm luồng trả về mới thì khai ở ĐÂY, đừng đi sửa từng màn.
const KHOA_TRA_VE = [
  'tra_ve',       // QC READY (màn READY) · QC trả về (Release 1) · OQC trả về (KCS)
  'tra_ve_kh',    // Kế hoạch (Release 1) trả về Kỹ thuật — chỉ màn READY
  'tra_ve_test',  // Test Run (QA) trả về Kỹ thuật — chỉ màn READY
];

// Mảng các lần trả về đang treo của 1 dòng (bỏ khóa rỗng và giá trị chuỗi thô).
export const cacLanTraVe = (row = {}) =>
  KHOA_TRA_VE.map((k) => row[k]).filter((v) => v && typeof v === 'object');

// Dòng này có đang bị trả về không.
// ⚠ Vẫn nhận `tra_ve_ly_do` làm lối lùi: màn nào backend chưa gắn object thì ô tick vẫn chạy
//   như cũ (chỉ là không lọc được theo ngày) — thà mất bộ lọc ngày còn hơn mất cả ô tick.
export const laTraVe = (row = {}) => cacLanTraVe(row).length > 0 || !!row.tra_ve_ly_do;

// Ngày trả về GẦN NHẤT ('YYYY-MM-DD') — dùng cho cột hiển thị / sắp xếp. Không có → ''.
export const ngayTraVeMoiNhat = (row = {}) => {
  const ngay = cacLanTraVe(row).map((v) => ngayLocalISO(v.tg)).filter(Boolean).sort();
  return ngay.length ? ngay[ngay.length - 1] : '';
};

// Dòng có lần trả về nào rơi trong khoảng ngày không. Khoảng rỗng ⇒ không lọc (nhận hết).
// ⚠ Dòng bị trả về mà KHÔNG có mốc `tg` (dữ liệu cũ) sẽ bị loại KHI ĐANG LỌC — cùng quy ước với
//   `trongKhoangNgay`: đang hỏi "ngày nào" thì dòng không có ngày không trả lời được câu hỏi đó.
export const traVeTrongKhoang = (row, khoang = {}) => {
  const { from, to } = khoang;
  if (!from && !to) return true;
  return cacLanTraVe(row).some((v) => trongKhoangNgay(v.tg, from, to));
};

// Lọc nguyên mảng: giữ dòng BỊ TRẢ VỀ và (nếu có chọn ngày) rơi đúng khoảng.
export const locTraVe = (rows = [], khoang = {}) =>
  rows.filter((r) => laTraVe(r) && traVeTrongKhoang(r, khoang));

// Số dòng bị trả về BỊ ẨN vì bộ lọc ngày — để màn hiện "đang lọc N/M", tránh cảnh người dùng
// tick ô rồi thấy bảng trống mà không hiểu vì sao.
export const demTraVe = (rows = []) => rows.filter(laTraVe).length;
