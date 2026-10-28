import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Icon from '../common/Icon';
import SiSoTram from '../common/SiSoTram';
import { HangDauContext } from './HangDau';
import { SiSoLocProvider } from '../../hooks/useSiSoLoc';
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

  // KHE HÀNG ĐẦU (29/10/2026, `layout/HangDau.js`): trang đưa ô tìm / nút lên cùng hàng dải sĩ số. `dung` > 0 = đang có
  //   trang dùng khe ⇒ hàng thu gọn (ẩn breadcrumb dưới 2xl, bớt đệm trên) để trang còn nhiều chỗ cho bảng.
  const [khe, setKhe] = useState(null);
  const [dung, setDung] = useState(0);
  const hangDau = useMemo(() => ({ khe, setDung }), [khe]);

  return (
    // ⚠ `SiSoLocProvider` phải bọc CẢ dải sĩ số LẪN `<Outlet/>`: trang (trong Outlet) công bố bộ
    //   lọc, dải sĩ số (ngoài Outlet) đọc lại — 2 bên phải chung 1 provider.
    <SiSoLocProvider>
    <HangDauContext.Provider value={hangDau}>
    <div className="flex min-h-full flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar module={module} />
        <main className={`min-w-0 flex-1 overflow-x-hidden px-3 py-3 pb-24 sm:px-4 sm:py-4 md:px-6 lg:pb-6 ${dung ? 'md:py-3' : 'md:py-6'}`}>
          {/* Hàng điều hướng: breadcrumb bên trái — dải SĨ SỐ bám mép PHẢI, THẲNG HÀNG với nó.
              ⚠ Sĩ số render Ở ĐÂY chứ không trong từng trang: góc trên bên phải vốn bỏ trống, đặt
              vào đây thì không đụng gì tới bố cục Toolbar/bảng của 11 màn xác nhận.
              Màn nào có sĩ số khai bằng khóa `siSo` trong `constants/modules.js`. */}
          {/* Điện thoại (28/10/2026): dải sĩ số xuống HÀNG RIÊNG, cuộn ngang (trước đứng chung hàng tên trang ⇒ tràn). */}
          <div className={`flex flex-wrap items-center justify-between gap-2 md:flex-nowrap md:gap-3 ${dung ? 'mb-2' : 'mb-3 md:mb-4'}`}>
            <div className={`flex min-w-0 items-center gap-2 ${dung ? 'md:hidden 2xl:flex' : ''}`}>
              {/* Thanh mobile: nút mở menu + tên module */}
              <button onClick={() => dispatch(openMobileNav())}
                className="rounded-control border border-line p-2 text-ink-soft hover:bg-surface-muted md:hidden" aria-label="Mở menu">
                <Icon name="menu" size={20} />
              </button>
              <span className="truncate text-sm font-semibold text-ink md:hidden">{current?.ten || module?.ten}</span>

              <nav className={`hidden shrink-0 items-center gap-1.5 text-sm text-ink-soft ${dung ? '2xl:flex' : 'md:flex'}`}>
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
            {/* Khe hàng đầu — trang nào dùng `<HangDau>` thì nội dung portal vào đây (giữa breadcrumb và dải sĩ số). */}
            <div ref={setKhe} className={dung ? 'flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-1' : 'hidden'} />
            {current?.siSo && (
              <div className="w-full min-w-0 overflow-x-auto md:w-auto md:shrink-0 md:overflow-visible">
                {/* ⚠⚠ `key={current.siSo}` — ĐỔI TRANG PHẢI DỰNG LẠI DẢI (fix 21/08/2026): `ModuleLayout`
                    KHÔNG unmount khi đi giữa các trang cùng module, nên `SiSoTram` giữ nguyên state
                    ⇒ chọn khoảng ngày ở màn này rồi sang màn khác vẫn **dính ngày cũ**, người dùng
                    tưởng số liệu sai. Có `key` thì mỗi màn bắt đầu lại ở NGÀY HÔM NAY (và đóng luôn
                    modal đang mở của màn trước). */}
                <SiSoTram key={current.siSo} maTrang={current.siSo} />
              </div>
            )}
          </div>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
    </HangDauContext.Provider>
    </SiSoLocProvider>
  );
}
