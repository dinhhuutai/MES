import { useNavigate } from 'react-router-dom';
import Button from './Button';

// Nút "Hàng đợi · N chờ · M lỗi" ở thanh công cụ các màn Tích tem (19/11/2026) — chỉ hiện khi có mục chờ / lỗi.
// Bấm ⇒ trang Hệ thống › Hàng đợi tích tem, lọc sẵn loại của màn. `hd` = kết quả `useHangDoi(loai)`.
export default function HangDoiNut({ hd, loai }) {
  const navigate = useNavigate();
  if (!hd || (!hd.cho && !hd.loi)) return null;
  return (
    <Button chiXemOk variant={hd.loi > 0 ? 'danger' : 'secondary'} icon={hd.cho > 0 ? 'loader' : 'alert-triangle'}
      onClick={() => navigate(`/he-thong/hang-doi-tich-tem?loai=${loai}`)}>
      Hàng đợi{hd.cho > 0 ? ` · ${hd.cho} chờ` : ''}{hd.loi > 0 ? ` · ${hd.loi} lỗi` : ''}
    </Button>
  );
}
