import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import { selectTheme } from './store/uiSlice';
import ProtectedRoute from './routes/ProtectedRoute';
import RequirePermission from './routes/RequirePermission';
import ScrollToTop from './components/common/ScrollToTop';
import PortalLayout from './components/layout/PortalLayout';
import ModuleLayout from './components/layout/ModuleLayout';
import LoginPage from './features/auth/pages/LoginPage';
import HomePortal from './features/home/pages/HomePortal';
import PlaceholderPage from './features/common/PlaceholderPage';
import { MODULES } from './constants/modules';
import taiLuoi from './utils/taiLuoi';

// Mỗi trang 1 file JS riêng, chỉ tải khi mở (`utils/taiLuoi.js`). Đăng nhập + Trang chủ nằm trong file chính cho lần vào đầu nhanh.
const ProfilePage = taiLuoi(() => import('./features/profile/pages/ProfilePage'));
const UsersPage = taiLuoi(() => import('./features/system/pages/UsersPage'));
const PhongBanPage = taiLuoi(() => import('./features/system/pages/PhongBanPage'));
const RolesPage = taiLuoi(() => import('./features/system/pages/RolesPage'));
const PermissionsPage = taiLuoi(() => import('./features/system/pages/PermissionsPage'));
const ModulesPage = taiLuoi(() => import('./features/system/pages/ModulesPage'));
const WorkflowVersionPage = taiLuoi(() => import('./features/system/pages/WorkflowVersionPage'));
const ChuyenPage = taiLuoi(() => import('./features/system/pages/ChuyenPage'));
const TramCheckpointPage = taiLuoi(() => import('./features/system/pages/TramCheckpointPage'));
const DieuKienPage = taiLuoi(() => import('./features/system/pages/DieuKienPage'));
const OwnerPage = taiLuoi(() => import('./features/system/pages/OwnerPage'));
const TrangThaiPage = taiLuoi(() => import('./features/system/pages/TrangThaiPage'));
const LichSuTrangThaiPage = taiLuoi(() => import('./features/system/pages/LichSuTrangThaiPage'));
const ErpSyncPage = taiLuoi(() => import('./features/system/pages/ErpSyncPage'));
const OnlineUsersPage = taiLuoi(() => import('./features/system/pages/OnlineUsersPage'));
const ActivityLogPage = taiLuoi(() => import('./features/system/pages/ActivityLogPage'));
const PhienDangNhapPage = taiLuoi(() => import('./features/system/pages/PhienDangNhapPage'));
const FormTemplatesPage = taiLuoi(() => import('./features/system/pages/FormTemplatesPage'));
const ThietKeTemPage = taiLuoi(() => import('./features/system/pages/ThietKeTemPage'));
const ThietKePhieuPage = taiLuoi(() => import('./features/system/pages/ThietKePhieuPage'));
const QuanTriPhanInPage = taiLuoi(() => import('./features/system/pages/QuanTriPhanInPage'));
const BtpKhacKeHoachPage = taiLuoi(() => import('./features/system/pages/BtpKhacKeHoachPage'));
const HienThiPainPage = taiLuoi(() => import('./features/system/pages/HienThiPainPage'));
const TinhChatInPage = taiLuoi(() => import('./features/system/pages/TinhChatInPage'));
const DanhMucKiengPage = taiLuoi(() => import('./features/system/pages/DanhMucKiengPage'));
const CaiDatApiPage = taiLuoi(() => import('./features/system/pages/CaiDatApiPage'));
const CaiDatTinhNangPage = taiLuoi(() => import('./features/system/pages/CaiDatTinhNangPage'));
const DuyetPage = taiLuoi(() => import('./features/duyet/pages/DuyetPage'));
const CaiDatThongBaoPage = taiLuoi(() => import('./features/system/pages/CaiDatThongBaoPage'));
const NotificationsPage = taiLuoi(() => import('./features/notifications/pages/NotificationsPage'));
const ToInPage = taiLuoi(() => import('./features/system/pages/ToInPage'));
const KhachHangPage = taiLuoi(() => import('./features/system/pages/KhachHangPage'));
const TichGiaoPage = taiLuoi(() => import('./features/system/pages/TichGiaoPage'));
const ManualEntryPage = taiLuoi(() => import('./features/system/pages/ManualEntryPage'));
const VaiVeUpdatePage = taiLuoi(() => import('./features/system/pages/VaiVeUpdatePage'));
const PhanInListPage = taiLuoi(() => import('./features/orders/pages/PhanInListPage'));
const SuaThongTinPage = taiLuoi(() => import('./features/orders/pages/SuaThongTinPage'));
const ReadyPage = taiLuoi(() => import('./features/technical-ready/pages/ReadyPage'));
const HoSoKyThuatPage = taiLuoi(() => import('./features/technical-ready/pages/HoSoKyThuatPage'));
const GomSetPage = taiLuoi(() => import('./features/technical-ready/pages/GomSetPage'));
const TaoDotSanXuatPage = taiLuoi(() => import('./features/planning/pages/TaoDotSanXuatPage'));
const CaiDatPage = taiLuoi(() => import('./features/planning/pages/CaiDatPage'));
const Release1Page = taiLuoi(() => import('./features/planning/pages/Release1Page'));
const Release2Page = taiLuoi(() => import('./features/planning/pages/Release2Page'));
const ReplanPage = taiLuoi(() => import('./features/planning/pages/ReplanPage'));
const GiaCongPage = taiLuoi(() => import('./features/planning/pages/GiaCongPage'));
const DanhSachTemGiaCongPage = taiLuoi(() => import('./features/planning/pages/DanhSachTemGiaCongPage'));
const KeHoachTamPage = taiLuoi(() => import('./features/planning/pages/KeHoachTamPage'));
const TestRunPage = taiLuoi(() => import('./features/planning/pages/TestRunPage'));
const XacNhanChayPage = taiLuoi(() => import('./features/production/pages/XacNhanChayPage'));
const DanhMucSanXuatPage = taiLuoi(() => import('./features/production/pages/DanhMucSanXuatPage'));
const BaoCaoSanXuatPage = taiLuoi(() => import('./features/production/pages/BaoCaoSanXuatPage'));
const BaoCaoDungChuyenPage = taiLuoi(() => import('./features/production/pages/BaoCaoDungChuyenPage'));
const BaoCaoKiemHangPage = taiLuoi(() => import('./features/production/pages/BaoCaoKiemHangPage'));
const BaoCaoSuaHangPage = taiLuoi(() => import('./features/production/pages/BaoCaoSuaHangPage'));
const BaoCaoPhanLoaiLoiPage = taiLuoi(() => import('./features/production/pages/BaoCaoPhanLoaiLoiPage'));
const ReadyQcPage = taiLuoi(() => import('./features/quality/pages/ReadyQcPage'));
const KcsPage = taiLuoi(() => import('./features/quality/pages/KcsPage'));
const SuaPage = taiLuoi(() => import('./features/quality/pages/SuaPage'));
const OqcPage = taiLuoi(() => import('./features/quality/pages/OqcPage'));
const QcInlinePage = taiLuoi(() => import('./features/quality/pages/QcInlinePage'));
const LoaiLoiPage = taiLuoi(() => import('./features/quality/pages/LoaiLoiPage'));
const PhanLoaiLoiPage = taiLuoi(() => import('./features/production/pages/PhanLoaiLoiPage'));
const GiaoDacBietPage = taiLuoi(() => import('./features/quality/pages/GiaoDacBietPage'));
const QcTraVePage = taiLuoi(() => import('./features/quality/pages/QcTraVePage'));
const GiaoHangPage = taiLuoi(() => import('./features/delivery/pages/GiaoHangPage'));
const DashboardPage = taiLuoi(() => import('./features/dashboard/pages/DashboardPage'));
const LichSuNghenPage = taiLuoi(() => import('./features/dashboard/pages/LichSuNghenPage'));
const ThoiGianTramPage = taiLuoi(() => import('./features/dashboard/pages/ThoiGianTramPage'));
const TinhTrangTramPage = taiLuoi(() => import('./features/dashboard/pages/TinhTrangTramPage'));
const KpiReadyPage = taiLuoi(() => import('./features/dashboard/pages/KpiReadyPage'));
const KpiDonHangPage = taiLuoi(() => import('./features/system/pages/KpiDonHangPage'));
const MyReportsPage = taiLuoi(() => import('./features/reports/pages/MyReportsPage'));
const ReportDesignerPage = taiLuoi(() => import('./features/reports/pages/ReportDesignerPage'));
const ReportByDeptPage = taiLuoi(() => import('./features/reports/pages/ReportByDeptPage'));

