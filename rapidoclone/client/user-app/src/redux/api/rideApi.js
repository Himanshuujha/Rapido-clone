// src/redux/api/rideApi.js
import { apiSlice } from './apiSlice';

export const rideApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ===== Fare Estimate =====
    getFareEstimate: builder.mutation({
      query: (body) => ({
        url: '/rides/estimate',
        method: 'POST',
        body,
      }),
    }),

    // ===== Book Ride =====
    bookRide: builder.mutation({
      query: (body) => ({
        url: '/rides/book',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ride', 'Wallet'],
    }),

    // ===== Active Ride =====
    getActiveRide: builder.query({
      query: () => '/rides/active',
      providesTags: ['Ride'],
    }),

    // ===== Ride History =====
    getRideHistory: builder.query({
      query: () => '/rides/history',
      providesTags: ['Ride'],
    }),

    // ===== Cancel Ride =====
    cancelRide: builder.mutation({
      query: ({ rideId, reason }) => ({
        url: `/rides/${rideId}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Ride', 'Wallet'],
    }),

    // (optional) Rate Ride
    rateRide: builder.mutation({
      query: ({ rideId, rating, comment }) => ({
        url: `/rides/${rideId}/rate`,
        method: 'POST',
        body: { rating, comment },
      }),
      invalidatesTags: ['Ride'],
    }),

    // (optional) Tip Captain
    tipRide: builder.mutation({
      query: ({ rideId, amount }) => ({
        url: `/rides/${rideId}/tip`,
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: ['Ride', 'Wallet'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFareEstimateMutation,
  useBookRideMutation,
  useGetActiveRideQuery,
  useGetRideHistoryQuery,
  useCancelRideMutation,
  useRateRideMutation,
  useTipRideMutation,
} = rideApi;