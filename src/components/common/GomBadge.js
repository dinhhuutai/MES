import Badge from './Badge';

// Phân biệt 2 khái niệm dễ nhầm khi 1 ĐỢT SẢN XUẤT (lệnh) có nhiều đợt vải:
//  • GOM SET  = gộp đợt vải của các PHẦN IN KHÁC NHAU (cùng màu) để in chung 1 lần.
//  • GỘP ĐỢT = gộp nhiều đợt vải của CÙNG một phần in để release/chạy 1 lần.
// Suy theo số phần in khác nhau trong lệnh (so_phan_in). Không đủ >1 đợt vải thì không hiện gì.
export default function GomBadge({ soDotVai, soPhanIn, className = '' }) {
  const n = Number(soDotVai) || 0;
  if (n <= 1) return null;
  const isSet = (Number(soPhanIn) || 1) > 1;
  return isSet ? (
    <Badge tone="warning" className={className}
      title="Gom set: gộp đợt vải của NHIỀU phần in khác nhau (cùng màu) để in chung 1 lần.">
      Gom set ({n} đợt · {soPhanIn} phần in)
    </Badge>
  ) : (
    <Badge tone="info" className={className}
      title="Gộp đợt: gộp nhiều đợt vải của CÙNG một phần in để release/chạy 1 lần.">
      Gộp đợt ({n} đợt vải)
    </Badge>
  );
}
