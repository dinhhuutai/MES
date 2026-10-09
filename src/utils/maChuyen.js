// MÃ CHUYỀN CHUẨN = MÃ CHUYỀN CỦA ERP (09/10/2026) — gương backend `utils/maChuyen.js`, SỬA CẢ HAI.
//   · Bàn: bỏ "M" đầu + "-" (`M1A-1B` → `1A1B`, `M10A` → `10A`) · Robot `MRB1` → `RB1` · mã khác giữ nguyên.
// Idempotent ⇒ so mã chuyền qua hàm này đúng cả trước lẫn sau khi chạy script đổi mã trên DB.
export function chuanMaChuyen(ma) {
  const s = String(ma == null ? '' : ma).trim().toUpperCase().replace(/[\s-]+/g, '');
  const ban = /^M(\d+[AB](?:\d+[AB])?)$/.exec(s);
  if (ban) return ban[1];
  const robot = /^M(RB\d+)$/.exec(s);
  if (robot) return robot[1];
  return s;
}
