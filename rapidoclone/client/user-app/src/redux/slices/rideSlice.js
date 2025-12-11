// redux/slices/rideSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeRide: null,
  pickup: null,
  destination: null,
  selectedVehicle: 'bike',
  fareEstimate: null,
  status: 'idle', // idle, searching, accepted, arriving, arrived, started, completed
  captain: null,
  otp: null
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setPickup: (state, action) => {
      state.pickup = action.payload;
    },
    setDestination: (state, action) => {
      state.destination = action.payload;
    },
    setSelectedVehicle: (state, action) => {
      state.selectedVehicle = action.payload;
    },
    setFareEstimate: (state, action) => {
      state.fareEstimate = action.payload;
    },
    setActiveRide: (state, action) => {
      state.activeRide = action.payload;
      state.status = action.payload?.status || 'idle';
    },
    updateRideStatus: (state, action) => {
      state.status = action.payload;
      if (state.activeRide) {
        state.activeRide.status = action.payload;
      }
    },
    setCaptain: (state, action) => {
      state.captain = action.payload;
    },
    setOTP: (state, action) => {
      state.otp = action.payload;
    },
    resetRide: (state) => {
      return initialState;
    }
  }
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
  resetRide
} = rideSlice.actions;

export default rideSlice.reducer;