import { NavLink, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Icon from '../common/Icon';
import {
  selectSidebarCollapsed, toggleSidebar, selectMobileNavOpen, closeMobileNav,
} from '../../store/uiSlice';
import usePermissions from '../../hooks/usePermissions';

export default function Sidebar({ module }) {
  const collapsed = useSelector(selectSidebarCollapsed);
  const mobileOpen = useSelector(selectMobileNavOpen);
  const dispatch = useDispatch();
  const { can } = usePermissions();
  const items = (module?.children || []).filter(
    (c) => !c.perm || (Array.isArray(c.perm) ? can(...c.perm) : can(c.perm)),
  );

  // Nội dung dùng chung; `mini` = thu gọn (chỉ desktop). Mobile luôn hiện đầy đủ nhãn.
  const content = (mini, onNavigate) => (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-line px-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-control ${module?.mau || 'bg-primary-wash text-primary'}`}>
          <Icon name={module?.icon} size={18} />
        </div>
        {!mini && <div className="truncate text-sm font-bold text-ink">{module?.ten}</div>}
        <button
          onClick={() => (onNavigate ? dispatch(closeMobileNav()) : dispatch(toggleSidebar()))}
          className="ml-auto rounded p-1.5 text-ink-soft hover:bg-surface-muted"
          title={onNavigate ? 'Đóng' : collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          <Icon name={onNavigate ? 'x' : collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((c) => (
          <NavLink
            key={c.route}
            to={c.route}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:bg-surface-muted hover:text-ink'
              }`
            }
            title={c.ten}
          >
            <Icon name="chevron-right" size={16} className="shrink-0" />
            {!mini && <span className="truncate">{c.ten}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-muted"
        >
          <Icon name="layout-dashboard" size={16} />
          {!mini && <span>Trang chủ</span>}
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: rail cố định, thu gọn được */}
      <aside
        className={`sticky top-header hidden h-[calc(100vh-72px)] shrink-0 flex-col self-start border-r border-line bg-surface transition-all duration-200 md:flex ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {content(collapsed, null)}
      </aside>

      {/* Mobile: drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => dispatch(closeMobileNav())} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface shadow-card-hover transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content(false, () => dispatch(closeMobileNav()))}
      </aside>
    </>
  );
}
