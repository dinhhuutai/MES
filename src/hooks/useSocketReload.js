import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

// ─────────────────────────────────────────────────────────────────────────────
// NGHE NHIỀU SỰ KIỆN SOCKET → GỘP THÀNH ĐÚNG 1 LẦN TẢI LẠI.
//
// ⚠⚠ Vì sao cần: backend emit theo CỤM — 1 thao tác bắn 2-3 sự kiện
//   (vd `planning.service` bắn `workflow:updated` + `ready:confirmed` + `dashboard:refresh`), mà nhiều
//   trang lại subscribe 2 sự kiện cùng gọi 1 hàm tải ⇒ **2-3 request + 2-3 lần vẽ lại cho MỘT hành
//   động**, nhìn ra là giật cục. Gộp trong `delay` ms thành 1 lần là hết.
//
// ⚠ Handler đọc qua `ref` (giống `useSocketEvent`) ⇒ truyền arrow function nội tuyến vẫn KHÔNG làm
//   subscribe lại mỗi lần render. Deps chỉ là chuỗi khóa sự kiện + delay.
//
// ⚠ Hàm truyền vào NÊN là hàm tải NGẦM (không `setLoading(true)`, không xóa dòng đang tích) — xem
//   `ReadyPage.refresh` / `KcsPage.load(true)`. Gộp sự kiện chỉ giảm SỐ LẦN tải, không tự làm êm.
// ─────────────────────────────────────────────────────────────────────────────

export default function useSocketReload(events, handler, delay = 400) {
  const ref = useRef(handler);
  ref.current = handler;

  const ds = Array.isArray(events) ? events : [events];
  const khoa = ds.join('|');   // deps ổn định dù mảng được tạo mới mỗi render

  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    let timer = null;
    const ban = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; ref.current(); }, delay);
    };
    const ten = khoa.split('|').filter(Boolean);
    ten.forEach((e) => s.on(e, ban));
    return () => {
      if (timer) clearTimeout(timer);
      ten.forEach((e) => s.off(e, ban));
    };
  }, [khoa, delay]);
}
