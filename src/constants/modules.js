// Cấu trúc 9 module + menu con. `perm` = quyền tối thiểu để thấy/ vào.
// P0 hardcode khớp seed bảng `module`; P6 sẽ nạp động từ API /modules.
export const MODULES = [
  {
    ma: 'DON_HANG',
    ten: 'Đơn hàng',
    icon: 'package',
    base: '/don-hang',
    perm: 'ORDER_VIEW',
    mau: 'bg-blue-50 text-blue-600',
    children: [
      { ten: 'Danh sách phần in vải về', route: '/don-hang/phan-in', perm: 'ORDER_VIEW' },
    ],
  },
  {
    ma: 'KY_THUAT',
    ten: 'Chuẩn bị kỹ thuật',
    icon: 'wrench',
    base: '/ky-thuat',
    perm: 'READY_VIEW',
    mau: 'bg-amber-50 text-amber-600',
    children: [
      { ten: 'Xác nhận READY', route: '/ky-thuat/ready', perm: 'READY_VIEW', siSo: 'KT_READY' },
      { ten: 'Hồ sơ kỹ thuật', route: '/ky-thuat/ho-so-ky-thuat', perm: 'READY_VIEW' },
      { ten: 'Gom set', route: '/ky-thuat/gom-set', perm: 'READY_GOMSET' },
      // Test Run - CNSP đã GỘP về màn Test Run QA (điểm 11) — bỏ menu.
    ],
  },
  {
    ma: 'KE_HOACH',
    ten: 'Kế hoạch',
    icon: 'calendar-days',
    base: '/ke-hoach',
    perm: 'RELEASE1',
    mau: 'bg-violet-50 text-violet-600',
    children: [
      { ten: 'Tạo đợt sản xuất', route: '/ke-hoach/tao-dot-san-xuat', perm: 'RELEASE1' },
      { ten: 'Release 1', route: '/ke-hoach/release-1', perm: 'RELEASE1', siSo: 'KH_RELEASE1' },
      { ten: 'Release 2', route: '/ke-hoach/release-2', perm: 'RELEASE2', siSo: 'KH_RELEASE2' },
      { ten: 'Gia công', route: '/ke-hoach/gia-cong', perm: ['RELEASE1', 'RELEASE2'], siSo: 'KH_GIA_CONG' },
      { ten: 'Kế hoạch tạm', route: '/ke-hoach/ke-hoach-tam', perm: ['RELEASE1', 'RELEASE2'] },
      { ten: 'Lập kế hoạch lại', route: '/ke-hoach/lap-lai', perm: 'RELEASE2' },
      { ten: 'Cài đặt', route: '/ke-hoach/cai-dat', perm: ['RELEASE1', 'RELEASE2'] },
    ],
  },
  {
    ma: 'SAN_XUAT',
    ten: 'Sản xuất',
    icon: 'factory',
    base: '/san-xuat',
    perm: 'PROD_MONITOR',
    mau: 'bg-emerald-50 text-emerald-600',
    children: [
      { ten: 'Xác nhận chạy', route: '/san-xuat/xac-nhan-chay', perm: 'PROD_RUN', siSo: 'SX_CHO_CHAY' },
      { ten: 'Theo dõi chuyền', route: '/san-xuat/theo-doi-chuyen', perm: 'PROD_MONITOR' },
      { ten: 'Tình trạng xe phơi', route: '/san-xuat/xe-phoi', perm: 'XEPHOI' },
      { ten: 'KCS', route: '/san-xuat/kcs', perm: 'KCS', siSo: 'SX_KCS' },
      { ten: 'Phân loại lỗi', route: '/san-xuat/phan-loai-loi', perm: ['PHAN_LOAI_LOI', 'KCS'] },
      { ten: 'Sửa', route: '/san-xuat/sua', perm: 'SUA', siSo: 'SX_SUA' },
      // 2 trang DANH MỤC đặt cuối module (dưới Sửa) — là màn cấu hình, không phải màn thao tác
      // hằng ngày. "Danh mục lỗi" dùng CHUNG component với trang bên Chất lượng: 1 nguồn, 2 lối vào.
      { ten: 'Danh mục lỗi', route: '/san-xuat/danh-muc-loi', perm: 'LOI_MANAGE' },
      { ten: 'Danh mục biện pháp xử lý', route: '/san-xuat/bien-phap', perm: 'BIEN_PHAP_MANAGE' },
      { ten: 'Danh mục lý do ngừng chuyền', route: '/san-xuat/ly-do-ngung', perm: 'LY_DO_NGUNG_MANAGE' },
      { ten: 'Danh mục lý do bổ sung', route: '/san-xuat/ly-do-bo-sung', perm: 'LY_DO_BO_SUNG_MANAGE' },
    ],
  },
  {
    ma: 'CHAT_LUONG',
    ten: 'Chất lượng',
    icon: 'shield-check',
    base: '/chat-luong',
    perm: 'TESTRUN_QA',
    mau: 'bg-teal-50 text-teal-600',
    children: [
      { ten: 'QC chuẩn bị kỹ thuật', route: '/chat-luong/ready-qc', perm: 'READY_QC', siSo: 'CL_QC_READY' },
      { ten: 'Test Run - QA', route: '/chat-luong/test-run', perm: 'TESTRUN_QA', siSo: 'CL_TEST_RUN' },
      { ten: 'QC in line', route: '/chat-luong/qc-in-line', perm: 'QC_INLINE' },
      { ten: 'OQC', route: '/chat-luong/oqc', perm: 'OQC', siSo: 'CL_OQC' },
      { ten: 'Lịch sử QC trả về', route: '/chat-luong/qc-tra-ve', perm: 'QC_TRAVE_VIEW' },
      { ten: 'Danh mục lỗi', route: '/chat-luong/danh-muc-loi', perm: 'LOI_MANAGE' },
      { ten: 'Trường hợp giao đặc biệt', route: '/chat-luong/giao-dac-biet', perm: 'GIAODB_MANAGE' },
    ],
  },
  {
    ma: 'GIAO_HANG',
    ten: 'Giao hàng',
    icon: 'truck',
    base: '/giao-hang',
    perm: 'DELIVERY_VIEW',
    mau: 'bg-orange-50 text-orange-600',
    children: [{ ten: 'Phiếu giao', route: '/giao-hang', perm: 'DELIVERY_VIEW', siSo: 'GH_TEM' }],
  },
  {
    ma: 'DASHBOARD',
    ten: 'Dashboard',
    icon: 'layout-dashboard',
    base: '/dashboard',
    mau: 'bg-sky-50 text-sky-600',
    children: [
      { ten: 'Tổng quan', route: '/dashboard' },
      { ten: 'Lịch sử nghẽn', route: '/dashboard/lich-su-nghen' },
      { ten: 'Sơ đồ phần in', route: '/dashboard/tinh-trang-tram' },
    ],
  },
  {
    ma: 'BAO_CAO',
    ten: 'Báo cáo',
    icon: 'file-bar-chart',
    base: '/bao-cao',
    mau: 'bg-indigo-50 text-indigo-600',
    children: [
      { ten: 'Báo cáo của tôi', route: '/bao-cao', perm: 'BAOCAO_VIEW' },
      { ten: 'Báo cáo phòng ban', route: '/bao-cao/phong-ban', perm: 'BAOCAO_VIEW' },
    ],
  },
  {
    ma: 'HE_THONG',
    ten: 'Hệ thống',
    icon: 'settings',
    base: '/he-thong',
    perm: 'USER_VIEW',
    mau: 'bg-slate-100 text-slate-600',
    children: [
      { ten: 'Người dùng', route: '/he-thong/nguoi-dung', perm: 'USER_VIEW' },
      { ten: 'Vai trò', route: '/he-thong/vai-tro', perm: 'ROLE_VIEW' },
      { ten: 'Permission', route: '/he-thong/permission', perm: 'PERM_VIEW' },
      { ten: 'Module', route: '/he-thong/module', perm: 'MODULE_VIEW' },
      { ten: 'Workflow version', route: '/he-thong/workflow-version', perm: 'WORKFLOW_VIEW' },
      { ten: 'Chuyền sản xuất', route: '/he-thong/chuyen', perm: 'WORKFLOW_VIEW' },
      { ten: 'Checkpoint & Checklist', route: '/he-thong/tram-checkpoint', perm: 'WORKFLOW_VIEW' },
      { ten: 'Điều kiện chuyển checkpoint', route: '/he-thong/dieu-kien', perm: 'WORKFLOW_VIEW' },
      { ten: 'Owner checkpoint/checklist', route: '/he-thong/owner', perm: 'WORKFLOW_VIEW' },
      { ten: 'Trạng thái', route: '/he-thong/trang-thai', perm: 'STATUS_VIEW' },
      { ten: 'Hủy lệnh xác nhận', route: '/he-thong/lich-su-trang-thai', perm: ['READY_CANCEL', 'RELEASE1', 'RELEASE2', 'PROD_RUN', 'KCS', 'SUA', 'OQC', 'LENH_CANCEL_ANY'] },
      { ten: 'Đồng bộ ERP', route: '/he-thong/erp-sync', perm: 'ERP_SYNC' },
      { ten: 'Nhập tay đơn → đợt vải', route: '/he-thong/nhap-tay', perm: 'ERP_SYNC' },
      { ten: 'Cập nhật SL nhận vải / release', route: '/he-thong/cap-nhat-vai', perm: 'ERP_SYNC' },
      { ten: 'Mẫu form (tem/phiếu)', route: '/he-thong/mau-form', perm: 'WORKFLOW_VIEW' },
      // Thiết kế tem (mig 073) — quyền riêng TEM_DESIGN, lúc đầu chỉ admin (role ADMIN có '*').
      { ten: 'Thiết kế tem', route: '/he-thong/thiet-ke-tem', perm: 'TEM_DESIGN' },
      // Quản trị phần in (mig 078) — trang GỠ RỐI: sửa dữ liệu gốc + đặt lại giai đoạn theo đợt vải.
      // Quyền riêng PHAN_IN_ADMIN, cấp hẹp (role ADMIN có '*' nên dùng được ngay).
      { ten: 'Quản trị phần in', route: '/he-thong/quan-tri-phan-in', perm: 'PHAN_IN_ADMIN' },
      { ten: 'Hiển thị theo phương án in', route: '/he-thong/hien-thi-pain', perm: 'WORKFLOW_VIEW' },
      // Cài đặt API (mig 083) — bật/tắt 3 API ERP ngay trên giao diện, khỏi sửa .env + restart BE.
      { ten: 'Cài đặt API', route: '/he-thong/cai-dat-api', perm: 'WORKFLOW_VIEW' },
      // Danh mục TỔ IN (mig 084) — mã tổ gửi thẳng lên ERP qua `@pToin` mỗi lần in tem.
      { ten: 'Danh mục tổ in', route: '/he-thong/to-in', perm: 'TO_IN_MANAGE' },
      { ten: 'Người dùng online', route: '/he-thong/online', perm: 'PRESENCE_VIEW' },
      // Phiên đăng nhập theo THIẾT BỊ (mig 081): xem 1 tài khoản đang đăng nhập ở những máy nào và
      // đăng xuất máy không dùng nữa. Xem chỉ cần PRESENCE_VIEW; đăng xuất người KHÁC cần PHIEN_MANAGE.
      { ten: 'Phiên đăng nhập', route: '/he-thong/phien-dang-nhap', perm: ['PRESENCE_VIEW', 'PHIEN_MANAGE'] },
      { ten: 'Nhật ký thao tác', route: '/he-thong/nhat-ky', perm: 'PRESENCE_VIEW' },
    ],
  },
];

