import { Outlet, useLocation, Link } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { findModuleByPath } from '../../constants/modules';

// Layout trong module: Topbar + Sidebar (thu gọn được) + breadcrumb + nội dung.
export default function ModuleLayout() {
  const { pathname } = useLocation();
  const module = findModuleByPath(pathname);
  const current = module?.children?.find((c) => c.route === pathname);

  return (
    <div className="flex min-h-full flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar module={module} />
        <main className="flex-1 overflow-x-hidden px-6 py-6">
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-ink-soft">
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
