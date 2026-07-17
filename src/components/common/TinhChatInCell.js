// Tính chất in của phần in (`phan_in.tinh_chat_in`, đồng bộ từ ERP `Tinhchatin`).
// Dùng chung ở: Danh sách phần in vải về · Tạo đợt sản xuất · Kế hoạch tự động ·
// Release 1 · Release 2 · Lập kế hoạch lại · Test Run - QA.
export default function TinhChatInCell({ value }) {
  if (!value) return <span className="text-ink-soft">—</span>;
  return <span className="whitespace-nowrap text-ink">{value}</span>;
}
