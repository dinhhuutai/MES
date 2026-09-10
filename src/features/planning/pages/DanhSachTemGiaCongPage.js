import DanhSachTemView from '../../production/components/DanhSachTemView';
import { listTemGiaCongDaIn } from '../../../services/planningService';

// *Kế hoạch › Danh sách tem gia công* — XEM tem 13 ("TH VỀ") đã tạo khi Kế hoạch nhận hàng gia công
// về, không phải in lại (nhiệm vụ #8). Hàng gia công nhận NHIỀU LẦN ⇒ mỗi lần 1 tem riêng.
//
// ⚠ Dùng chung view với *Sản xuất › Danh sách tem in* — chỉ khác NGUỒN (route + quyền) và bộ cột
//   (`laGiaCong`: bỏ ngày ca/giờ SX vì tem 13 không do ai đứng chuyền in, thay bằng nhà gia công).
// ⚠ KHÔNG truyền `layNhan`: route dữ liệu nhãn gác `PROD_RUN`/`PROD_MONITOR` (trang này là
//   RELEASE1/RELEASE2 ⇒ 403), và nhãn tem 13 vốn dựng từ dữ liệu LỆNH (`printGiaCongVeTem`).
export default function DanhSachTemGiaCongPage() {
  return (
    <DanhSachTemView
      title="Danh sách tem gia công"
      subtitle="Tra cứu tem hàng gia công đã nhận về (tem TH VỀ) — bấm 1 dòng để xem thông tin tem và sổ cái số lượng."
      fetcher={listTemGiaCongDaIn}
      laGiaCong
    />
  );
}
