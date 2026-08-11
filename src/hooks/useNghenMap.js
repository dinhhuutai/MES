import { useEffect, useState, useCallback } from 'react';
import { getNghenMap } from '../services/dashboardService';
import useSocketReload from './useSocketReload';

// Bản đồ nghẽn/sắp nghẽn theo đợt vải + phần in (nguồn: dashboard flowRows) để tô màu hàng ở các trang xác nhận.
// Trả { map, statusDot(id), statusPhan(id) } — status: 'NGHEN' | 'SAP_NGHEN' | undefined.
export default function useNghenMap() {
  const [map, setMap] = useState({ dot_vai: {}, phan_in: {}, lenh: {} });
  const load = useCallback(() => { getNghenMap().then((r) => setMap(r.data || { dot_vai: {}, phan_in: {}, lenh: {} })).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // ⚠ 3 sự kiện GỘP làm 1: backend bắn cả cụm cho mỗi thao tác, mà hook này đang được dùng ở 7 trang
  // (Release 1/2, Test Run, Replan, Xác nhận chạy, QC in-line, Test Run CNSP) ⇒ trước đây mỗi hành
  // động sinh 3 request thừa cho MỖI trang đang mở. Hàm `load` vốn đã tải ngầm (không đụng loading).
  useSocketReload(['dashboard:refresh', 'workflow:updated', 'production:updated'], load, 500);
  return {
    map,
    statusDot: (id) => map.dot_vai?.[id],
    statusPhan: (id) => map.phan_in?.[id],
    statusLenh: (id) => map.lenh?.[id],
  };
}
