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
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/service-worker.js`)
      .then((reg) => { try { reg.update(); } catch (e) { /* noop */ } })
      .catch(() => { /* SW không bắt buộc — bỏ qua nếu lỗi */ });
  });
}
