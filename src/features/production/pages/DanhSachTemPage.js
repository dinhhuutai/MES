import DanhSachTemView from '../components/DanhSachTemView';
import { listTemDaIn, getTemLabel } from '../../../services/productionService';

// *Sản xuất › Danh sách tem in* — XEM thông tin tem đã in mà không phải in ra giấy (nhiệm vụ #8).
// Chỉ tem SẢN XUẤT (lệnh KHÔNG trên chuyền loại `GIA_CONG`); tem gia công có trang riêng bên Kế hoạch.
//
// ⚠ Bố cục/bộ lọc nằm ở `DanhSachTemView` (dùng chung 2 trang) — sửa ở đó, đừng chép ra đây.
// ⚠ `getTemLabel` chỉ truyền Ở TRANG NÀY: route `/production/tem/:temId/label` gác `PROD_RUN`/
//   `PROD_MONITOR`, trang gia công (quyền RELEASE1/RELEASE2) gọi vào sẽ 403.
export default function DanhSachTemPage() {
  return (
    <DanhSachTemView
      title="Danh sách tem in"
      subtitle="Tra cứu tem đã in của sản xuất — bấm 1 dòng để xem thông tin tem, ngày ca, phân công và sổ cái số lượng."
      fetcher={listTemDaIn}
      layNhan={getTemLabel}
    />
  );
}
