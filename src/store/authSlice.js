import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  apiLogin, apiFetchMe, apiUpdateProfile, apiUploadAvatar, apiResetAvatar,
} from '../services/authService';

export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ tenDangNhap, matKhau }, { rejectWithValue }) => {
    try {
      const env = await apiLogin(tenDangNhap, matKhau);
      return env.data; // { token, user }
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const fetchMeThunk = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const env = await apiFetchMe();
    return env.data; // user
  } catch (e) {
    return rejectWithValue(e);
  }
});

export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const env = await apiUpdateProfile(payload);
      return env.data; // user (đã cập nhật)
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const uploadAvatarThunk = createAsyncThunk(
  'auth/uploadAvatar',
  async (file, { rejectWithValue }) => {
    try {
      const env = await apiUploadAvatar(file);
      return env.data; // user (đã cập nhật avatar_url)
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const resetAvatarThunk = createAsyncThunk(
  'auth/resetAvatar',
  async (_, { rejectWithValue }) => {
    try {
      const env = await apiResetAvatar();
      return env.data; // user (avatar_url = null)
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

const initialState = {
  token: null,
  user: null,
  status: 'idle', // idle | loading | succeeded | failed
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Đăng nhập thất bại';
      })
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(uploadAvatarThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(resetAvatarThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        state.token = null;
        state.user = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

export const selectAuth = (s) => s.auth;
export const selectIsAuthenticated = (s) => Boolean(s.auth.token);
export const selectPermissions = (s) => s.auth.user?.permissions || [];

export default authSlice.reducer;
