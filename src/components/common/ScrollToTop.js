import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Khi ĐỔI TRANG (đổi pathname) → cuộn về đầu trang. Tránh giữ vị trí cuộn cũ khi
// từ trang khác quay lại (vd Home Portal bị nằm ở cuối trang).
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Tài liệu cuộn ở window (body cao hơn viewport). Reset cả documentElement/body cho chắc.
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}
