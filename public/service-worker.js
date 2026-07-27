/* THLA MES — Service Worker (PWA).
 * Mục tiêu: cài lên màn hình chính, TỰ CẬP NHẬT khi có build/giao diện mới mà KHÔNG cần xóa & thêm lại.
 * Chiến lược NETWORK-FIRST cho điều hướng + tài nguyên: luôn ưu tiên bản mới nhất từ mạng,
 * chỉ dùng cache khi offline. skipWaiting + clients.claim → SW mới nắm quyền ngay lập tức.
 */
const CACHE = 'thla-mes-v1';
// Chỉ cache tài nguyên tĩnh của app (KHÔNG cache /api — dữ liệu luôn lấy mới).
const isApi = (url) => url.pathname.includes('/api/');

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // API: luôn ra mạng, KHÔNG can thiệp (để axios/token/lỗi hoạt động bình thường).
  if (isApi(url) || url.origin !== self.location.origin) return;

  // Điều hướng (HTML) + tài nguyên tĩnh: NETWORK-FIRST, fallback cache khi offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (e) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await caches.match('/index.html') || await caches.match('/');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
