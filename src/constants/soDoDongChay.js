// SƠ ĐỒ DÒNG CHẢY (nút giữa thanh đầu trang, 21/10/2026 — người dùng yêu cầu).
// Mỗi trạm: tên · việc · phòng phụ trách · NGUỒN OWNER (trạm `tram` và/hoặc checklist `checklist` của trang
// *Hệ thống › Owner checkpoint / checklist*, workflow hiện hành) · các ROUTE thuộc trạm đó (đánh dấu "đang ở đây").
// Nút chỉ hiện ở trang có route nằm trong danh sách — trang xác nhận của dòng chảy. Thêm trang mới vào dòng chảy ⇒
// thêm route vào đúng trạm ở đây.
// `con`: checklist con hiện thành dòng nhỏ (vd Film / Khuôn / Mực của Ready kỹ thuật).
export const TRAM_SO_DO = [
  { ma: 'DOT_VAI', ten: 'Đợt vải về', viec: 'Phần in lên MES', phong: 'Phòng bán hàng',
    checklist: ['DOT_VAI'], routes: ['/don-hang/phan-in'] },
  { ma: 'READY_KT', ten: 'Ready kỹ thuật', viec: 'Xác nhận Film · Khuôn · Mực', phong: 'Phòng kỹ thuật',
    tram: 'READY', con: [['FILM', 'Film'], ['KHUON', 'Khuôn'], ['MUC', 'Mực']], routes: ['/ky-thuat/ready'] },
  { ma: 'READY_QC', ten: 'Ready IQC', viec: 'QC xác nhận Ready', phong: 'Phòng QC',
    checklist: ['QC_XAC_NHAN'], routes: ['/chat-luong/ready-qc'] },
  { ma: 'RELEASE_1', ten: 'Release 1', viec: 'Lập kế hoạch sản xuất', phong: 'Phòng kế hoạch',
    tram: 'RELEASE_1', routes: ['/ke-hoach/release-1', '/ke-hoach/ke-hoach-tam', '/ke-hoach/tao-dot-san-xuat', '/ke-hoach/lap-lai'] },
  { ma: 'TEST_RUN', ten: 'Test run', viec: 'QA test in', phong: 'Phòng QC',
    tram: 'TEST_RUN', checklist: ['TEST_QA', 'TEST_CNSP'], routes: ['/chat-luong/test-run'] },
  { ma: 'RELEASE_2', ten: 'Release 2', viec: 'Xác nhận cho in', phong: 'Phòng kế hoạch',
    tram: 'RELEASE_2', routes: ['/ke-hoach/release-2'] },
  { ma: 'SAN_XUAT', ten: 'Sản xuất', viec: 'Xác nhận chạy · in tem', phong: 'Sản xuất',
    tram: 'SAN_XUAT', routes: ['/san-xuat/xac-nhan-chay'] },
  { ma: 'CHO_KHO', ten: 'Chờ khô', viec: 'Xe phơi', phong: 'Sản xuất', tram: 'CHO_KHO', routes: [] },
  { ma: 'KIEM', ten: 'KCS', viec: 'Kiểm hàng · phân loại lỗi', phong: 'KCS',
    tram: 'KIEM', routes: ['/san-xuat/kcs', '/san-xuat/phan-loai-loi'] },
  { ma: 'SUA', ten: 'Sửa', viec: 'Sửa hàng lỗi', phong: 'KCS', tram: 'SUA', routes: ['/san-xuat/sua'] },
  { ma: 'OQC', ten: 'OQC', viec: 'Kiểm bốc mẫu trước giao', phong: 'Phòng QC', tram: 'OQC', routes: ['/chat-luong/oqc'] },
  { ma: 'GIAO', ten: 'Giao hàng', viec: 'Tích tem · in phiếu giao', phong: 'Phòng bán hàng',
    tram: 'DONE_DELIVERY', routes: ['/giao-hang'] },
];

// Trạm của trang đang mở (null ⇒ trang không thuộc dòng chảy ⇒ không hiện nút).
export function tramCuaTrang(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '');
  return TRAM_SO_DO.find((t) => t.routes.some((r) => p === r)) || null;
}

// Owner của 1 trạm từ dữ liệu `GET /dashboard/so-do-dong-chay` ({ tram: {MA: [...]}, checkpoint: {MA: [...]} }).
// Gộp trạm + checklist chính, bỏ trùng tên (giữ bản "chịu trách nhiệm" nếu cùng người có cả 2 loại), rồi gom theo
// ghi chú phạm vi: [{ ghiChu, nguoi: [{ten, chinh}] }] — nhóm không ghi chú đứng đầu.
export function ownerCuaTram(t, data) {
  const ds = [
    ...((t.tram && data?.tram?.[t.tram]) || []),
    ...(t.checklist || []).flatMap((c) => data?.checkpoint?.[c] || []),
  ];
  return gomOwner(ds);
}
export function gomOwner(ds) {
  const theoTen = new Map();
  ds.forEach((o) => {
    const k = `${o.ghi_chu || ''}|${o.ten}`;
    const cu = theoTen.get(k);
    if (!cu) theoTen.set(k, { ten: o.ten, ghiChu: o.ghi_chu || '', chinh: o.loai === 'CHIU_TRACH_NHIEM' });
    else if (o.loai === 'CHIU_TRACH_NHIEM') cu.chinh = true;
  });
  const nhom = new Map();
  [...theoTen.values()].forEach((o) => {
    if (!nhom.has(o.ghiChu)) nhom.set(o.ghiChu, []);
    nhom.get(o.ghiChu).push(o);
  });
  return [...nhom.entries()]
    .sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : 0))
    .map(([ghiChu, nguoi]) => ({ ghiChu, nguoi: nguoi.sort((x, y) => Number(y.chinh) - Number(x.chinh)) }));
}
