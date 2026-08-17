import { useEffect, useState, useCallback } from 'react';
import { getNghenMap } from '../services/dashboardService';
import useSocketReload from './useSocketReload';

// Bản đồ nghẽn/sắp nghẽn theo đợt vải + phần in (nguồn: dashboard flowRows) để tô màu hàng ở các trang xác nhận.
// Trả { map, statusDot(id), statusPhan(id) } — status: 'NGHEN' | 'SAP_NGHEN' | undefined.
export default function useNghenMap() {
  const [map, setMap] = useState({ dot_vai: {}, phan_in: {}, lenh: {} });
  const load = useCallback(() => { getNghenMap().then((r) => setMap(r.data || { dot_vai: {}, phan_in: {}, lenh: {} })).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // ⚠ Sự kiện GỘP làm 1: backend bắn cả cụm cho mỗi thao tác, mà hook này đang được dùng ở 7 trang
  // (Release 1/2, Test Run, Replan, Xác nhận chạy, QC in-line, Test Run CNSP) ⇒ trước đây mỗi hành
  // động sinh 3 request thừa cho MỖI trang đang mở. Hàm `load` vốn đã tải ngầm (không đụng loading).
  // ⚠⚠ ĐÃ BỎ `dashboard:refresh` (16/08/2026): sự kiện đó do **job phơi khô bắn BROADCAST mỗi 60
  //   giây cho MỌI client**, không liên quan bản đồ nghẽn ⇒ cứ mỗi phút là tất cả người đang mở 1
  //   trong 7 trang đồng loạt bắn 1 query nặng (`flowRows`). 20 người = 20 lượt/phút. Giữ
  //   `workflow:updated` + `production:updated` là đủ đúng nghiệp vụ (chúng bắn theo THAO TÁC thật).
  useSocketReload(['workflow:updated', 'production:updated'], load, 500);
  return {
    map,
    statusDot: (id) => map.dot_vai?.[id],
    statusPhan: (id) => map.phan_in?.[id],
    statusLenh: (id) => map.lenh?.[id],
  };
}
