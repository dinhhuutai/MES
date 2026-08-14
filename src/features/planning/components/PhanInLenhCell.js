import Badge from '../../../components/common/Badge';
import { dsPhanIn, laGomSet } from '../utils/phanInLenh';

// Ô "Code phần" cho các màn mức LỆNH (Release 2 · Test Run · Gia công · Lập kế hoạch lại).
//
// ⚠⚠ Lệnh GOM SET có NHIỀU phần in nhưng query chỉ trả 1 phần in đại diện (`PHAN_INFO_LATERAL`
//   `LIMIT 1`) ⇒ nếu chỉ in `r.ma_phan` thì người dùng tìm/quét đúng lệnh mà thấy code phần KHÁC
//   cái mình gõ, tưởng hệ thống lọc sai (lỗi thật 14/08/2026: tìm `…-C05` ra dòng hiện `…-C02`).
//   Nay hiện ĐỦ, kèm badge để biết ngay đây là lệnh gom set.
//
// ⚠ Cố ý KHÔNG tách dòng cả bảng (như màn Xác nhận chạy): ở 4 màn này mọi thao tác đều ở mức
//   LỆNH (duyệt / test / đổi chuyền / nhận hàng) nên gộp trong 1 ô vừa đủ mà bảng không phình.
export default function PhanInLenhCell({ row }) {
  const ds = dsPhanIn(row);
  if (!ds.length || !ds[0].ma_phan) return '—';
  if (!laGomSet(row)) return ds[0].ma_phan;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span>{ds[0].ma_phan}</span>
        <Badge tone="info" title={`Lệnh gom set — in chung ${ds.length} phần in`}>gom set {ds.length}</Badge>
      </div>
      {ds.slice(1).map((p) => (
        <div key={p.phan_in_id || p.ma_phan} className="text-xs text-ink-soft">{p.ma_phan}</div>
      ))}
    </div>
  );
}
