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
      invalidatesTags: ['Ride', 'ActiveRide', 'Wallet', 'WalletTransactions'],
    }),

    // ===== Schedule Ride =====
    scheduleRide: builder.mutation({
      query: (body) => ({
        url: '/rides/schedule',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ride'],
    }),

    // ===== Get Scheduled Rides =====
    getScheduledRides: builder.query({
      query: () => '/rides/scheduled',
      providesTags: ['Ride'],
    }),

    // ===== Active Ride =====
    getActiveRide: builder.query({
      query: () => '/rides/active',
      providesTags: ['ActiveRide', 'Ride'],
    }),

    // ===== Ride History =====
    getRideHistory: builder.query({
      query: (params) => ({
        url: '/rides/history',
        params: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          status: params?.status,
          startDate: params?.startDate,
          endDate: params?.endDate,
        },
      }),
      providesTags: ['RideHistory', 'Ride'],
    }),

    // ===== Recent Rides =====
    getRecentRides: builder.query({
      query: () => '/rides/recent',
      providesTags: ['Ride'],
    }),

    // ===== Ride Details =====
    getRideDetails: builder.query({
      query: (rideId) => `/rides/${rideId}`,
      providesTags: (result, error, id) => [{ type: 'Ride', id }],
    }),

    // ===== Ride Tracking =====
    getRideTracking: builder.query({
      query: (rideId) => `/rides/${rideId}/tracking`,
      providesTags: (result, error, id) => [{ type: 'Ride', id }],
    }),

    // ===== Cancel Ride =====
    cancelRide: builder.mutation({
      query: ({ rideId, reason }) => ({
        url: `/rides/${rideId}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Ride', 'ActiveRide', 'Wallet', 'WalletTransactions'],
    }),

    // ===== Rate Ride =====
    rateRide: builder.mutation({
      query: ({ rideId, rating, comment }) => ({
        url: `/rides/${rideId}/rate`,
        method: 'POST',
        body: { rating, comment },
      }),
      invalidatesTags: (result, error, { rideId }) => [
        { type: 'Ride', id: rideId },
        'RideHistory',
      ],
    }),

    // ===== Tip Captain =====
    tipRide: builder.mutation({
      query: ({ rideId, amount }) => ({
        url: `/rides/${rideId}/tip`,
        method: 'POST',
        body: { amount },
      }),
      invalidatesTags: ['Ride', 'Wallet', 'WalletTransactions'],
    }),

    // ===== Get Ride Receipt =====
    getRideReceipt: builder.query({
      query: (rideId) => `/rides/${rideId}/receipt`,
      providesTags: (result, error, id) => [{ type: 'Ride', id }],
    }),

    // ===== Email Ride Receipt =====
    emailRideReceipt: builder.mutation({
      query: ({ rideId, email }) => ({
        url: `/rides/${rideId}/receipt/email`,
        method: 'POST',
        body: { email },
      }),
    }),

    // ===== Share Ride =====
    shareRide: builder.mutation({
      query: ({ rideId, contacts }) => ({
        url: `/rides/${rideId}/share`,
        method: 'POST',
        body: { contacts },
      }),
    }),

    // ===== Stop Share Ride =====
    stopShareRide: builder.mutation({
      query: (rideId) => ({
        url: `/rides/${rideId}/share`,
        method: 'DELETE',
      }),
    }),

    // ===== Trigger SOS =====
    triggerSOS: builder.mutation({
      query: ({ rideId, location }) => ({
        url: `/rides/${rideId}/sos`,
        method: 'POST',
        body: { location },
      }),
    }),

    // ===== Report Ride Issue =====
    reportRideIssue: builder.mutation({
      query: ({ rideId, issueType, description }) => ({
        url: `/rides/${rideId}/report`,
        method: 'POST',
        body: { issueType, description },
      }),
    }),

    // ===== User Ride Stats =====
    getUserRideStats: builder.query({
      query: () => '/rides/stats',
      providesTags: ['Ride', 'UserStats'],
    }),

    // ===== Vehicle Types =====
    getVehicleTypes: builder.query({
      query: (city) => ({
        url: '/rides/vehicle-types',
        params: { city },
      }),
    }),

    // ===== Coupons =====
    getAvailableCoupons: builder.query({
      query: (vehicleType) => ({
        url: '/rides/coupons/available',
        params: { vehicleType },
      }),
    }),

    validateCoupon: builder.mutation({
      query: (body) => ({
        url: '/rides/coupons/validate',
        method: 'POST',
        body,
      }),
    }),

    applyCoupon: builder.mutation({
      query: (body) => ({
        url: '/rides/coupons/apply',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ride'],
    }),

    // ===== Shared Ride Tracking (Public) =====
    getSharedRideTracking: builder.query({
      query: (shareToken) => `/rides/share/${shareToken}`,
    }),
  }),
  overrideExisting: false,
});

export const {
  // Fare & Booking
  useGetFareEstimateMutation,
  useBookRideMutation,
  useScheduleRideMutation,
  useGetScheduledRidesQuery,
  // Active & History
  useGetActiveRideQuery,
  useGetRideHistoryQuery,
  useGetRecentRidesQuery,
  useGetRideDetailsQuery,
  useGetRideTrackingQuery,
  // Actions
  useCancelRideMutation,
  useRateRideMutation,
  useTipRideMutation,
  // Receipt & Share
  useGetRideReceiptQuery,
  useEmailRideReceiptMutation,
  useShareRideMutation,
  useStopShareRideMutation,
  // Safety
  useTriggerSOSMutation,
  useReportRideIssueMutation,
  // Stats & Misc
  useGetUserRideStatsQuery,
  useGetVehicleTypesQuery,
  // Coupons
  useGetAvailableCouponsQuery,
  useValidateCouponMutation,
  useApplyCouponMutation,
  // Public
  useGetSharedRideTrackingQuery,
} = rideApi;