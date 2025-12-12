// src/redux/slices/locationSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentLocation: null, // { latitude, longitude, accuracy?, heading?, speed? }
  currentAddress: null,  // Reverse geocoded address
  permissionStatus: 'idle', // 'idle' | 'prompt' | 'granted' | 'denied' | 'error'
  loading: false,
  error: null,
  watchId: null, // For tracking geolocation watch
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload || null;
      state.loading = false;
      state.error = null;
    },

    setCurrentAddress: (state, action) => {
      state.currentAddress = action.payload || null;
    },

    setPermissionStatus: (state, action) => {
      state.permissionStatus = action.payload || 'idle';
    },

    setLocationLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setLocationError: (state, action) => {
      state.error = action.payload || null;
      state.loading = false;
    },

    setWatchId: (state, action) => {
      state.watchId = action.payload;
    },

    clearWatchId: (state) => {
      state.watchId = null;
    },

    resetLocation: () => initialState,
  },
});

export const {
  setCurrentLocation,
  setCurrentAddress,
  setPermissionStatus,
  setLocationLoading,
  setLocationError,
  setWatchId,
  clearWatchId,
  resetLocation,
} = locationSlice.actions;

// Selectors
export const selectCurrentLocation = (state) => state.location.currentLocation;
export const selectCurrentAddress = (state) => state.location.currentAddress;
export const selectLocationPermission = (state) => state.location.permissionStatus;
export const selectLocationLoading = (state) => state.location.loading;
export const selectLocationError = (state) => state.location.error;

export default locationSlice.reducer;