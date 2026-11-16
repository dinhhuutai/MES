// Khung CẢNH BÁO "chuyền gia công" (09/10/2026) — đặt ngay dưới ô chọn chuyền / trong hộp xác nhận ở Release 1,
// Kế hoạch tạm, Tạo đợt SX, Lập lại kế hoạch. Dòng tiêu đề cố định; thân (hậu quả cụ thể) do nơi dùng truyền vào.
// Luật nhận diện: `utils/chuyenGiaCong.js laChuyenGiaCong`.
export default function CanhBaoGiaCong({ tenChuyen, children }) {
  return (
    <div className="rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
      <div className="font-semibold">⚠ {tenChuyen ? `${tenChuyen} là` : 'Đây là'} chuyền GIA CÔNG</div>
      <div className="mt-0.5">{children}</div>
      {/* 14/11/2026: BE chặn 422 KHONG_GIA_CONG (`luongSanXuat.giaCongDuoc`) — chỉ công đoạn In thường gia công được. */}
      <div className="mt-1 text-xs">Hàng <b>in kiếng</b> và công đoạn <b>Ép/Logo</b> không đưa lên chuyền gia công — hệ thống sẽ chặn.</div>
    </div>
  );
}
