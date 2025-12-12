// src/redux/slices/locationSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentLocation: null,          // { latitude, longitude, accuracy? }
  permissionStatus: 'idle',       // 'idle' | 'granted' | 'denied' | 'error'
  loading: false,
  error: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload || null;
    },

    setPermissionStatus: (state, action) => {
      state.permissionStatus = action.payload || 'idle';
    },

    setLocationLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setLocationError: (state, action) => {
      state.error = action.payload || null;
    },

    resetLocation: () => initialState,
  },
});

export const {
  setCurrentLocation,
  setPermissionStatus,
  setLocationLoading,
  setLocationError,
  resetLocation,
} = locationSlice.actions;

export default locationSlice.reducer;