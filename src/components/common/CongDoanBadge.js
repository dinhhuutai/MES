// Badge CÔNG ĐOẠN của phần in 2 công đoạn (mig 126) — "In kiếng" / "In" (tím) · "Ép ủi" (cam). Phần in Logo ⇒ badge "Logo"
// (`hienLogo`). Phần in thường ⇒ không vẽ gì. Nhãn dựng ở `utils/luongSanXuat.js` (gương BE).
import { nhanCongDoan, chuanGd, GD_EP, laLogo } from '../../utils/luongSanXuat';

const TONE = {
  IN: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900',
  EP: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900',
  LOGO: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900',
};

export default function CongDoanBadge({ luong, gd, hienLogo = false, className = '', title }) {
  if (hienLogo && laLogo(luong)) {
    return (
      <span title={title || 'Luồng Logo — không qua Kỹ thuật / Test Run / Release 2'}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE.LOGO} ${className}`}>
        Logo
      </span>
    );
  }
  const nhan = nhanCongDoan(luong, gd);
  if (!nhan) return null;
  const ep = chuanGd(gd) === GD_EP;
  return (
    <span title={title || (ep ? 'Công đoạn ép ủi (lệnh riêng của phần in 2 công đoạn)' : 'Công đoạn in (lệnh riêng của phần in 2 công đoạn)')}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ep ? TONE.EP : TONE.IN} ${className}`}>
      {nhan}
    </span>
  );
}
