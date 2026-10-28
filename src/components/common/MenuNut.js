import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import Icon from './Icon';
import useChiXem from '../../hooks/useChiXem';

// ─────────────────────────────────────────────────────────────────────────────
// MENU GOM NÚT (28/10/2026, người dùng: "các modal hay màn hình có nhiều nút / toggle làm gọn lại"): 1 nút thả xuống
// thay cho dãy nút PHỤ (mở danh sách, lịch sử, xuất file, theo dõi…). Nút chính của màn (xác nhận, chờ chạy…) vẫn
// để ngoài. Menu nổi bằng `anchor` (portal) ⇒ không bị dải nút cuộn ngang của Toolbar / thân modal cắt mất.
//
// props:
//   nhan    chữ trên nút (mặc định "Thêm"); `icon` (mặc định 'layout')
//   nhom    [{ ten?, muc: [{ ten, icon?, onClick, disabled?, ghi?, chiXemOk?, nguy? }] }] — nhóm rỗng tự ẩn; không có
//           mục nào ⇒ không vẽ nút. `ghi` = số / chữ nhỏ bên phải (vd số dòng). `nguy` = tô đỏ (thao tác hủy).
//   ⚠ Tài khoản CHỈ XEM: mục KHÓA mặc định như `Button` — mục không đụng dữ liệu (mở xem, Excel) khai `chiXemOk`.
//   gon     true ⇒ nút thấp + chữ nhỏ, lớn dần theo màn (29/10/2026 — trang Xác nhận chạy dồn đầu trang còn 3 hàng).
// ─────────────────────────────────────────────────────────────────────────────
export default function MenuNut({ nhan = 'Thêm', icon = 'layout', nhom = [], className = '', gon = false }) {
  const chiXem = useChiXem();
  const dsNhom = (nhom || []).map((g) => ({ ...g, muc: (g.muc || []).filter(Boolean) })).filter((g) => g.muc.length);
  if (!dsNhom.length) return null;
  const coNut = gon ? 'h-8 gap-1.5 px-2.5 text-xs 2xl:h-9 2xl:text-sm' : 'h-10 gap-2 px-3 text-sm';
  return (
    <Menu as="div" className={`relative ${className}`}>
      <MenuButton className={`inline-flex items-center whitespace-nowrap rounded-control border border-line bg-surface font-medium text-ink hover:bg-surface-muted ${coNut}`}>
        <Icon name={icon} size={16} className="text-ink-soft" />
        {nhan}
        <Icon name="chevron-down" size={16} className="text-ink-soft" />
      </MenuButton>
      <MenuItems anchor="bottom end"
        className="z-[80] w-64 overflow-auto rounded-control border border-line bg-surface py-1 shadow-card-hover [--anchor-gap:6px] [--anchor-padding:8px] focus:outline-none">
        {dsNhom.map((g, i) => (
          <div key={g.ten || i} className={i ? 'mt-1 border-t border-line pt-1' : ''}>
            {g.ten && <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{g.ten}</div>}
            {g.muc.map((m) => {
              const khoa = !!m.disabled || (chiXem && !m.chiXemOk);
              return (
                <MenuItem key={m.ten} disabled={khoa}>
                  <button type="button" onClick={m.onClick}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm data-[focus]:bg-surface-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 sm:py-2 ${m.nguy ? 'text-danger' : 'text-ink'}`}>
                    {m.icon && <Icon name={m.icon} size={16} className={m.nguy ? 'text-danger' : 'text-ink-soft'} />}
                    <span className="flex-1">{m.ten}</span>
                    {m.ghi != null && m.ghi !== '' && <span className="text-xs tabular-nums text-ink-soft">{m.ghi}</span>}
                  </button>
                </MenuItem>
              );
            })}
          </div>
        ))}
      </MenuItems>
    </Menu>
  );
}
