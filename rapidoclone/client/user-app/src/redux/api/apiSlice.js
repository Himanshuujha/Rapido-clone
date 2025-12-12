// src/redux/api/apiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const getTokenFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch {
    return null;
  }
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = getTokenFromStorage();
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  // ✅ ADD ALL TAG TYPES HERE
  tagTypes: [
    // User related
    'User',
    'UserStats',
    'SavedLocations',
    'EmergencyContacts',
    'NotificationSettings',
    // Ride related
    'Ride',
    'RideHistory',
    'ActiveRide',
    // Wallet related
    'Wallet',
    'WalletTransactions',
    'WalletStats',
    'Withdrawals',
    'PaymentMethods',
    'Rewards',
    'Referral',
    'BankAccounts',
  ],
  endpoints: () => ({}), // Empty - endpoints injected from other files
});

// Don't export hooks from here - they come from injected endpoints