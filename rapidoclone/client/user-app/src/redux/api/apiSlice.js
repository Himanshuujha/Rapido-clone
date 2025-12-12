// src/redux/api/apiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Helper to get token from localStorage (same idea as in services/api.js)
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
  tagTypes: ['User', 'Ride', 'Wallet'],
  endpoints: (builder) => ({
    // ===== User / Profile =====
    getProfile: builder.query({
      query: () => '/users/profile',
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation({
      query: (body) => ({
        url: '/users/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    // ===== Rides =====
    getFareEstimate: builder.mutation({
      query: (body) => ({
        url: '/rides/estimate',
        method: 'POST',
        body,
      }),
    }),
    bookRide: builder.mutation({
      query: (body) => ({
        url: '/rides/book',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ride', 'Wallet'],
    }),
    getActiveRide: builder.query({
      query: () => '/rides/active',
      providesTags: ['Ride'],
    }),
    getRideHistory: builder.query({
      query: () => '/rides/history',
      providesTags: ['Ride'],
    }),
    cancelRide: builder.mutation({
      query: ({ rideId, reason }) => ({
        url: `/rides/${rideId}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Ride', 'Wallet'],
    }),

    // ===== Wallet =====
    getWalletBalance: builder.query({
      query: () => '/wallet/balance',
      providesTags: ['Wallet'],
    }),
    getWalletTransactions: builder.query({
      query: () => '/wallet/transactions',
      providesTags: ['Wallet'],
    }),
    topupWallet: builder.mutation({
      query: (body) => ({
        url: '/wallet/topup',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet'],
    }),
  }),
});

// Auto-generated hooks
export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetFareEstimateMutation,
  useBookRideMutation,
  useGetActiveRideQuery,
  useGetRideHistoryQuery,
  useCancelRideMutation,
  useGetWalletBalanceQuery,
  useGetWalletTransactionsQuery,
  useTopupWalletMutation,
} = apiSlice;