import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: false,
    theme: 'light', // 'light' | 'dark'
  },
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme(state, action) {
      state.theme = action.payload === 'dark' ? 'dark' : 'light';
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, toggleTheme, setTheme } = uiSlice.actions;
export const selectSidebarCollapsed = (s) => s.ui.sidebarCollapsed;
export const selectTheme = (s) => s.ui.theme;
export default uiSlice.reducer;
