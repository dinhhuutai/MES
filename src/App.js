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
import ProfilePage from './features/profile/pages/ProfilePage';
import PlaceholderPage from './features/common/PlaceholderPage';
import UsersPage from './features/system/pages/UsersPage';
import RolesPage from './features/system/pages/RolesPage';
import PermissionsPage from './features/system/pages/PermissionsPage';
import ModulesPage from './features/system/pages/ModulesPage';
import WorkflowVersionPage from './features/system/pages/WorkflowVersionPage';
import ChuyenPage from './features/system/pages/ChuyenPage';
import TramCheckpointPage from './features/system/pages/TramCheckpointPage';
import DieuKienPage from './features/system/pages/DieuKienPage';
import OwnerPage from './features/system/pages/OwnerPage';
import TrangThaiPage from './features/system/pages/TrangThaiPage';
import LichSuTrangThaiPage from './features/system/pages/LichSuTrangThaiPage';
import ErpSyncPage from './features/system/pages/ErpSyncPage';
import OnlineUsersPage from './features/system/pages/OnlineUsersPage';
import ActivityLogPage from './features/system/pages/ActivityLogPage';
import FormTemplatesPage from './features/system/pages/FormTemplatesPage';
import PhanInListPage from './features/orders/pages/PhanInListPage';
import ReadyPage from './features/technical-ready/pages/ReadyPage';
import TestRunCnspPage from './features/technical-ready/pages/TestRunCnspPage';
import GomSetPage from './features/technical-ready/pages/GomSetPage';
import KeHoachTuDongPage from './features/planning/pages/KeHoachTuDongPage';
import CaiDatPage from './features/planning/pages/CaiDatPage';
import Release1Page from './features/planning/pages/Release1Page';
import Release2Page from './features/planning/pages/Release2Page';
import ReplanPage from './features/planning/pages/ReplanPage';
import TestRunPage from './features/planning/pages/TestRunPage';
import XacNhanChayPage from './features/production/pages/XacNhanChayPage';
import TheoDoiChuyenPage from './features/production/pages/TheoDoiChuyenPage';
import XePhoiPage from './features/production/pages/XePhoiPage';
import ReadyQcPage from './features/quality/pages/ReadyQcPage';
import KcsPage from './features/quality/pages/KcsPage';
import SuaPage from './features/quality/pages/SuaPage';
import OqcPage from './features/quality/pages/OqcPage';
import QcInlinePage from './features/quality/pages/QcInlinePage';
import LoaiLoiPage from './features/quality/pages/LoaiLoiPage';
import GiaoDacBietPage from './features/quality/pages/GiaoDacBietPage';
import QcTraVePage from './features/quality/pages/QcTraVePage';
import GiaoHangPage from './features/delivery/pages/GiaoHangPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import TinhTrangTramPage from './features/dashboard/pages/TinhTrangTramPage';
import MyReportsPage from './features/reports/pages/MyReportsPage';
import ReportDesignerPage from './features/reports/pages/ReportDesignerPage';
import ReportByDeptPage from './features/reports/pages/ReportByDeptPage';
import { MODULES } from './constants/modules';

// Màn hình đã hiện thực. Route khác dùng PlaceholderPage.
const PAGES = {
  '/don-hang/phan-in': <PhanInListPage />,
  '/ky-thuat/ready': <ReadyPage />,
  '/ky-thuat/gom-set': <GomSetPage />,
  '/ky-thuat/test-run-cnsp': <TestRunCnspPage />,
  '/ke-hoach/tu-dong': <KeHoachTuDongPage />,
  '/ke-hoach/cai-dat': <CaiDatPage />,
  '/ke-hoach/release-1': <Release1Page />,
  '/ke-hoach/release-2': <Release2Page />,
  '/ke-hoach/lap-lai': <ReplanPage />,
  '/chat-luong/test-run': <TestRunPage />,
  '/san-xuat/xac-nhan-chay': <XacNhanChayPage />,
  '/san-xuat/theo-doi-chuyen': <TheoDoiChuyenPage />,
  '/san-xuat/xe-phoi': <XePhoiPage />,
  '/san-xuat/kcs': <KcsPage />,
  '/san-xuat/sua': <SuaPage />,
  '/chat-luong/ready-qc': <ReadyQcPage />,
  '/chat-luong/qc-in-line': <QcInlinePage />,
  '/chat-luong/oqc': <OqcPage />,
  '/chat-luong/danh-muc-loi': <LoaiLoiPage />,
  '/chat-luong/giao-dac-biet': <GiaoDacBietPage />,
  '/chat-luong/qc-tra-ve': <QcTraVePage />,
  '/giao-hang': <GiaoHangPage />,
  '/dashboard': <DashboardPage />,
  '/dashboard/tinh-trang-tram': <TinhTrangTramPage />,
  '/bao-cao': <MyReportsPage />,
  '/bao-cao/phong-ban': <ReportByDeptPage />,
  '/he-thong/nguoi-dung': <UsersPage />,
  '/he-thong/vai-tro': <RolesPage />,
  '/he-thong/permission': <PermissionsPage />,
  '/he-thong/module': <ModulesPage />,
  '/he-thong/workflow-version': <WorkflowVersionPage />,
  '/he-thong/tram-checkpoint': <TramCheckpointPage />,
  '/he-thong/chuyen': <ChuyenPage />,
  '/he-thong/dieu-kien': <DieuKienPage />,
  '/he-thong/owner': <OwnerPage />,
  '/he-thong/trang-thai': <TrangThaiPage />,
  '/he-thong/lich-su-trang-thai': <LichSuTrangThaiPage />,
  '/he-thong/erp-sync': <ErpSyncPage />,
  '/he-thong/online': <OnlineUsersPage />,
  '/he-thong/nhat-ky': <ActivityLogPage />,
  '/he-thong/mau-form': <FormTemplatesPage />,
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
        </Route>

        <Route element={<ModuleLayout />}>
          {moduleRoutes}
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
