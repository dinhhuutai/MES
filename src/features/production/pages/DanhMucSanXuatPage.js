import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChipTabs from '../../../components/common/ChipTabs';
import usePermissions from '../../../hooks/usePermissions';
import DanhSachTemPage from './DanhSachTemPage';
import LoaiLoiPage from '../../quality/pages/LoaiLoiPage';
import BienPhapXuLyPage from './BienPhapXuLyPage';
import LyDoNgungChuyenPage from './LyDoNgungChuyenPage';
import LyDoBoSungPage from './LyDoBoSungPage';

// ─────────────────────────────────────────────────────────────────────────────
// SẢN XUẤT › TEM IN & DANH MỤC (24/09/2026) — gộp 5 trang cũ thành 1 trang có dải toggle:
//   Danh sách tem in · Danh mục lỗi · Biện pháp xử lý · Lý do ngừng chuyền · Lý do bổ sung.
// ⚠ Mỗi toggle chỉ hiện khi người dùng có ĐÚNG quyền của trang cũ ⇒ không mở thêm quyền cho ai.
// ⚠ Toggle đang chọn nằm trên URL (`?tab=`) ⇒ F5 giữ nguyên, và 5 route cũ ở App.js chuyển hướng
//   thẳng về đúng toggle (link/bookmark cũ vẫn vào được).
// ⚠ Các trang con dùng NGUYÊN component cũ — không chép lại, sửa 1 chỗ là cả 2 lối vào đổi theo
//   ("Danh mục lỗi" vẫn còn lối vào riêng ở module Chất lượng).
// ─────────────────────────────────────────────────────────────────────────────

export const TAB_DANH_MUC_SX = [
  { v: 'tem', label: 'Danh sách tem in', perm: ['PROD_RUN', 'PROD_MONITOR'], el: <DanhSachTemPage /> },
  { v: 'loi', label: 'Danh mục lỗi', perm: ['LOI_MANAGE'], el: <LoaiLoiPage /> },
  { v: 'bien-phap', label: 'Biện pháp xử lý', perm: ['BIEN_PHAP_MANAGE'], el: <BienPhapXuLyPage /> },
  { v: 'ly-do-ngung', label: 'Lý do ngừng chuyền', perm: ['LY_DO_NGUNG_MANAGE'], el: <LyDoNgungChuyenPage /> },
  { v: 'ly-do-bo-sung', label: 'Lý do bổ sung', perm: ['LY_DO_BO_SUNG_MANAGE'], el: <LyDoBoSungPage /> },
];

export default function DanhMucSanXuatPage() {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const tabs = useMemo(() => TAB_DANH_MUC_SX.filter((t) => t.perm.some((p) => can(p))), [can]);
  const tab = tabs.find((t) => t.v === params.get('tab')) || tabs[0];

  if (!tab) return <div className="card p-6 text-sm text-ink-soft">Bạn chưa được cấp quyền xem mục nào trong trang này.</div>;

  return (
    <div>
      <ChipTabs anSo tabs={tabs} value={tab.v}
        onChange={(v) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', v); return n; }, { replace: true })} />
      {/* `key` ⇒ đổi toggle là dựng lại trang con từ đầu (state lọc/phân trang của trang trước không dính sang). */}
      <div key={tab.v}>{tab.el}</div>
    </div>
  );
}
