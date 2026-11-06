import client from './axiosClient';

// Hệ thống › Tính chất in (mig 123): phân luồng + bỏ qua khi đồng bộ ERP.
// `list` trả `{ items, luong: [{ma, ten, da_lam}], chua_migration }`; `save` / `add` / `remove` trả lại đúng khuôn đó.
export const listTinhChatIn = () => client.get('/tinh-chat-in');
export const saveTinhChatIn = (items) => client.put('/tinh-chat-in', { items });
export const addTinhChatIn = (item) => client.post('/tinh-chat-in', item);
export const removeTinhChatIn = (id) => client.delete(`/tinh-chat-in/${id}`);
