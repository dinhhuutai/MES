// Badge CÔNG ĐOẠN của phần in 2 công đoạn (mig 126) — "In kiếng" / "In" (tím) · "Ép" (cam) · "Logo" (xanh ngọc). Phần in
// 1 công đoạn luồng LOGO ⇒ badge "Logo" / "Ép" (`hienLogo`); in kiếng đã bỏ ép (`KIENG_KHONG_EP`) ⇒ badge "In kiếng". Phần
// in thường ⇒ không vẽ gì. Nhãn dựng ở `utils/luongSanXuat.js` (gương BE).
// `pa` (18/11/2026) = phương án in của DÒNG (`phuong_an_in` BE trả — dòng công đoạn ép mang PA theo tính chất in): 4 ⇒ Ép,
//   còn lại ⇒ Logo (`tenCdEp`). Màn không có PA ⇒ "Logo".
import { Fragment } from 'react';
import { nhanCongDoan, chuanGd, GD_EP, GD_IN, laLogo, tenCdEp, dsCongDoan } from '../../utils/luongSanXuat';

const TONE = {
  IN: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900',
  EP: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900',
  LOGO: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900',
};
const BADGE = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold';
const toneCd = (c) => (c.gd === GD_IN ? TONE.IN : c.ten === 'Logo' ? TONE.LOGO : TONE.EP);

export default function CongDoanBadge({ luong, gd, pa, hienLogo = false, className = '', title }) {
  if (hienLogo && laLogo(luong)) {
    const ten = tenCdEp(pa);
    return (
      <span title={title || `Chỉ công đoạn ${ten} — qua READY, không qua Test Run`}
        className={`${BADGE} ${ten === 'Ép' ? TONE.EP : TONE.LOGO} ${className}`}>
        {ten}
      </span>
    );
  }
  if (hienLogo && luong === 'KIENG_KHONG_EP') {
    return (
      <span title={title || 'In kiếng 1 công đoạn (đã bỏ ép ủi) — tem in nhập loại / SL / hệ số kiếng'}
        className={`${BADGE} ${TONE.IN} ${className}`}>
        In kiếng
      </span>
    );
  }
  const nhan = nhanCongDoan(luong, gd, pa);
  if (!nhan) return null;
  const ep = chuanGd(gd) === GD_EP;
  const tone = !ep ? TONE.IN : nhan === 'Logo' ? TONE.LOGO : TONE.EP;
  return (
    <span title={title || `Công đoạn ${nhan} (lệnh riêng của phần in 2 công đoạn)`} className={`${BADGE} ${tone} ${className}`}>
      {nhan}
    </span>
  );
}

// ĐỦ MỌI CÔNG ĐOẠN của PHẦN IN (18/11/2026, người dùng: "DSP Logo lên MES tự tách thêm công đoạn Logo — cho hiện ở READY
//   của KT với QA và Danh sách phần in vải về"): dòng mức ĐỢT trước Release 1 / mức PHẦN IN vẽ hết badge theo luồng — In + Logo
//   ⇒ "In + Logo", kiếng ủi ⇒ "In kiếng + Ép", 1 công đoạn LOGO / In kiếng ⇒ 1 badge, phần in thường ⇒ không vẽ gì.
//   Tham số như `dsCongDoan` (`pa` PA dòng · `paEp` PA công đoạn ép · `epTruoc`).
export function CongDoanPhanInBadges({ luong, pa, paEp, epTruoc = false, className = '', title }) {
  const ds = dsCongDoan(luong, { pa, paEp, epTruoc });
  if (!ds.length) return null;
  const ten = ds.map((c) => c.ten).join(' + ');
  const tt = title || (ds.length > 1
    ? `Phần in 2 công đoạn: ${ten} — mỗi công đoạn 1 lệnh riêng (Release 1 tách 2 dòng)`
    : `Chỉ công đoạn ${ten}`);
  return (
    <span title={tt} className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {ds.map((c, i) => (
        <Fragment key={c.gd}>
          {i > 0 && <span className="text-[11px] font-semibold text-ink-soft">+</span>}
          <span className={`${BADGE} ${toneCd(c)}`}>{c.ten}</span>
        </Fragment>
      ))}
    </span>
  );
}
