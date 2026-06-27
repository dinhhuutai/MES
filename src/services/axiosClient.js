import axios from 'axios';

// Tham chiếu store được gắn sau khi tạo (tránh circular import).
let storeRef = null;
export const attachStore = (s) => {
  storeRef = s;
};

const baseURL = (process.env.REACT_APP_BASE_URL || 'http://localhost:5000') + '/api';

const client = axios.create({ baseURL, withCredentials: true });

// Gắn JWT từ store vào mỗi request.
client.interceptors.request.use((config) => {
  const token = storeRef?.getState?.()?.auth?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Trả về envelope {success, message, data}; lỗi 401 → đăng xuất.
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && storeRef) {
      storeRef.dispatch({ type: 'auth/logout' });
    }
    return Promise.reject(
      err.response?.data || { success: false, message: err.message, errorCode: 'NETWORK_ERROR' }
    );
  }
);

export default client;