// Màn hình đã hiện thực. Route khác dùng PlaceholderPage.
const PAGES = {
  '/don-hang/phan-in': <PhanInListPage />,
  '/don-hang/cho-sua-thong-tin': <SuaThongTinPage />,
  '/ky-thuat/ready': <ReadyPage />,
  '/ky-thuat/ho-so-ky-thuat': <HoSoKyThuatPage />,
  '/ky-thuat/gom-set': <GomSetPage />,
  '/ke-hoach/tao-dot-san-xuat': <TaoDotSanXuatPage />,
  '/ke-hoach/cai-dat': <CaiDatPage />,
  '/ke-hoach/release-1': <Release1Page />,
  '/ke-hoach/release-2': <Release2Page />,
  '/ke-hoach/lap-lai': <ReplanPage />,
  '/ke-hoach/gia-cong': <GiaCongPage />,
  '/ke-hoach/danh-sach-tem': <DanhSachTemGiaCongPage />,
  '/ke-hoach/ke-hoach-tam': <KeHoachTamPage />,
  '/chat-luong/test-run': <TestRunPage />,
  '/san-xuat/xac-nhan-chay': <XacNhanChayPage />,
  '/san-xuat/danh-muc': <DanhMucSanXuatPage />,
  '/san-xuat/bao-cao': <BaoCaoSanXuatPage />,
  '/san-xuat/bao-cao-dung-chuyen': <BaoCaoDungChuyenPage />,
  '/san-xuat/bao-cao-kiem-hang': <BaoCaoKiemHangPage />,
  '/san-xuat/bao-cao-sua-hang': <BaoCaoSuaHangPage />,
  '/san-xuat/bao-cao-phan-loai-loi': <BaoCaoPhanLoaiLoiPage />,
  '/san-xuat/kcs': <KcsPage />,
  '/san-xuat/sua': <SuaPage />,
  '/san-xuat/phan-loai-loi': <PhanLoaiLoiPage />,
  // Danh mục lỗi dùng CHUNG component với trang ở module Chất lượng — 1 nguồn, 2 lối vào.
  '/chat-luong/ready-qc': <ReadyQcPage />,
  '/chat-luong/qc-in-line': <QcInlinePage />,
  '/chat-luong/oqc': <OqcPage />,
  '/chat-luong/danh-muc-loi': <LoaiLoiPage />,
  '/chat-luong/giao-dac-biet': <GiaoDacBietPage />,
  '/chat-luong/qc-tra-ve': <QcTraVePage />,
  '/giao-hang': <GiaoHangPage />,
  '/dashboard': <DashboardPage />,
  '/dashboard/lich-su-nghen': <LichSuNghenPage />,
  '/dashboard/thoi-gian-tram': <ThoiGianTramPage />,
  '/dashboard/tinh-trang-tram': <TinhTrangTramPage />,
  '/dashboard/kpi-ready': <KpiReadyPage />,
  '/bao-cao': <MyReportsPage />,
  '/bao-cao/phong-ban': <ReportByDeptPage />,
  '/he-thong/nguoi-dung': <UsersPage />,
  '/he-thong/phong-ban': <PhongBanPage />,
  '/he-thong/vai-tro': <RolesPage />,
  '/he-thong/permission': <PermissionsPage />,
  '/he-thong/module': <ModulesPage />,
  '/he-thong/workflow-version': <WorkflowVersionPage />,
  '/he-thong/tram-checkpoint': <TramCheckpointPage />,
  '/he-thong/chuyen': <ChuyenPage />,
  '/he-thong/dieu-kien': <DieuKienPage />,
  '/he-thong/owner': <OwnerPage />,
  '/he-thong/kpi-don-hang': <KpiDonHangPage />,
  '/he-thong/trang-thai': <TrangThaiPage />,
  '/he-thong/lich-su-trang-thai': <LichSuTrangThaiPage />,
  '/he-thong/erp-sync': <ErpSyncPage />,
  '/he-thong/nhap-tay': <ManualEntryPage />,
  '/he-thong/cap-nhat-vai': <VaiVeUpdatePage />,
  '/he-thong/online': <OnlineUsersPage />,
  '/he-thong/phien-dang-nhap': <PhienDangNhapPage />,
  '/he-thong/nhat-ky': <ActivityLogPage />,
  '/he-thong/mau-form': <FormTemplatesPage />,
  '/he-thong/thiet-ke-tem': <ThietKeTemPage />,
  '/he-thong/thiet-ke-phieu': <ThietKePhieuPage />,
  '/he-thong/quan-tri-phan-in': <QuanTriPhanInPage />,
  '/he-thong/btp-khac-ke-hoach': <BtpKhacKeHoachPage />,
  '/he-thong/hien-thi-pain': <HienThiPainPage />,
  '/he-thong/tinh-chat-in': <TinhChatInPage />,
  '/he-thong/danh-muc-kieng': <DanhMucKiengPage />,
  '/he-thong/cai-dat-api': <CaiDatApiPage />,
  '/he-thong/cai-dat-tinh-nang': <CaiDatTinhNangPage />,
  '/duyet': <DuyetPage />,
  '/he-thong/cai-dat-thong-bao': <CaiDatThongBaoPage />,
  '/he-thong/to-in': <ToInPage />,
  '/he-thong/khach-hang': <KhachHangPage />,
  '/he-thong/tich-giao': <TichGiaoPage />,
};

