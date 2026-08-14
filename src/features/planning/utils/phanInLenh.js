// ─────────────────────────────────────────────────────────────────────────────
// PHẦN IN CỦA MỘT LỆNH — dùng chung cho các màn mức LỆNH (Release 2 · Test Run · Gia công ·
// Lập kế hoạch lại).
//
// ⚠⚠ VẤN ĐỀ GỐC: query mức lệnh dùng `PHAN_INFO_LATERAL` có `LIMIT 1` nên hàng chỉ mang phần in
//   **ĐẠI DIỆN** (`r.ma_phan` = mã nhỏ nhất). Với lệnh GOM SET thì mọi thứ đọc từ `r.ma_phan` đều
//   thiếu: cột hiển thị, ô quét QR, bộ lọc. Lỗi thật 14/08/2026 — lọc `SL-2608-006-A07-F01-C05`
//   ra dòng hiện `…-C02` (lệnh LSX0605 gom 2 phần in). Đo prod: 175/837 lệnh ở màn Lập kế hoạch
//   lại là gom set (21%), Test Run 166/608, Gia công 74/211.
//
// ⇒ Backend nay gắn thêm **`phan_in_list`** (chỉ khi `so_phan_in > 1`) — mọi chỗ đọc `ma_phan`
//   phải đi qua các helper dưới đây. Lệnh thường không có `phan_in_list` ⇒ hành vi y như cũ.
// ─────────────────────────────────────────────────────────────────────────────

// Mảng phần in của lệnh. Lệnh thường → 1 phần tử dựng từ chính hàng đó.
export const dsPhanIn = (r) => (
  Array.isArray(r?.phan_in_list) && r.phan_in_list.length
    ? r.phan_in_list
    : [{ ma_phan: r?.ma_phan, ten_khach_hang: r?.ten_khach_hang, ma_don_hang: r?.ma_don_hang, ma_hang: r?.ma_hang }]
);

// Tất cả CODE PHẦN của lệnh — dùng cho `ScanCollectModal getCodes`.
// ⚠ Thiếu cái này thì quét QR code phần thứ hai của lệnh gom set sẽ báo "không thấy".
export const codesCuaLenh = (r) => dsPhanIn(r).map((p) => p.ma_phan).filter(Boolean);

// Có phải lệnh gom set không (để hiện badge).
export const laGomSet = (r) => Number(r?.so_phan_in) > 1;
