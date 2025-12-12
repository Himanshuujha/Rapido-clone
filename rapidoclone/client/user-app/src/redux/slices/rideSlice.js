// src/redux/slices/rideSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Current ride booking
  pickup: null,
  destination: null,
  selectedVehicle: 'bike',
  fareEstimate: null,
  
  // Active ride
  activeRide: null,
  status: 'idle', // idle, searching, accepted, arriving, arrived, started, completed, cancelled
  captain: null,
  otp: null,
  
  // Tracking
  captainLocation: null,
  eta: null,
  route: null,
  
  // Ride history cache
  recentRides: [],
  
  // UI state
  loading: false,
  error: null,
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    // Location setters
    setPickup: (state, action) => {
      state.pickup = action.payload;
    },
    
    setDestination: (state, action) => {
      state.destination = action.payload;
    },
    
    // Vehicle selection
    setSelectedVehicle: (state, action) => {
      state.selectedVehicle = action.payload;
    },
    
    // Fare
    setFareEstimate: (state, action) => {
      state.fareEstimate = action.payload;
    },
    
    // Active ride management
    setActiveRide: (state, action) => {
      state.activeRide = action.payload;
      state.status = action.payload?.status || 'idle';
      
      // Also set captain if included
      if (action.payload?.captain) {
        state.captain = action.payload.captain;
      }
      
      // Also set OTP if included
      if (action.payload?.otp) {
        state.otp = action.payload.otp?.code || action.payload.otp;
      }
    },
    
    // Status updates
    updateRideStatus: (state, action) => {
      state.status = action.payload;
      if (state.activeRide) {
        state.activeRide.status = action.payload;
      }
    },
    
    // Captain
    setCaptain: (state, action) => {
      state.captain = action.payload;
    },
    
    // OTP
    setOTP: (state, action) => {
      state.otp = action.payload;
    },
    
    // Tracking
    setCaptainLocation: (state, action) => {
      state.captainLocation = action.payload;
    },
    
    setETA: (state, action) => {
      state.eta = action.payload;
    },
    
    setRoute: (state, action) => {
      state.route = action.payload;
    },
    
    // Recent rides
    setRecentRides: (state, action) => {
      state.recentRides = Array.isArray(action.payload) ? action.payload : [];
    },
    
    // Loading & Error
    setRideLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },
    
    setRideError: (state, action) => {
      state.error = action.payload || null;
    },
    
    // Reset booking (keep recent rides)
    resetBooking: (state) => {
      state.pickup = null;
      state.destination = null;
      state.selectedVehicle = 'bike';
      state.fareEstimate = null;
      state.error = null;
    },
    
    // Full reset
    resetRide: () => initialState,
    
    // Reset active ride only
    resetActiveRide: (state) => {
      state.activeRide = null;
      state.status = 'idle';
      state.captain = null;
      state.otp = null;
      state.captainLocation = null;
      state.eta = null;
      state.route = null;
    },
  },
});

export const {
  setPickup,
  setDestination,
  setSelectedVehicle,
  setFareEstimate,
  setActiveRide,
  updateRideStatus,
  setCaptain,
  setOTP,
  setCaptainLocation,
  setETA,
  setRoute,
  setRecentRides,
  setRideLoading,
  setRideError,
  resetBooking,
  resetRide,
  resetActiveRide,
} = rideSlice.actions;

// Selectors
export const selectPickup = (state) => state.ride.pickup;
export const selectDestination = (state) => state.ride.destination;
export const selectSelectedVehicle = (state) => state.ride.selectedVehicle;
export const selectFareEstimate = (state) => state.ride.fareEstimate;
export const selectActiveRide = (state) => state.ride.activeRide;
export const selectRideStatus = (state) => state.ride.status;
export const selectCaptain = (state) => state.ride.captain;
export const selectOTP = (state) => state.ride.otp;
export const selectCaptainLocation = (state) => state.ride.captainLocation;
export const selectETA = (state) => state.ride.eta;

export default rideSlice.reducer;