// src/redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query'; // Move import to top
import authReducer from './slices/authSlice';
import rideReducer from './slices/rideSlice';
import locationReducer from './slices/locationSlice';
import walletReducer from './slices/walletSlice';
import { apiSlice } from './api/apiSlice';

// Custom middleware for handling auth errors
const authErrorMiddleware = (store) => (next) => (action) => {
  // Check for 401 errors from RTK Query
  if (action.type?.endsWith('/rejected')) {
    const status = action.payload?.status;
    if (status === 401) {
      // Token expired or invalid - clear auth
      store.dispatch({ type: 'auth/clearAuth' });

      // Optionally redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }
  return next(action);
};

// NOTE: Logger middleware - uncomment in development if needed
// const loggerMiddleware = (store) => (next) => (action) => {
//   if (process.env.NODE_ENV === 'development') {
//     console.group(action.type);
//     console.info('dispatching', action);
//     const result = next(action);
//     console.log('next state', store.getState());
//     console.groupEnd();
//     return result;
//   }
//   return next(action);
// };

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ride: rideReducer,
    location: locationReducer,
    wallet: walletReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    })
      .concat(apiSlice.middleware)
      .concat(authErrorMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Setup listeners for refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

export default store;