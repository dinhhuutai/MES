/* THLA MES — Service Worker (PWA) — v2
 * Mục tiêu: cài lên màn hình chính, TỰ CẬP NHẬT khi có build/giao diện mới mà KHÔNG cần xóa & thêm lại.
 * Chiến lược NETWORK-FIRST cho điều hướng + tài nguyên: luôn ưu tiên bản mới nhất từ mạng,
 * chỉ dùng cache khi offline. skipWaiting + clients.claim → SW mới nắm quyền ngay lập tức.
 *
 * ⚠ BÀI HỌC v1 (lỗi thật trên iPhone): iOS Safari KHÔNG LUÔN có CacheStorage — `caches` là
 * undefined khi Duyệt web riêng tư / bị hạn chế dữ liệu trang web / hết dung lượng. Bản v1 gọi
 * thẳng `caches.open(...)` trong `event.respondWith()` ⇒ ném "ReferenceError: Can't find variable:
 * caches" ⇒ MỌI request qua SW đều fail ⇒ Safari báo "Đã xảy ra lỗi: FetchEvent.respondWith
 * received an error" (trắng trang, không đăng nhập được).
 * ⇒ QUY TẮC BẤT DI BẤT DỊCH: KHÔNG bao giờ đụng `caches` trực tiếp — luôn qua helper safe*() bên
 * dưới; và KHÔNG bao giờ để promise trong respondWith bị reject (luôn có đường lùi ra mạng).
 */
const CACHE = 'thla-mes-v2';

// CacheStorage có dùng được không? (iOS riêng tư / hạn chế lưu trữ → không có `caches`).
function cacheStore() {
  try {
    return (typeof caches !== 'undefined' && caches) ? caches : null;
  } catch (e) {
    return null; // truy cập biến toàn cục cũng có thể ném (ReferenceError/SecurityError)
  }
}

async function safeOpen() {
  const cs = cacheStore();
  if (!cs) return null;
  try { return await cs.open(CACHE); } catch (e) { return null; }
}

async function safeMatch(request) {
  const cache = await safeOpen();
  if (!cache) return null;
  try { return (await cache.match(request)) || null; } catch (e) { return null; }
}

async function safePut(request, response) {
  const cache = await safeOpen();
  if (!cache) return;
  try { await cache.put(request, response); } catch (e) { /* hết quota / không hỗ trợ — bỏ qua */ }
}

// Chỉ cache tài nguyên tĩnh của app (KHÔNG cache /api — dữ liệu luôn lấy mới).
const isApi = (url) => url.pathname.includes('/api/');
// Khung app dùng làm đường lùi cho điều hướng khi offline.
const shellUrl = () => {
  try { return new URL('index.html', self.registration.scope).toString(); } catch (e) { return '/index.html'; }
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // KHÔNG mở cache ở đây: máy không có CacheStorage sẽ ném → SW không cài được.
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cs = cacheStore();
    if (cs) {
      try {
        const keys = await cs.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => cs.delete(k)));
      } catch (e) { /* dọn cache cũ chỉ là best-effort */ }
    }
    try { await self.clients.claim(); } catch (e) { /* noop */ }
  })());
});

// Lấy mạng trước; lỗi mạng mới lùi về cache. MỌI nhánh đều trả về Response — không bao giờ throw.
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      const copy = fresh.clone();
      const key = request.mode === 'navigate' ? shellUrl() : request;
      safePut(key, copy); // nền, không chặn phản hồi
    }
    return fresh;
  } catch (e) {
    const cached = await safeMatch(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await safeMatch(shellUrl());
      if (shell) return shell;
    }
    // Không có cache (vd iOS không có CacheStorage) → trả lỗi mạng chuẩn của trình duyệt,
    // KHÔNG ném ra ngoài (ném = Safari hiện màn hình "FetchEvent.respondWith received an error").
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  // API + khác origin: KHÔNG can thiệp (để axios/token/lỗi hoạt động bình thường).
  if (isApi(url) || url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
