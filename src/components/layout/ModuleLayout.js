import { useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Icon from '../common/Icon';
import SiSoTram from '../common/SiSoTram';
import { openMobileNav, closeMobileNav } from '../../store/uiSlice';
import { findModuleByPath } from '../../constants/modules';

// Layout trong module: Topbar + Sidebar (thu gọn được) + breadcrumb + nội dung.
export default function ModuleLayout() {
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const module = findModuleByPath(pathname);
  const current = module?.children?.find((c) => c.route === pathname);

  // Đóng drawer mobile khi đổi trang (và khi vào lại app nếu state cũ còn mở).
  useEffect(() => { dispatch(closeMobileNav()); }, [pathname, dispatch]);

  return (
    <div className="flex min-h-full flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar module={module} />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 pb-24 md:px-6 md:py-6 lg:pb-6">
          {/* Hàng điều hướng: breadcrumb bên trái — dải SĨ SỐ bám mép PHẢI, THẲNG HÀNG với nó.
              ⚠ Sĩ số render Ở ĐÂY chứ không trong từng trang: góc trên bên phải vốn bỏ trống, đặt
              vào đây thì không đụng gì tới bố cục Toolbar/bảng của 11 màn xác nhận.
              Màn nào có sĩ số khai bằng khóa `siSo` trong `constants/modules.js`. */}
          <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
            <div className="flex min-w-0 items-center gap-2">
              {/* Thanh mobile: nút mở menu + tên module */}
              <button onClick={() => dispatch(openMobileNav())}
                className="rounded-control border border-line p-2 text-ink-soft hover:bg-surface-muted md:hidden" aria-label="Mở menu">
                <Icon name="menu" size={20} />
              </button>
              <span className="truncate text-sm font-semibold text-ink md:hidden">{current?.ten || module?.ten}</span>

              <nav className="hidden items-center gap-1.5 text-sm text-ink-soft md:flex">
                <Link to="/" className="hover:text-primary">
                  Trang chủ
                </Link>
                <span>/</span>
                <span className="text-ink-soft">{module?.ten}</span>
                {current && (
                  <>
                    <span>/</span>
                    <span className="font-medium text-ink">{current.ten}</span>
                  </>
                )}
              </nav>
            </div>
            {current?.siSo && (
              <div className="shrink-0">
                <SiSoTram maTrang={current.siSo} />
              </div>
            )}
          </div>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
