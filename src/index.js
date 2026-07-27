import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter } from 'react-router-dom';
import { store, persistor } from './app/store';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);

// PWA: đăng ký service worker (network-first) để app cài màn hình chính TỰ CẬP NHẬT khi có build mới
// (không cần xóa & thêm lại). Chỉ chạy ở production build; dev không đăng ký để tránh cache gây rối.
// `updateViaCache:'none'` → luôn tải service-worker.js MỚI từ mạng khi kiểm tra cập nhật (không dính
// HTTP cache) ⇒ máy đang chạy SW cũ/lỗi nhận được bản vá ngay lần mở app kế tiếp.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
      .then((reg) => {
        const check = () => { try { reg.update(); } catch (e) { /* noop */ } };
        check();
        // Mở lại app (PWA màn hình chính) → kiểm tra bản mới, tối đa 1 lần/phút.
        let last = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - last < 60000) return;
          last = Date.now();
          check();
        });
      })
      .catch(() => { /* SW không bắt buộc — bỏ qua nếu lỗi */ });
  });
}
