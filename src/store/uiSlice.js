import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: false,
    mobileNavOpen: false, // drawer sidebar trên mobile
    theme: 'light', // 'light' | 'dark'
  },
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = action.payload;
    },
    openMobileNav(state) {
      state.mobileNavOpen = true;
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme(state, action) {
      state.theme = action.payload === 'dark' ? 'dark' : 'light';
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, openMobileNav, closeMobileNav, toggleTheme, setTheme } = uiSlice.actions;
export const selectSidebarCollapsed = (s) => s.ui.sidebarCollapsed;
export const selectMobileNavOpen = (s) => s.ui.mobileNavOpen;
export const selectTheme = (s) => s.ui.theme;
export default uiSlice.reducer;
