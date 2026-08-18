// ─────────────────────────────────────────────────────────────────────────────
// THÔNG BÁO TRÊN THIẾT BỊ — 2 cơ chế, dùng CHUNG một chỗ (mig 085).
//
//  (1) POPUP KHI APP ĐANG MỞ  — Notification API dựng thẳng từ tab. Luôn có, không cần cấu hình.
//  (2) PUSH KHI ĐÃ ĐÓNG APP   — Web Push qua service worker. CHỈ khi cờ hệ thống `PUSH_NEN` bật
//                               VÀ backend có VAPID key.
//
// ⚠⚠ CẢ HAI ĐỀU CẦN NGƯỜI DÙNG CHO PHÉP (`Notification.permission`). Trình duyệt CHỈ hỏi quyền khi
//   có thao tác thật của người dùng (user gesture) ⇒ TUYỆT ĐỐI không gọi `requestPermission()` lúc
//   tải trang: Chrome bỏ qua, Safari còn coi là lạm dụng. Phải gắn vào một nút bấm.
//
// ⚠ `Notification` KHÔNG có trên iOS Safari khi mở bằng tab thường — chỉ chạy khi đã "Thêm vào màn
//   hình chính" (PWA standalone). Mọi hàm ở đây phải chịu được `typeof Notification === 'undefined'`
//   mà không ném (đúng bài học service worker v1 làm trắng trang iPhone — CLAUDE.md §2).
// ─────────────────────────────────────────────────────────────────────────────

const coNotification = () => typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
const coPush = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// ⚠⚠ `navigator.serviceWorker.ready` KHÔNG BAO GIỜ REJECT — chưa đăng ký SW thì nó TREO VĨNH VIỄN.
//   Ở môi trường DEV (`npm start`) service worker CỐ Ý không đăng ký (`src/index.js` chỉ chạy ở
//   production) ⇒ mọi `await ...ready` sẽ đứng im, nút "Bật trên thiết bị này" quay mãi không xong.
//   (Lỗi thật, người dùng bắt được 18/08/2026 khi test ở local.)
//   ⇒ Luôn đi qua helper này: chờ tối đa `CHO_SW_MS` rồi trả `null` để bên gọi báo lý do rõ ràng.
const CHO_SW_MS = 3000;
async function layReg() {
  if (!coPush()) return null;
  try {
    // `getRegistration()` trả về ngay (undefined nếu chưa có) — hỏi trước để khỏi phải chờ hết timeout.
    const dangCo = await navigator.serviceWorker.getRegistration();
    if (!dangCo) return null;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => { setTimeout(() => r(null), CHO_SW_MS); }),
    ]);
  } catch (e) { return null; }
}

// Có chạy được thông báo NỀN trên máy này không (đã đăng ký service worker chưa).
export const coServiceWorker = async () => !!(await layReg());

// 'default' (chưa hỏi) · 'granted' · 'denied' · 'khong-ho-tro'
export const quyenHienTai = () => (coNotification() ? window.Notification.permission : 'khong-ho-tro');

export const hoTroPush = () => coPush() && coNotification();

// Hỏi quyền — CHỈ gọi từ trong handler của một nút bấm.
export async function xinQuyen() {
  if (!coNotification()) return 'khong-ho-tro';
  try { return await window.Notification.requestPermission(); } catch (e) { return quyenHienTai(); }
}

// ─── (1) Popup khi app đang mở ───────────────────────────────────────────────
// ⚠ `tag` để trình duyệt GỘP thông báo trùng thay vì xếp chồng 10 cái giống nhau khi người dùng
//   mở nhiều tab MES (mỗi tab đều nhận socket và đều muốn hiện popup).
export function hienPopup({ tieuDe, than, duongDan, tag }) {
  if (!coNotification() || window.Notification.permission !== 'granted') return false;
  try {
    const n = new window.Notification(tieuDe, {
      body: than,
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: tag || undefined,
      renotify: !!tag,
    });
    n.onclick = () => {
      try { window.focus(); } catch (e) { /* noop */ }
      if (duongDan) window.location.assign(duongDan);
      n.close();
    };
    return true;
  } catch (e) {
    return false; // Safari cũ ném khi dựng Notification ngoài SW — im lặng, đã có chuông trong app
  }
}

// ─── (2) Web Push (nhận cả khi đóng app) ─────────────────────────────────────
// Chuỗi base64url (VAPID public key) → Uint8Array cho `applicationServerKey`.
function doiKhoa(base64) {
  const dem = '='.repeat((4 - (base64.length % 4)) % 4);
  const s = (base64 + dem).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(s);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Đăng ký thiết bị. Trả `{ ok, sub, loi }` — KHÔNG ném.
export async function dangKyThietBi(khoaCongKhai) {
  if (!hoTroPush()) return { ok: false, sub: null, loi: 'Trình duyệt không hỗ trợ thông báo nền' };
  if (!khoaCongKhai) return { ok: false, sub: null, loi: 'Máy chủ chưa cấu hình khóa VAPID' };
  const reg = await layReg();
  if (!reg) {
    return {
      ok: false,
      sub: null,
      // ⚠ Nói ĐÚNG lý do thay vì "lỗi không xác định": ở `npm start` không có SW nên chắc chắn
      //   không đăng ký được — người dùng cần biết là phải chạy bản build production.
      loi: 'Chưa có service worker trên môi trường này (bản chạy dev không đăng ký service worker) '
        + '— thông báo nền chỉ hoạt động ở bản build production qua HTTPS',
    };
  }
  try {
    let sub = await reg.pushManager.getSubscription();
    // ⚠ Đã đăng ký bằng khóa KHÁC (đổi VAPID key) → phải hủy rồi đăng ký lại, nếu không
    //   `subscribe()` ném `InvalidStateError` và người dùng kẹt vĩnh viễn không bật được.
    if (sub) {
      const cu = sub.options && sub.options.applicationServerKey;
      const moi = doiKhoa(khoaCongKhai);
      const khac = !cu || new Uint8Array(cu).length !== moi.length
        || !new Uint8Array(cu).every((v, i) => v === moi[i]);
      if (khac) { try { await sub.unsubscribe(); } catch (e) { /* noop */ } sub = null; }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true, // bắt buộc theo chuẩn — push im lặng bị Chrome từ chối
        applicationServerKey: doiKhoa(khoaCongKhai),
      });
    }
    const j = sub.toJSON();
    return { ok: true, loi: null, sub: { endpoint: j.endpoint, keys: j.keys, userAgent: navigator.userAgent } };
  } catch (e) {
    return { ok: false, sub: null, loi: e.message || 'Không đăng ký được thông báo nền' };
  }
}

// Hủy đăng ký trên thiết bị này. Trả endpoint vừa hủy (để backend xóa) hoặc null.
export async function huyThietBi() {
  const reg = await layReg();
  if (!reg) return null;
  try {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const { endpoint } = sub;
    await sub.unsubscribe();
    return endpoint;
  } catch (e) { return null; }
}

// Thiết bị này đang đăng ký push chưa? (Không có SW → false, KHÔNG treo.)
export async function dangDangKy() {
  const reg = await layReg();
  if (!reg) return false;
  try { return !!(await reg.pushManager.getSubscription()); } catch (e) { return false; }
}
