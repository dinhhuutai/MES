// Định dạng số / tiền / ngày theo vi-VN.
export const fmtNum = (n) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN');

export const fmtCurrency = (n) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + ' ₫';

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};

// Ngày (giờ LOCAL) của một giá trị ngày/giờ, dạng 'YYYY-MM-DD' — để SO SÁNH với ô chọn khoảng ngày
// (`DateRangePicker` cũng phát ra chuỗi theo giờ local, và `fmtDate` ở trên cũng hiển thị theo local
// ⇒ ba chỗ cùng một mốc, không lệch ngày).
// ⚠⚠ KHÔNG dùng `toISOString().slice(0,10)`: node-pg trả cột DATE thành Date lúc 00:00 GIỜ LOCAL,
//    quy về UTC ở giờ VN (UTC+7) sẽ LÙI 1 NGÀY (ngày 07/08 hóa thành '2026-08-06') ⇒ lọc trượt hết.
export const ngayLocalISO = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Lọc theo KHOẢNG ngày. Đầu nào rỗng thì không chặn đầu đó (chọn mỗi ngày bắt đầu = "từ ngày đó
// trở đi") ⇒ khớp cách `DateRangePicker` phát giá trị lúc mới chọn được 1 đầu.
// So sánh CHUỖI 'YYYY-MM-DD' — định dạng này sắp xếp đúng thứ tự thời gian nên không cần parse lại.
// ⚠ Dòng KHÔNG có ngày (NULL) bị LOẠI khi đang lọc: đang hỏi "ngày nào" thì dòng không có ngày
//   không trả lời được câu hỏi đó. Bỏ lọc là nó hiện lại.
export const trongKhoangNgay = (v, from, to) => {
  if (!from && !to) return true;
  const s = ngayLocalISO(v);
  if (!s) return false;
  if (from && s < from) return false;
  if (to && s > to) return false;
  return true;
};

// Đưa mã vừa quét về ĐÚNG `ma_tem` đang lưu trong bảng `tem`, để tra cứu (QR mã hóa cả tiền tố công đoạn).
// Xử được CẢ HAI định dạng (xem `printTemLabel.js` → temCode):
//   · '162608057689'   → '152608057689'  — barcode ERP 12 số: mọi công đoạn quy về tiền tố gốc `15`
//   · '172608057689-2' → '152608057689'  — bỏ luôn hậu tố lần giao
//   · '15-TEM00123'    → 'TEM00123'      — mã cũ
//   · '17-TEM00030-1'  → 'TEM00030'
// ⚠ Bản backend gương y hệt ở `backend/src/utils/temPrefix.js` — sửa luật thì sửa CẢ HAI.
const MA_TEM_ERP_RE = /^1[3-9]\d{10}$/;
export const baseMaTem = (code) => {
  const c = String(code || '').trim().replace(/-\d+$/, '');
  return MA_TEM_ERP_RE.test(c) ? `15${c.slice(2)}` : c.replace(/^\d+-/, '');
};

// ⚠⚠⚠ DANH SÁCH `ma_tem` ỨNG VIÊN CHO 1 MÃ QUÉT — **DÙNG CÁI NÀY KHI TRA TEM THEO MÃ QUÉT**,
//   `baseMaTem` một mình KHÔNG CÒN ĐỦ (chốt 06/09/2026).
// Từ 06/09/2026 tem 17 (sửa đạt) và tem 13 (gia công về) **xin mã RIÊNG của ERP** thay vì suy từ mã
// tem 15 ⇒ `baseMaTem('172608099999')` cho ra `152608099999` là mã KHÁC HẲN (không có, hoặc tệ hơn
// là trúng tem của lô khác). Nhưng dữ liệu CŨ + nhãn `16…` (hàng lỗi chuyển sửa — không phải dòng
// tem riêng) thì vẫn phải suy về tem gốc ⇒ trả CẢ HAI, **NGUYÊN VĂN ĐỨNG TRƯỚC**.
// ⚠ Bản backend gương y hệt ở `backend/src/utils/temPrefix.js` — sửa luật thì sửa CẢ HAI.
export const maTemUngVien = (code) => {
  const nguyen = String(code || '').trim().replace(/-\d+$/, ''); // bỏ hậu tố lần giao
  const goc = baseMaTem(code);
  const out = [];
  for (const x of [nguyen, goc]) if (x && !out.includes(x)) out.push(x);
  return out;
};

// `ma_tem` trong DB có khớp mã vừa quét không (thử mọi ứng viên, không phân biệt hoa/thường).
// ⚠ Hàm này KHÔNG biết ưu tiên — dùng khi chỉ cần trả lời có/không cho MỘT dòng. Muốn tìm trong
//   danh sách thì dùng `timTheoMaTem` (giữ đúng thứ tự ứng viên).
export const khopMaTem = (maTem, code) => {
  const m = String(maTem || '').trim().toLowerCase();
  return !!m && maTemUngVien(code).some((x) => x.toLowerCase() === m);
};

// ⚠⚠ TÌM DÒNG KHỚP MÃ QUÉT TRONG DANH SÁCH — **ƯU TIÊN THEO THỨ TỰ ỨNG VIÊN** (mã NGUYÊN VĂN trước,
//   mã gốc suy ra sau). Gương đúng `array_position($1::text[], t.ma_tem)` mà backend đang dùng.
// ⚠ Vì sao không dùng `rows.find(r => khopMaTem(...))`: 3 dãy mã (15/17/13) của ERP ĐỘC LẬP nên 10 số
//   đuôi CÓ THỂ trùng nhau. Quét nhãn `172609000052` mà trong danh sách có cả tem `152609000052`
//   (tem khác, tình cờ trùng đuôi) thì `find` trả về dòng nào đứng trước — tức có thể MỞ NHẦM TEM.
//   Duyệt theo thứ tự ứng viên thì mã nguyên văn luôn thắng.
export const timTheoMaTem = (rows, code, layMa = (r) => r.ma_tem) => {
  for (const ma of maTemUngVien(code)) {
    const m = ma.toLowerCase();
    const hit = (rows || []).find((r) => String(layMa(r) || '').trim().toLowerCase() === m);
    if (hit) return hit;
  }
  return null;
};

// Chiều NGƯỢC của `baseMaTem`: mã gốc + TIỀN TỐ CÔNG ĐOẠN (+ hậu tố lần giao).
// Tiền tố: 13 = hàng gia công về · 15 = KCS đạt · 16 = sửa · 17 = OQC/giao.
//   · mã ERP 12 số → THAY 2 số đầu   : temCode('152608057689', 16) → '162608057689'
//   · mã cũ TEM… → nối bằng gạch     : temCode('TEM00123', 16)     → '16-TEM00123'
// ⚠ Đặt ở đây (KHÔNG ở `printTemLabel.js`) để màn danh sách dùng được mà không phải nạp
//   thư viện `qrcode` + bộ render tem; `printTemLabel.js` re-export lại hàm này.
// ⚠ Bản backend gương y hệt ở `backend/src/utils/temPrefix.js` — sửa luật thì sửa CẢ HAI.
export function temCode(maTem, prefix, suffix) {
  const ma = String(maTem == null ? '' : maTem).trim();
  const s = suffix != null && suffix !== '' ? `-${suffix}` : '';
  if (prefix == null || prefix === '') return `${ma}${s}`;
  if (MA_TEM_ERP_RE.test(ma)) return `${String(prefix)}${ma.slice(2)}${s}`;
  return `${prefix}-${ma}${s}`;
}

// ⚠⚠⚠ `ma_tem` NÀY ĐÃ MANG SẴN TIỀN TỐ CÔNG ĐOẠN CỦA CHÍNH NÓ CHƯA?
// Từ 06/09/2026 tem 17 (sửa đạt) và tem 13 (gia công về) xin mã RIÊNG của ERP và lưu THẲNG vào
// `tem.ma_tem` ⇒ **KHÔNG được ghép tiền tố lần nữa**. Ghép thêm là hỏng thật:
//   · tem 13 gia công đi tiếp sang OQC/Giao ở nguồn KCS ⇒ `temCode(ma13, 15)` biến `13…` thành
//     `15…` — một mã KHÔNG có thật, in lên phiếu giao là quét không ra.
//   · tem con dạng mã CŨ (`17-TEM00030`, ca API tắt) ⇒ ghép nữa ra `17-17-TEM00030`.
// Nhận diện: mã ERP 12 số KHÔNG bắt đầu bằng `15`, hoặc mã cũ đã có sẵn tiền tố `NN-`.
export const laMaTemRieng = (maTem) => {
  const m = String(maTem || '').trim();
  if (/^\d{2}-/.test(m)) return true;
  return MA_TEM_ERP_RE.test(m) && !m.startsWith('15');
};

// Mã hiện lên màn hình / nhãn giấy cho 1 tem: mã RIÊNG thì giữ nguyên, còn lại mới ghép tiền tố
// công đoạn. `laRieng` để bên gọi ép thêm bằng cờ từ backend (`la_tem_sua` — bắt được cả mã cũ).
export const maTemNhan = (maTem, prefix, suffix, laRieng = false) => (
  laRieng || laMaTemRieng(maTem) ? temCode(maTem, null, suffix) : temCode(maTem, prefix, suffix)
);

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