// Route CŨ của module Sản xuất đã gộp trang (24/09/2026) — chuyển hướng để link/bookmark cũ vẫn vào được.
const ROUTE_CU = {
  '/san-xuat/theo-doi-chuyen': '/san-xuat/xac-nhan-chay?mo=theo-doi-chuyen',
  '/san-xuat/xe-phoi': '/san-xuat/xac-nhan-chay?mo=xe-phoi',
  '/san-xuat/danh-sach-tem': '/san-xuat/danh-muc?tab=tem',
  '/san-xuat/danh-muc-loi': '/san-xuat/danh-muc?tab=loi',
  '/san-xuat/bien-phap': '/san-xuat/danh-muc?tab=bien-phap',
  '/san-xuat/ly-do-ngung': '/san-xuat/danh-muc?tab=ly-do-ngung',
  '/san-xuat/ly-do-bo-sung': '/san-xuat/danh-muc?tab=ly-do-bo-sung',
};

const moduleRoutes = MODULES.flatMap((m) =>
  (m.children || []).map((c) => {
    const element = PAGES[c.route] || <PlaceholderPage title={c.ten} phase={`Module ${m.ten}`} />;
    return (
      <Route
        key={c.route}
        path={c.route}
        element={c.perm ? <RequirePermission anyOf={Array.isArray(c.perm) ? c.perm : [c.perm]}>{element}</RequirePermission> : element}
      />
    );
  })
);

export default function App() {
  const theme = useSelector(selectTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PortalLayout />}>
          <Route index path="/" element={<HomePortal />} />
          <Route path="/thong-tin-ca-nhan" element={<ProfilePage />} />
          {/* Trang Thông báo (mig 085) — vào từ nút "Xem thêm" của chuông, KHÔNG nằm trong menu
              module nào. Không khai `perm`: người ngoài diện nhận vẫn mở được nhưng thấy rỗng,
              đúng cách cái chuông tự ẩn. */}
          <Route path="/thong-bao" element={<NotificationsPage />} />
        </Route>

        <Route element={<ModuleLayout />}>
          {moduleRoutes}
          {Object.entries(ROUTE_CU).map(([tu, den]) => <Route key={tu} path={tu} element={<Navigate to={den} replace />} />)}
          {/* Route có tham số (không nằm trong menu) */}
          <Route path="/bao-cao/thiet-ke/:id"
            element={<RequirePermission anyOf={['BAOCAO_VIEW']}><ReportDesignerPage /></RequirePermission>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
