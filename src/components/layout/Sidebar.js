import { NavLink, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Icon from '../common/Icon';
import { selectSidebarCollapsed, toggleSidebar } from '../../store/uiSlice';
import usePermissions from '../../hooks/usePermissions';

export default function Sidebar({ module }) {
  const collapsed = useSelector(selectSidebarCollapsed);
  const dispatch = useDispatch();
  const { can } = usePermissions();
  const items = (module?.children || []).filter((c) => !c.perm || can(c.perm));

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-line bg-surface transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-line px-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-control ${module?.mau || 'bg-primary-wash text-primary'}`}>
          <Icon name={module?.icon} size={18} />
        </div>
        {!collapsed && (
          <div className="truncate text-sm font-bold text-ink">{module?.ten}</div>
        )}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="ml-auto rounded p-1.5 text-ink-soft hover:bg-surface-muted"
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((c) => (
          <NavLink
            key={c.route}
            to={c.route}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:bg-surface-muted hover:text-ink'
              }`
            }
            title={c.ten}
          >
            <Icon name="chevron-right" size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{c.ten}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-muted"
        >
          <Icon name="layout-dashboard" size={16} />
          {!collapsed && <span>Trang chủ</span>}
        </Link>
      </div>
    </aside>
  );
}
