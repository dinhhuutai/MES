import { useEffect, useState, useCallback } from 'react';
import { getNghenMap } from '../services/dashboardService';
import useSocketEvent from './useSocketEvent';

// Bản đồ nghẽn/sắp nghẽn theo đợt vải + phần in (nguồn: dashboard flowRows) để tô màu hàng ở các trang xác nhận.
// Trả { map, statusDot(id), statusPhan(id) } — status: 'NGHEN' | 'SAP_NGHEN' | undefined.
export default function useNghenMap() {
  const [map, setMap] = useState({ dot_vai: {}, phan_in: {}, lenh: {} });
  const load = useCallback(() => { getNghenMap().then((r) => setMap(r.data || { dot_vai: {}, phan_in: {}, lenh: {} })).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);
  useSocketEvent('workflow:updated', load);
  useSocketEvent('production:updated', load);
  return {
    map,
    statusDot: (id) => map.dot_vai?.[id],
    statusPhan: (id) => map.phan_in?.[id],
    statusLenh: (id) => map.lenh?.[id],
  };
}
