// src/redux/api/userApi.js
import { apiSlice } from './apiSlice';

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ===== Profile =====
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

    uploadProfilePicture: builder.mutation({
      query: (formData) => ({
        url: '/users/profile/picture',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['User'],
    }),

    deleteProfilePicture: builder.mutation({
      query: () => ({
        url: '/users/profile/picture',
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),

    // ===== Saved Locations =====
    // src/redux/api/userApi.js (replace the Saved Locations block)
    // ===== Saved Locations =====
    getSavedLocations: builder.query({
      query: () => '/locations/saved',              // <- was '/users/locations'
      providesTags: ['SavedLocations'],
      // optional: unwrap the response to return just the array
      transformResponse: (response) => response?.data?.locations || [],
    }),

    addSavedLocation: builder.mutation({
      query: (body) => ({
        url: '/locations/saved',                    // <- was '/users/locations'
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SavedLocations'],
    }),

    updateSavedLocation: builder.mutation({
      query: ({ locationId, ...body }) => ({
        url: `/locations/saved/${locationId}`,      // <- was /users/locations/${locationId}
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['SavedLocations'],
    }),

    deleteSavedLocation: builder.mutation({
      query: (locationId) => ({
        url: `/locations/saved/${locationId}`,      // <- was /users/locations/${locationId}
        method: 'DELETE',
      }),
      invalidatesTags: ['SavedLocations'],
    }),


    // ===== Emergency Contacts =====
    getEmergencyContacts: builder.query({
      query: () => '/users/emergency-contacts',
      providesTags: ['EmergencyContacts'],
    }),

    addEmergencyContact: builder.mutation({
      query: (body) => ({
        url: '/users/emergency-contacts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EmergencyContacts'],
    }),

    updateEmergencyContact: builder.mutation({
      query: ({ contactId, ...body }) => ({
        url: `/users/emergency-contacts/${contactId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['EmergencyContacts'],
    }),

    deleteEmergencyContact: builder.mutation({
      query: (contactId) => ({
        url: `/users/emergency-contacts/${contactId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EmergencyContacts'],
    }),

    // ===== Password & Security =====
    changePassword: builder.mutation({
      query: (body) => ({
        url: '/users/change-password',
        method: 'POST',
        body,
      }),
    }),

    // ===== Notifications Settings =====
    getNotificationSettings: builder.query({
      query: () => '/users/notifications/settings',
      providesTags: ['NotificationSettings'],
    }),

    updateNotificationSettings: builder.mutation({
      query: (body) => ({
        url: '/users/notifications/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['NotificationSettings'],
    }),

    // ===== Delete Account =====
    deleteAccount: builder.mutation({
      query: (body) => ({
        url: '/users/account',
        method: 'DELETE',
        body,
      }),
    }),

    // ===== User Stats =====
    getUserStats: builder.query({
      query: () => '/users/stats',
      providesTags: ['UserStats'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePictureMutation,
  useDeleteProfilePictureMutation,
  useGetSavedLocationsQuery,
  useAddSavedLocationMutation,
  useUpdateSavedLocationMutation,
  useDeleteSavedLocationMutation,
  useGetEmergencyContactsQuery,
  useAddEmergencyContactMutation,
  useUpdateEmergencyContactMutation,
  useDeleteEmergencyContactMutation,
  useChangePasswordMutation,
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  useDeleteAccountMutation,
  useGetUserStatsQuery,
} = userApi;