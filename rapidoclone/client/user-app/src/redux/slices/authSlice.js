// src/redux/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const getInitialAuthState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
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
        isAuthenticated: false,
        loading: false,
        error: null,
      };
    }
    const parsed = JSON.parse(stored);
    return {
      user: parsed.user || null,
      token: parsed.token || null,
      isAuthenticated: !!(parsed.token && parsed.user),
      loading: false,
      error: null,
    };
  } catch (e) {
    console.error('Error parsing auth from localStorage:', e);
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    };
  }
};

const initialState = getInitialAuthState();

// Helper to sync with localStorage
const syncToLocalStorage = (user, token) => {
  if (typeof window === 'undefined') return;
  
  if (user && token) {
    localStorage.setItem('auth', JSON.stringify({ user, token }));
  } else {
    localStorage.removeItem('auth');
  }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload || {};
      state.user = user || null;
      state.token = token || null;
      state.isAuthenticated = !!(user && token);
      state.error = null;
      state.loading = false;
      
      // Sync to localStorage
      syncToLocalStorage(user, token);
    },

    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
      }
    },

    setAuthLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setAuthError: (state, action) => {
      state.error = action.payload || null;
      state.loading = false;
    },

    setUser: (state, action) => {
      state.user = action.payload || null;
      
      // Update localStorage with new user data
      if (state.token && action.payload) {
        syncToLocalStorage(action.payload, state.token);
      }
    },

    updateUserField: (state, action) => {
      if (state.user && action.payload) {
        state.user = { ...state.user, ...action.payload };
        
        // Sync updated user to localStorage
        if (state.token) {
          syncToLocalStorage(state.user, state.token);
        }
      }
    },
  },
});

export const {
  setCredentials,
  clearAuth,
  setAuthLoading,
  setAuthError,
  setUser,
  updateUserField,
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectCurrentToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;