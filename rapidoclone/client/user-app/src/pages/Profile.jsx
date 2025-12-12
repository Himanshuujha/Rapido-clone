// src/pages/Profile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePictureMutation,
  useGetSavedLocationsQuery,
  useAddSavedLocationMutation,
  useUpdateSavedLocationMutation,
  useDeleteSavedLocationMutation,
  useGetEmergencyContactsQuery,
  useGetUserStatsQuery,
  useDeleteAccountMutation,
} from '../redux/api/userApi';
import { setUser, clearAuth } from '../redux/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';

const Profile = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  // Redux auth state
  const { user: authUser, token } = useSelector((state) => state.auth);

  // RTK Query hooks
  const {
    data: profileData,
    isLoading: isLoadingProfile,
    isError: profileError,
    refetch: refetchProfile,
  } = useGetProfileQuery(undefined, {
    skip: !token,
  });

  const {
    data: savedLocationsData,
    isLoading: isLoadingLocations,
  } = useGetSavedLocationsQuery(undefined, {
    skip: !token,
  });

  const {
    data: emergencyContactsData,
    isLoading: isLoadingContacts,
  } = useGetEmergencyContactsQuery(undefined, {
    skip: !token,
  });

  const {
    data: userStatsData,
    isLoading: isLoadingStats,
  } = useGetUserStatsQuery(undefined, {
    skip: !token,
  });

  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  const [uploadProfilePicture, { isLoading: isUploadingPicture }] =
    useUploadProfilePictureMutation();
  const [addSavedLocation, { isLoading: isAddingLocation }] =
    useAddSavedLocationMutation();
  const [updateSavedLocation] = useUpdateSavedLocationMutation();
  const [deleteSavedLocation] = useDeleteSavedLocationMutation();
  const [deleteAccount, { isLoading: isDeletingAccount }] =
    useDeleteAccountMutation();

  // Extract data
  const user = profileData?.data || profileData || authUser;
  const savedLocations = savedLocationsData?.data || savedLocationsData || [];
  const emergencyContacts =
    emergencyContactsData?.data || emergencyContactsData || [];
  const userStats = userStatsData?.data || userStatsData || {};

  // Local state
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Form state
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // New location form
  const [newLocation, setNewLocation] = useState({
    label: '',
    address: '',
    type: 'other', // home, work, other
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Update Redux when profile data changes
  useEffect(() => {
    if (profileData?.data || profileData) {
      dispatch(setUser(profileData?.data || profileData));
    }
  }, [profileData, dispatch]);

  // Default saved locations display
  const displayLocations = [
    {
      id: 'home',
      icon: '🏠',
      label: 'Home',
      type: 'home',
      address:
        savedLocations.find((l) => l.type === 'home')?.address ||
        'Add home address',
      isSet: savedLocations.some((l) => l.type === 'home'),
    },
    {
      id: 'work',
      icon: '💼',
      label: 'Work',
      type: 'work',
      address:
        savedLocations.find((l) => l.type === 'work')?.address ||
        'Add work address',
      isSet: savedLocations.some((l) => l.type === 'work'),
    },
    ...savedLocations
      .filter((l) => l.type === 'other')
      .map((l) => ({
        id: l._id,
        icon: '📍',
        label: l.label || 'Saved Place',
        type: 'other',
        address: l.address,
        isSet: true,
      })),
  ];

  const menuItems = [
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
        </svg>
      ),
      label: 'Saved Locations',
      path: '/saved-locations',
      badge: savedLocations.length || null,
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      ),
      label: 'Emergency Contacts',
      path: '/emergency-contacts',
      badge: emergencyContacts.length || null,
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      ),
      label: 'Payment Methods',
      path: '/payment-methods',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Wallet',
      path: '/wallet',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Ride History',
      path: '/rides/history',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      label: 'Notifications',
      path: '/notifications-settings',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      label: 'Privacy & Security',
      path: '/privacy',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Help & Support',
      path: '/help',
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'About',
      path: '/about',
    },
  ];

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMessage({ type: '', text: '' });
  };

  const handleSave = async () => {
    try {
      setMessage({ type: '', text: '' });

      const result = await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      }).unwrap();

      const updatedUser = result?.data || result;
      dispatch(setUser(updatedUser));

      // Update localStorage
      const authData = JSON.parse(localStorage.getItem('auth') || '{}');
      authData.user = updatedUser;
      localStorage.setItem('auth', JSON.stringify(authData));

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);

      // Refetch profile to ensure sync
      refetchProfile();
    } catch (err) {
      console.error('Update profile error:', err);
      setMessage({
        type: 'error',
        text: err?.data?.message || 'Failed to update profile. Please try again.',
      });
    }
  };

  const handleProfilePictureClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      await uploadProfilePicture(formData).unwrap();
      setMessage({ type: 'success', text: 'Profile picture updated!' });
      refetchProfile();
    } catch (err) {
      console.error('Upload error:', err);
      setMessage({
        type: 'error',
        text: err?.data?.message || 'Failed to upload picture',
      });
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.label || !newLocation.address) {
      setMessage({ type: 'error', text: 'Please fill all fields' });
      return;
    }

    try {
      await addSavedLocation(newLocation).unwrap();
      setShowAddLocationModal(false);
      setNewLocation({ label: '', address: '', type: 'other' });
      setMessage({ type: 'success', text: 'Location added successfully!' });
    } catch (err) {
      console.error('Add location error:', err);
      setMessage({
        type: 'error',
        text: err?.data?.message || 'Failed to add location',
      });
    }
  };

  const handleLocationClick = (location) => {
    if (!location.isSet) {
      setNewLocation({
        label: location.label,
        address: '',
        type: location.type,
      });
      setShowAddLocationModal(true);
    } else {
      navigate('/saved-locations', { state: { editLocation: location } });
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);

      // Call logout API if you have one
      // await logoutApi().unwrap();

      // Clear local storage
      localStorage.removeItem('auth');

      // Clear Redux state
      dispatch(clearAuth());

      // Navigate to login
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      // Even if API fails, clear local state
      localStorage.removeItem('auth');
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type DELETE to confirm' });
      return;
    }

    try {
      await deleteAccount({ confirmation: 'DELETE' }).unwrap();
      localStorage.removeItem('auth');
      dispatch(clearAuth());
      navigate('/login', {
        replace: true,
        state: { message: 'Account deleted successfully' },
      });
    } catch (err) {
      console.error('Delete account error:', err);
      setMessage({
        type: 'error',
        text: err?.data?.message || 'Failed to delete account',
      });
    }
  };

  // Loading state
  if (isLoadingProfile && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader size="lg" />
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (profileError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to load profile
          </h2>
          <p className="text-gray-500 mb-6">
            Please check your connection and try again
          </p>
          <Button onClick={() => refetchProfile()} fullWidth>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Please login
          </h2>
          <p className="text-gray-500 mb-6">
            You need to be logged in to view your profile
          </p>
          <Button onClick={() => navigate('/login')} fullWidth>
            Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 font-medium text-sm hover:text-blue-700 transition-colors"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsEditing(false);
                  setMessage({ type: '', text: '' });
                  // Reset form to original values
                  setForm({
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || '',
                    phone: user.phone || '',
                  });
                }}
                className="text-gray-600 font-medium text-sm hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Global Message */}
        {message.text && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
              />
              <button
                onClick={handleProfilePictureClick}
                disabled={!isEditing || isUploadingPicture}
                className={`relative ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.firstName}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
                    {user.firstName?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {isUploadingPicture && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <Loader size="sm" className="text-white" />
                  </div>
                )}
              </button>
              {isEditing && !isUploadingPicture && (
                <div className="absolute bottom-0 right-0 h-8 w-8 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200">
                  <svg
                    className="h-4 w-4 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-500 truncate">{user.email}</p>
              <p className="text-sm text-gray-400">{user.phone}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="text-gray-300">--</span>
                ) : (
                  user.ratings?.average?.toFixed(1) ||
                  userStats?.rating?.toFixed(1) ||
                  '5.0'
                )}
              </p>
              <p className="text-xs text-gray-500">Rating</p>
            </div>
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {isLoadingStats ? (
                  <span className="text-gray-300">--</span>
                ) : (
                  user.totalRides || userStats?.totalRides || 0
                )}
              </p>
              <p className="text-xs text-gray-500">Rides</p>
            </div>
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {new Date(user.createdAt).getFullYear()}
              </p>
              <p className="text-xs text-gray-500">Member since</p>
            </div>
          </div>
        </section>

        {/* Edit Form */}
        {isEditing && (
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Profile
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  disabled={isUpdating}
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  disabled={isUpdating}
                />
              </div>
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isUpdating}
              />
              <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                disabled={isUpdating}
                helperText="Changing phone number may require verification"
              />

              <Button
                onClick={handleSave}
                disabled={isUpdating}
                fullWidth
                className="mt-2"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size="sm" />
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </section>
        )}

        {/* Saved Locations */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Saved Locations</h3>
            {isLoadingLocations && <Loader size="sm" />}
          </div>
          <div className="divide-y divide-gray-100">
            {displayLocations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-2xl">{loc.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{loc.label}</p>
                  <p
                    className={`text-sm truncate ${
                      loc.isSet ? 'text-gray-500' : 'text-blue-600'
                    }`}
                  >
                    {loc.address}
                  </p>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
            <button
              onClick={() => {
                setNewLocation({ label: '', address: '', type: 'other' });
                setShowAddLocationModal(true);
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left text-blue-600"
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="font-medium">Add new location</span>
            </button>
          </div>
        </section>

        {/* Emergency Contacts Preview */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Emergency Contacts</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                These contacts will be notified in case of emergency
              </p>
            </div>
            {isLoadingContacts && <Loader size="sm" />}
          </div>
          <div className="px-6 py-4">
            {emergencyContacts.length > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {emergencyContacts.slice(0, 3).map((contact, idx) => (
                    <div
                      key={contact._id || idx}
                      className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-sm font-medium text-red-700 border-2 border-white"
                    >
                      {contact.name?.[0]?.toUpperCase() || 'E'}
                    </div>
                  ))}
                  {emergencyContacts.length > 3 && (
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-700 border-2 border-white">
                      +{emergencyContacts.length - 3}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    {emergencyContacts.length} contact
                    {emergencyContacts.length > 1 ? 's' : ''} added
                  </p>
                </div>
                <Link
                  to="/emergency-contacts"
                  className="text-blue-600 text-sm font-medium hover:text-blue-700"
                >
                  Manage
                </Link>
              </div>
            ) : (
              <Link
                to="/emergency-contacts"
                className="flex items-center gap-3 text-blue-600"
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="font-medium">Add emergency contacts</span>
              </Link>
            )}
          </div>
        </section>

        {/* Menu Items */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  {item.icon}
                </div>
                <span className="flex-1 font-medium text-gray-900">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-red-600">Danger Zone</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors text-red-600"
            >
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <span className="font-medium">Logout</span>
            </button>
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors text-red-600"
            >
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <span className="font-medium">Delete Account</span>
            </button>
          </div>
        </section>

        {/* Version */}
        <p className="text-center text-sm text-gray-400 py-4">
          Version 1.0.0 • Made with ❤️
        </p>
      </main>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to logout from your account?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLogoutModal(false)}
              className="flex-1"
              disabled={loggingOut}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogout}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={loggingOut}
            >
              {loggingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size="sm" />
                  Logging out...
                </span>
              ) : (
                'Logout'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteAccountModal}
        onClose={() => {
          setShowDeleteAccountModal(false);
          setDeleteConfirmText('');
        }}
        title="Delete Account"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="h-6 w-6 text-red-600 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-medium text-red-800">Warning</h4>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. All your data including ride
                  history, saved locations, and wallet balance will be permanently
                  deleted.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteAccountModal(false);
                setDeleteConfirmText('');
              }}
              className="flex-1"
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
            >
              {isDeletingAccount ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size="sm" />
                  Deleting...
                </span>
              ) : (
                'Delete Account'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Location Modal */}
      <Modal
        isOpen={showAddLocationModal}
        onClose={() => {
          setShowAddLocationModal(false);
          setNewLocation({ label: '', address: '', type: 'other' });
        }}
        title={`Add ${newLocation.type === 'home' ? 'Home' : newLocation.type === 'work' ? 'Work' : 'New'} Location`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {newLocation.type === 'other' && (
            <Input
              label="Label"
              placeholder="e.g., Gym, Parents' Home"
              value={newLocation.label}
              onChange={(e) =>
                setNewLocation((prev) => ({ ...prev, label: e.target.value }))
              }
              disabled={isAddingLocation}
            />
          )}
          <Input
            label="Address"
            placeholder="Enter full address"
            value={newLocation.address}
            onChange={(e) =>
              setNewLocation((prev) => ({ ...prev, address: e.target.value }))
            }
            disabled={isAddingLocation}
          />
          <Button
            onClick={handleAddLocation}
            fullWidth
            disabled={isAddingLocation || !newLocation.address}
          >
            {isAddingLocation ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Saving...
              </span>
            ) : (
              'Save Location'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;