export const findModuleByPath = (pathname) =>
  MODULES.find((m) => pathname === m.base || pathname.startsWith(m.base + '/')) || null;

// Quyền của 1 mục menu (chuỗi hoặc mảng) → mảng.
const permList = (p) => (Array.isArray(p) ? p : (p ? [p] : []));

// CÓ ĐƯỢC VÀO MODULE KHÔNG = có quyền cấp module **HOẶC** vào được ÍT NHẤT 1 trang con.
// ⚠ Trước đây Home Portal chỉ xét `m.perm` cấp module, nên vd module "Hệ thống" đòi `USER_VIEW`:
// người chỉ được cấp 1 quyền lẻ (vd `LENH_CANCEL_ANY` để hủy lệnh) KHÔNG thấy module đâu mà vào,
// mà cấp thêm `USER_VIEW` thì lại mở luôn trang Người dùng — thừa quyền. Xét theo trang con thì
// chỉ cần cấp đúng quyền của trang đó: module hiện ra, và Sidebar vốn đã lọc nên CHỈ thấy trang ấy.
// Trang con ĐẦU TIÊN người dùng vào được (đích khi bấm ô module ở Home Portal).
export const trangDauTien = (m, can) => {
  const c = (m?.children || []).find((x) => {
    const cp = permList(x.perm);
    return cp.length === 0 || can(...cp);
  });
  return c ? c.route : (m?.children?.[0]?.route || m?.base);
};

export const coTheVaoModule = (m, can) => {
  if (!m) return false;
  const mp = permList(m.perm);
  if (mp.length && can(...mp)) return true;
  const children = m.children || [];
  // Module không khai quyền và không có trang con nào khai quyền → ai cũng vào được (giữ như cũ).
  if (!mp.length && children.every((c) => permList(c.perm).length === 0)) return true;
  return children.some((c) => {
    const cp = permList(c.perm);
    return cp.length === 0 ? false : can(...cp);
  });
};
