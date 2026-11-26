// Badge SỐ LƯỢNG / BỔ SUNG cạnh tên khách ở bảng Đang chạy + modal Chờ chạy (26/11/2026, người dùng: "cho thêm badge ngay
//   khách hàng để biết nó là số lượng hay bổ sung"). `loai` = 'SL' | 'BS' (`utils/locLenhChay.js loaiBadgeSlBs`); dòng 'MIX'
//   đã tách 2 dòng con nên mỗi dòng mang 1 loại.
const KIEU = {
  SL: { chu: 'SL', title: 'Số lượng (đợt vải thường)', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200' },
  BS: { chu: 'BS', title: 'Bổ sung (đợt vải loại Bổ sung)', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
};

export default function SlBsBadge({ loai }) {
  const k = KIEU[loai];
  if (!k) return null;
  return (
    <span title={k.title}
      className={`ml-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-px align-middle text-[10px] font-bold leading-4 ${k.cls}`}>
      {k.chu}
    </span>
  );
}
