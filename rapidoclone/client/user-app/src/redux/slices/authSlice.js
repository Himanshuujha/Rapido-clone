// src/redux/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const getInitialAuthState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: null,
      loading: false,
      error: null,
    };
  }

  try {
    const stored = localStorage.getItem('auth');
    if (!stored) {
      return {
        user: null,
        token: null,
        loading: false,
        error: null,
      };
    }
    const parsed = JSON.parse(stored);
    return {
      user: parsed.user || null,
      token: parsed.token || null,
      loading: false,
      error: null,
    };
  } catch (e) {
    console.error('Error parsing auth from localStorage:', e);
    return {
      user: null,
      token: null,
      loading: false,
      error: null,
    };
  }
};

const initialState = getInitialAuthState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set user & token (used on login)
    setCredentials: (state, action) => {
      const { user, token } = action.payload || {};
      state.user = user || null;
      state.token = token || null;
      state.error = null;
    },

    // Clear all auth data (used on logout)
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
    },

    // For async actions (login/register)
    setAuthLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setAuthError: (state, action) => {
      state.error = action.payload || null;
    },

    // Update user profile without touching token
    setUser: (state, action) => {
      state.user = action.payload || null;
    },
  },
});

export const {
  setCredentials,
  clearAuth,
  setAuthLoading,
  setAuthError,
  setUser,
} = authSlice.actions;

export default authSlice.reducer;