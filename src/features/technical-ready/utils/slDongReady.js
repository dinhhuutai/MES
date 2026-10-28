// Số lượng của 1 dòng màn READY Kỹ thuật / QC READY (28/10/2026): SL vải của các ĐỢT trên dòng (BE `so_luong_dot`,
// dòng tách theo đợt chờ); dòng không có đợt chờ ⇒ Σ SL vải các đợt sống của phần in (`sl_vai_song`).
// Dùng chung bảng + Excel của 2 màn.
export default function slDongReady(r) {
  const v = r?.so_luong_dot ?? r?.sl_vai_song;
  return v == null || v === '' ? null : Number(v);
}
