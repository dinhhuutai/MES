import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from '../store/authSlice';
import uiReducer from '../store/uiSlice';
import { attachStore } from '../services/axiosClient';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
});

const persistConfig = {
  key: 'thla-mes',
  storage,
  whitelist: ['auth', 'ui'], // lưu token + user, và tùy chọn giao diện (theme/sidebar)
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// Cho axios đọc token từ store.
attachStore(store);
