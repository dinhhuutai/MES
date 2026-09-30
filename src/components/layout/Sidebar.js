import { useEffect, useMemo, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Icon from '../common/Icon';
import {
  selectSidebarCollapsed, toggleSidebar, selectMobileNavOpen, closeMobileNav,
} from '../../store/uiSlice';
import usePermissions from '../../hooks/usePermissions';

// ─── DANH MỤC (30/09/2026) ───────────────────────────────────────────────────────────────
// Module khai `nhom` (hiện chỉ Hệ thống — `constants/modules.NHOM_HE_THONG`) ⇒ trang gom theo danh mục,
// bấm tiêu đề để mở/đóng. Danh mục chứa trang đang mở LUÔN bung. Trạng thái mở/đóng nhớ theo máy
// (`localStorage sidebar.nhomMo.<ma module>`, bọc try/catch — hỏng thì mặc định đóng).
// Module không khai `nhom` ⇒ danh sách phẳng y như cũ.
const KHAC = { ma: 'KHAC', ten: 'Khác', icon: 'layout' };
const khoaNho = (ma) => `sidebar.nhomMo.${ma}`;
const docNho = (ma) => {
  try { return new Set(JSON.parse(localStorage.getItem(khoaNho(ma)) || '[]')); } catch { return new Set(); }
};
const ghiNho = (ma, set) => {
  try { localStorage.setItem(khoaNho(ma), JSON.stringify([...set])); } catch { /* bỏ qua */ }
};
const laTrangDangMo = (pathname, route) => pathname === route || pathname.startsWith(`${route}/`);

// ─── TOOLTIP TÊN ĐẦY ĐỦ KHI RÊ CHUỘT (30/09/2026) ──────────────────────────────────────────
// Tên dài bị cắt "…" theo bề rộng sidebar ⇒ rê chuột vào dòng thì HIỆN NGAY 1 khung nổi bên phải
// dòng đó chứa tên đầy đủ (thay `title` mặc định của trình duyệt — hiện chậm, chữ nhỏ). Chỉ hiện khi
// chữ ĐANG BỊ CẮT hoặc sidebar đang thu gọn (chỉ icon). Khung `fixed` nên không bị sidebar cắt mất.
const layViTri = (el) => { const r = el.getBoundingClientRect(); return { x: r.right + 8, y: r.top + r.height / 2 }; };
function hoiTooltip(e, ten, mini, setTip) {
  const chu = e.currentTarget.querySelector('[data-ten]');
  const biCat = !chu || chu.scrollWidth > chu.clientWidth;
  if (mini || biCat) setTip({ ten, ...layViTri(e.currentTarget) });
}

// ⚠ Khai MỨC MODULE (không lồng trong Sidebar) — tránh remount mỗi lần cha render.
function MucTrang({ c, mini, onNavigate, lui = false, setTip }) {
  return (
    <NavLink
      to={c.route}
      end
      onClick={onNavigate}
      onMouseEnter={(e) => hoiTooltip(e, c.ten, mini, setTip)}
      onMouseLeave={() => setTip(null)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-control py-2 text-sm font-medium transition ${lui && !mini ? 'pl-8 pr-3' : 'px-3'} ${
          isActive ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:bg-surface-muted hover:text-ink'
        }`
      }
    >
      {!lui || mini ? <Icon name="chevron-right" size={16} className="shrink-0" /> : null}
      {!mini && <span data-ten className="truncate">{c.ten}</span>}
    </NavLink>
  );
}

function TooltipTen({ tip }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
      className="pointer-events-none fixed z-[60] max-w-xs -translate-y-1/2 rounded-control bg-ink px-2.5 py-1.5 text-xs font-medium text-surface shadow-card-hover"
    >
      {tip.ten}
    </div>
  );
}

export default function Sidebar({ module }) {
  const collapsed = useSelector(selectSidebarCollapsed);
  const mobileOpen = useSelector(selectMobileNavOpen);
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { can } = usePermissions();
  const items = (module?.children || []).filter(
    (c) => !c.perm || (Array.isArray(c.perm) ? can(...c.perm) : can(c.perm)),
  );

  // Gom trang theo danh mục (giữ thứ tự danh mục khai ở module, "Khác" cuối). Danh mục rỗng (không có
  // trang nào người này vào được) thì ẩn.
  const nhomDs = useMemo(() => {
    if (!module?.nhom) return null;
    const ds = [...module.nhom, KHAC].map((n) => ({ ...n, trang: items.filter((c) => (c.nhom || 'KHAC') === n.ma) }));
    return ds.filter((n) => n.trang.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, items.length]);

  const [tip, setTip] = useState(null); // tooltip tên đầy đủ khi rê chuột
  useEffect(() => { setTip(null); }, [pathname]);
  const maModule = module?.ma || '';
  const [mo, setMo] = useState(() => docNho(maModule));
  useEffect(() => { setMo(docNho(maModule)); }, [maModule]);
  const nhomDangMo = nhomDs ? (nhomDs.find((n) => n.trang.some((c) => laTrangDangMo(pathname, c.route))) || {}).ma : null;
  const batTat = (ma) => setMo((cu) => {
    const moi = new Set(cu);
    if (moi.has(ma)) moi.delete(ma); else moi.add(ma);
    ghiNho(maModule, moi);
    return moi;
  });

  const danhSach = (mini, onNavigate) => {
    if (!nhomDs) return items.map((c) => <MucTrang key={c.route} c={c} mini={mini} onNavigate={onNavigate} setTip={setTip} />);
    // Thu gọn (chỉ icon): danh sách phẳng, vạch ngăn giữa các danh mục.
    if (mini) {
      return nhomDs.map((n, i) => (
        <div key={n.ma} className={i ? 'mt-1 border-t border-line pt-1' : ''}>
          {n.trang.map((c) => <MucTrang key={c.route} c={c} mini onNavigate={onNavigate} setTip={setTip} />)}
        </div>
      ));
    }
    return nhomDs.map((n) => {
      const bung = mo.has(n.ma) || n.ma === nhomDangMo;
      return (
        <div key={n.ma}>
          <button
            type="button"
            onClick={() => batTat(n.ma)}
            onMouseEnter={(e) => hoiTooltip(e, n.ten, false, setTip)}
            onMouseLeave={() => setTip(null)}
            className={`flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold transition hover:bg-surface-muted ${
              n.ma === nhomDangMo ? 'text-ink' : 'text-ink-soft'
            }`}
            aria-expanded={bung}
          >
            <Icon name={n.icon} size={16} className="shrink-0" />
            <span data-ten className="flex-1 truncate">{n.ten}</span>
            <span className="text-[11px] font-medium tabular-nums text-ink-soft">{n.trang.length}</span>
            <Icon name="chevron-down" size={14} className={`shrink-0 transition-transform ${bung ? '' : '-rotate-90'}`} />
          </button>
          {bung && (
            <div className="mb-1 space-y-0.5">
              {n.trang.map((c) => <MucTrang key={c.route} c={c} mini={false} onNavigate={onNavigate} lui setTip={setTip} />)}
            </div>
          )}
        </div>
      );
    });
  };

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

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" onScroll={() => setTip(null)}>
        {danhSach(mini, onNavigate)}
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
      <TooltipTen tip={tip} />
    </>
  );
}
