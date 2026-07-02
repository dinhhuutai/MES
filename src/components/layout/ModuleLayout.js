import { useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Icon from '../common/Icon';
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
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
          {/* Thanh mobile: nút mở menu + tên module */}
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <button onClick={() => dispatch(openMobileNav())}
              className="rounded-control border border-line p-2 text-ink-soft hover:bg-surface-muted" aria-label="Mở menu">
              <Icon name="menu" size={20} />
            </button>
            <span className="text-sm font-semibold text-ink">{current?.ten || module?.ten}</span>
          </div>

          <nav className="mb-4 hidden items-center gap-1.5 text-sm text-ink-soft md:flex">
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
