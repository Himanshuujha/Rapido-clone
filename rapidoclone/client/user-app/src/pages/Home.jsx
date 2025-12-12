// src/pages/Home.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import useAuth from '../hooks/useAuth';
import useLocation from '../hooks/useLocation';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

// Import from specific API files instead of apiSlice
import {
  useGetActiveRideQuery,
  useGetRideHistoryQuery,
  useGetRecentRidesQuery,
  useGetUserRideStatsQuery,
} from '../redux/api/rideApi';
import {
  useGetWalletBalanceQuery,
  useGetRewardsQuery,
} from '../redux/api/walletApi';
import {
  useGetSavedLocationsQuery,
} from '../redux/api/userApi';

// Import Redux actions
import { setRecentRides } from '../redux/slices/rideSlice';
import { setWalletBalance } from '../redux/slices/walletSlice';

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Auth hook
  const { user, isAuthenticated } = useAuth();
  
  // Location hook
  const { 
    currentLocation, 
    currentAddress,
    getCurrentLocation, 
    loading: locationLoading,
    error: locationError,
    permissionStatus,
  } = useLocation();

  // Redux state
  const { recentRides: cachedRecentRides } = useSelector((state) => state.ride);
  const { balance: cachedBalance } = useSelector((state) => state.wallet);

  // ===== API Queries =====
  
  // Active ride - poll every 10 seconds if there's an active ride
  const { 
    data: activeRideData, 
    isLoading: activeRideLoading, 
    error: activeRideError,
    refetch: refetchActiveRide,
  } = useGetActiveRideQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 10000, // Poll every 10 seconds
    refetchOnMountOrArgChange: true,
  });

  // Recent rides
  const { 
    data: recentRidesData, 
    isLoading: recentRidesLoading, 
    error: recentRidesError,
  } = useGetRecentRidesQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Full ride history (for stats)
  const { 
    data: rideHistoryData, 
    isLoading: rideHistoryLoading,
  } = useGetRideHistoryQuery({ limit: 10 }, {
    skip: !isAuthenticated,
  });

  // User ride stats
  const {
    data: rideStatsData,
    isLoading: rideStatsLoading,
  } = useGetUserRideStatsQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Wallet balance
  const { 
    data: walletBalanceData, 
    isLoading: walletLoading,
    error: walletError,
    refetch: refetchWallet,
  } = useGetWalletBalanceQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Rewards count
  const {
    data: rewardsData,
    isLoading: rewardsLoading,
  } = useGetRewardsQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Saved locations for quick destinations
  const {
    data: savedLocationsData,
    isLoading: savedLocationsLoading,
  } = useGetSavedLocationsQuery(undefined, {
    skip: !isAuthenticated,
  });

  // ===== Local State =====
  const [recentRides, setRecentRidesLocal] = useState([]);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  // ===== Extract Data =====
  const activeRide = activeRideData?.data || activeRideData;
  const walletBalance = walletBalanceData?.data?.balance || walletBalanceData?.balance || cachedBalance || 0;
  const walletCurrency = walletBalanceData?.data?.currency || walletBalanceData?.currency || 'INR';
  const rewards = rewardsData?.data || rewardsData || [];
  const savedLocations = savedLocationsData?.data || savedLocationsData || [];
  const rideStats = rideStatsData?.data || rideStatsData || {};

  // ===== Effects =====

  // Get current location on mount
  useEffect(() => {
    if (permissionStatus === 'idle' || permissionStatus === 'prompt') {
      getCurrentLocation();
    } else if (permissionStatus === 'denied') {
      setShowLocationPrompt(true);
    }
  }, [permissionStatus]);

  // Process recent rides data
  useEffect(() => {
    const rides = recentRidesData?.data || recentRidesData || 
                  rideHistoryData?.data?.slice(0, 3) || [];
    
    if (Array.isArray(rides) && rides.length > 0) {
      setRecentRidesLocal(rides.slice(0, 3));
      dispatch(setRecentRides(rides.slice(0, 5)));
    }
  }, [recentRidesData, rideHistoryData, dispatch]);

  // Update wallet balance in Redux
  useEffect(() => {
    if (walletBalanceData) {
      dispatch(setWalletBalance({
        balance: walletBalanceData?.data?.balance || walletBalanceData?.balance || 0,
        currency: walletBalanceData?.data?.currency || walletBalanceData?.currency || 'INR',
      }));
    }
  }, [walletBalanceData, dispatch]);

  // Auto-rotate promotions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Redirect to active ride if exists
  useEffect(() => {
    if (activeRide && activeRide.status && 
        !['completed', 'cancelled'].includes(activeRide.status)) {
      // Show notification or auto-redirect
      // navigate('/rides/active');
    }
  }, [activeRide]);

  // ===== Helper Functions =====

  // Get time-based greeting
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: walletCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [walletCurrency]);

  // Format date
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-IN', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  }, []);

  // Handle quick destination click
  const handleQuickDestination = useCallback((destination) => {
    if (destination.coordinates) {
      navigate('/book-ride', {
        state: {
          destination: {
            address: destination.address,
            coordinates: destination.coordinates,
          },
        },
      });
    } else {
      // Navigate to add location if not set
      navigate('/saved-locations', {
        state: { addType: destination.type },
      });
    }
  }, [navigate]);

  // Handle vehicle type selection
  const handleVehicleSelect = useCallback((vehicleType) => {
    navigate('/book-ride', {
      state: { vehicleType },
    });
  }, [navigate]);

  // Handle search bar click
  const handleSearchClick = useCallback(() => {
    navigate('/book-ride');
  }, [navigate]);

  // Handle active ride click
  const handleActiveRideClick = useCallback(() => {
    navigate('/rides/active');
  }, [navigate]);

  // Handle retry location permission
  const handleRetryLocation = useCallback(() => {
    setShowLocationPrompt(false);
    getCurrentLocation();
  }, [getCurrentLocation]);

  // ===== Build Quick Destinations =====
  const quickDestinations = React.useMemo(() => {
    // Find saved home and work locations
    const homeLocation = savedLocations.find(loc => loc.type === 'home');
    const workLocation = savedLocations.find(loc => loc.type === 'work');

    return [
      {
        id: 'home',
        icon: '🏠',
        label: 'Home',
        type: 'home',
        address: homeLocation?.address || 'Add home address',
        coordinates: homeLocation?.coordinates,
        isSet: !!homeLocation,
      },
      {
        id: 'work',
        icon: '💼',
        label: 'Work',
        type: 'work',
        address: workLocation?.address || 'Add work address',
        coordinates: workLocation?.coordinates,
        isSet: !!workLocation,
      },
      {
        id: 'airport',
        icon: '✈️',
        label: 'Airport',
        type: 'airport',
        address: 'Nearest airport',
        coordinates: null, // Will use search
        isSet: false,
      },
      {
        id: 'station',
        icon: '🚉',
        label: 'Station',
        type: 'station',
        address: 'Railway station',
        coordinates: null,
        isSet: false,
      },
    ];
  }, [savedLocations]);

  // ===== Vehicle Types =====
  const vehicleTypes = [
    {
      id: 'bike',
      icon: '🏍️',
      name: 'Bike',
      description: 'Affordable, quick rides',
      eta: '2 min',
      basePrice: 20,
    },
    {
      id: 'auto',
      icon: '🛺',
      name: 'Auto',
      description: 'Comfortable for 3',
      eta: '4 min',
      basePrice: 30,
    },
    {
      id: 'cab',
      icon: '🚗',
      name: 'Cab',
      description: 'AC, comfortable',
      eta: '5 min',
      basePrice: 50,
    },
  ];

  // ===== Promotions =====
  const promotions = [
    {
      id: 1,
      title: '50% OFF',
      subtitle: 'On your first 3 rides',
      code: 'FIRST50',
      bgColor: 'from-purple-500 to-pink-500',
      icon: '🎉',
    },
    {
      id: 2,
      title: 'FREE RIDE',
      subtitle: 'Refer a friend',
      code: 'REFER100',
      bgColor: 'from-blue-500 to-cyan-500',
      icon: '👥',
    },
    {
      id: 3,
      title: '₹30 OFF',
      subtitle: 'Weekend special',
      code: 'WEEKEND30',
      bgColor: 'from-orange-500 to-yellow-500',
      icon: '🌟',
    },
  ];

  // ===== Loading State =====
  const isLoading = activeRideLoading || recentRidesLoading || walletLoading;

  // ===== Computed Values =====
  const hasActiveRide = activeRide && 
    activeRide.status && 
    !['completed', 'cancelled'].includes(activeRide.status);
  
  const totalRides = rideStats?.totalRides || recentRides.length || 0;
  const rewardsCount = rewards.length;

  // ... rest of your component (return section)

    return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {user?.firstName || 'there'}! 👋
              </h1>
              <p className="mt-1 text-blue-100 text-sm flex items-center gap-2">
                {locationLoading ? (
                  <>
                    <Loader size="xs" className="text-blue-200" />
                    <span>Getting your location...</span>
                  </>
                ) : currentAddress ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="truncate max-w-[200px]">{currentAddress}</span>
                  </>
                ) : (
                  'Where would you like to go today?'
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Wallet Balance */}
              <Link
                to="/wallet"
                className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 hover:bg-white/30 transition-colors"
              >
                <svg
                  className="h-4 w-4"
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
                <span className="text-sm font-medium">
                  {walletLoading ? '...' : formatCurrency(walletBalance)}
                </span>
              </Link>

              {/* Rewards Badge */}
              {rewardsCount > 0 && (
                <Link
                  to="/wallet"
                  state={{ showRewards: true }}
                  className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                  title={`${rewardsCount} rewards available`}
                >
                  <span className="text-xl">🎁</span>
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {rewardsCount}
                  </span>
                </Link>
              )}

              {/* Notification bell */}
              <Link
                to="/notifications"
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg
                  className="h-6 w-6"
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
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </Link>

              {/* Profile avatar */}
              <Link
                to="/profile"
                className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-semibold hover:bg-white/30 transition-colors overflow-hidden"
              >
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.firstName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.firstName?.[0]?.toUpperCase() || 'U'
                )}
              </Link>
            </div>
          </div>

          {/* Active Ride Banner */}
          {hasActiveRide && (
            <div
              className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-all border border-white/20"
              onClick={handleActiveRideClick}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-white animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Ride in progress</p>
                    <p className="text-sm text-blue-100">
                      {activeRide.status === 'started' || activeRide.status === 'in_progress'
                        ? `On the way to ${activeRide.destination?.address?.slice(0, 30) || 'destination'}...`
                        : activeRide.status === 'arrived'
                        ? 'Captain has arrived - Share OTP'
                        : activeRide.status === 'arriving'
                        ? `Captain arriving in ${activeRide.eta || 'few'} min`
                        : 'Captain is on the way'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeRide.otp && activeRide.status === 'arrived' && (
                    <span className="bg-white text-blue-700 px-3 py-1 rounded-lg font-bold text-lg">
                      OTP: {activeRide.otp.code || activeRide.otp}
                    </span>
                  )}
                  <svg
                    className="h-6 w-6"
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
                </div>
              </div>

              {/* Captain info if available */}
              {activeRide.captain && (
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                    {activeRide.captain.profilePicture ? (
                      <img
                        src={activeRide.captain.profilePicture}
                        alt={activeRide.captain.firstName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-medium">
                        {activeRide.captain.firstName?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {activeRide.captain.firstName} {activeRide.captain.lastName}
                    </p>
                    <p className="text-sm text-blue-100">
                      {activeRide.captain.vehicle?.registrationNumber} • ⭐{' '}
                      {activeRide.captain.ratings?.average?.toFixed(1) || '4.5'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search/Book Ride Card */}
          <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={handleSearchClick}
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-sm">Where to?</p>
                <p className="text-gray-800 font-medium">
                  Search for a destination
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  Now
                </span>
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
              </div>
            </div>

            {/* Current location indicator */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {locationLoading ? (
                  <div className="h-8 w-8 flex items-center justify-center">
                    <Loader size="sm" />
                  </div>
                ) : permissionStatus === 'denied' ? (
                  <button
                    onClick={handleRetryLocation}
                    className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center"
                  >
                    <svg
                      className="h-4 w-4 text-yellow-600"
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
                  </button>
                ) : currentLocation ? (
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-gray-400"
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
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Your location</p>
                  <p className="text-sm text-gray-700">
                    {locationLoading
                      ? 'Detecting location...'
                      : permissionStatus === 'denied'
                      ? 'Location access denied - Tap to enable'
                      : currentLocation
                      ? currentAddress || 'Current location detected'
                      : 'Enable location for better experience'}
                  </p>
                </div>
                {currentLocation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      getCurrentLocation();
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Refresh location"
                  >
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Location Permission Prompt */}
      {showLocationPrompt && (
        <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-yellow-600"
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
              <p className="text-sm text-yellow-800">
                Enable location for faster pickup
              </p>
            </div>
            <button
              onClick={handleRetryLocation}
              className="text-sm font-medium text-yellow-700 hover:text-yellow-800"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Quick Destinations */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick access</h2>
            <Link
              to="/saved-locations"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Edit
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {savedLocationsLoading ? (
              // Skeleton loading
              [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm animate-pulse"
                >
                  <div className="h-10 w-10 bg-gray-200 rounded-full mb-2"></div>
                  <div className="h-4 w-12 bg-gray-200 rounded"></div>
                </div>
              ))
            ) : (
              quickDestinations.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => handleQuickDestination(dest)}
                  className={`flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${
                    !dest.isSet && dest.id !== 'airport' && dest.id !== 'station'
                      ? 'border-2 border-dashed border-gray-200'
                      : ''
                  }`}
                >
                  <span className="text-2xl mb-2">{dest.icon}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {dest.label}
                  </span>
                  {dest.isSet && (
                    <span className="text-xs text-gray-500 mt-1 truncate max-w-full px-1">
                      {dest.address.slice(0, 15)}...
                    </span>
                  )}
                  {!dest.isSet && (dest.id === 'home' || dest.id === 'work') && (
                    <span className="text-xs text-blue-600 mt-1">+ Add</span>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Vehicle Types */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Choose your ride
            </h2>
            <Link
              to="/book-ride"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {vehicleTypes.map((vehicle) => (
              <button
                key={vehicle.id}
                onClick={() => handleVehicleSelect(vehicle.id)}
                className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-500 border-2 border-transparent transition-all group"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">
                  {vehicle.icon}
                </span>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">{vehicle.name}</p>
                  <p className="text-sm text-gray-500">{vehicle.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    From {formatCurrency(vehicle.basePrice)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    {vehicle.eta}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Promotions Carousel */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Offers for you
            </h2>
            <div className="flex items-center gap-1">
              {promotions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPromoIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    currentPromoIndex === idx
                      ? 'w-4 bg-blue-600'
                      : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentPromoIndex * 100}%)` }}
            >
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`flex-shrink-0 w-full p-5 rounded-xl bg-gradient-to-r ${promo.bgColor} text-white`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-3xl mb-2 block">{promo.icon}</span>
                      <p className="text-3xl font-bold">{promo.title}</p>
                      <p className="text-sm opacity-90 mt-1">{promo.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-white/20 px-3 py-1.5 rounded-lg font-mono">
                        {promo.code}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs opacity-75">
                      Valid till end of month
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(promo.code);
                        // Show toast notification
                      }}
                      className="text-sm font-medium bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All offers link for mobile */}
          <div className="flex gap-3 overflow-x-auto pb-2 mt-4 -mx-4 px-4 sm:hidden">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className={`flex-shrink-0 w-48 p-3 rounded-xl bg-gradient-to-r ${promo.bgColor} text-white`}
              >
                <p className="text-lg font-bold">{promo.title}</p>
                <p className="text-xs opacity-90 mt-0.5">{promo.subtitle}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
                    {promo.code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* User Stats (if has rides) */}
        {totalRides > 0 && (
          <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your journey with us
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {rideStats?.totalRides || totalRides}
                </p>
                <p className="text-sm text-gray-600">Total Rides</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {rideStats?.totalDistance || '--'}
                </p>
                <p className="text-sm text-gray-600">Km Travelled</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {formatCurrency(rideStats?.totalSaved || 0)}
                </p>
                <p className="text-sm text-gray-600">Saved</p>
              </div>
            </div>
          </section>
        )}

        {/* Recent Rides */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent rides
            </h2>
            {recentRides.length > 0 && (
              <Link
                to="/rides/history"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View all
              </Link>
            )}
          </div>

          {recentRidesLoading || rideHistoryLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 flex items-center gap-4 animate-pulse"
                >
                  <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : recentRidesError ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="h-16 w-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
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
              <p className="text-gray-600 font-medium">
                Failed to load ride history
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Please try again later
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : recentRides.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="h-20 w-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-10 w-10 text-gray-400"
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
              </div>
              <p className="text-gray-800 font-medium text-lg">No rides yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Book your first ride and start your journey!
              </p>
              <Button onClick={() => navigate('/book-ride')}>
                Book Your First Ride
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRides.map((ride) => (
                <div
                  key={ride._id}
                  className="bg-white rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
                  onClick={() => navigate(`/rides/${ride._id}`)}
                >
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <svg
                      className="h-6 w-6 text-gray-600 group-hover:text-blue-600 transition-colors"
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {ride.destination?.address || 'Unknown destination'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">
                        {formatDate(ride.createdAt)}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          ride.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : ride.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ride.status?.charAt(0).toUpperCase() +
                          ride.status?.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(ride.fare?.total || ride.fare || 0)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/book-ride', {
                          state: {
                            destination: ride.destination,
                            vehicleType: ride.vehicleType,
                          },
                        });
                      }}
                      className="text-xs text-blue-600 font-medium hover:text-blue-700 mt-1"
                    >
                      Rebook →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Safety Features */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Safety first
            </h2>
            <Link
              to="/safety"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Learn more
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              to="/emergency-contacts"
              className="text-center p-4 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="h-14 w-14 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg
                  className="h-7 w-7 text-red-600"
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
              </div>
              <p className="text-sm font-medium text-gray-900">SOS</p>
              <p className="text-xs text-gray-500 mt-0.5">Emergency help</p>
            </Link>
            <div className="text-center p-4 rounded-xl hover:bg-gray-50 transition-colors group">
              <div className="h-14 w-14 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg
                  className="h-7 w-7 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Share ride</p>
              <p className="text-xs text-gray-500 mt-0.5">With contacts</p>
            </div>
            <div className="text-center p-4 rounded-xl hover:bg-gray-50 transition-colors group">
              <div className="h-14 w-14 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg
                  className="h-7 w-7 text-green-600"
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
              </div>
              <p className="text-sm font-medium text-gray-900">Verified</p>
              <p className="text-xs text-gray-500 mt-0.5">All captains</p>
            </div>
            <div className="text-center p-4 rounded-xl hover:bg-gray-50 transition-colors group">
              <div className="h-14 w-14 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg
                  className="h-7 w-7 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Live track</p>
              <p className="text-xs text-gray-500 mt-0.5">GPS enabled</p>
            </div>
          </div>
        </section>

        {/* App Download / Referral Section */}
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">👥</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Refer & Earn ₹100</h3>
              <p className="text-sm text-indigo-100 mt-1">
                Invite friends and earn ₹100 for each successful referral
              </p>
            </div>
            <Link
              to="/wallet"
              state={{ showReferral: true }}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium text-sm hover:bg-indigo-50 transition-colors flex-shrink-0"
            >
              Invite Now
            </Link>
          </div>
        </section>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-50">
        <div className="flex items-center justify-around py-2">
          <Link
            to="/"
            className="flex flex-col items-center py-2 px-3 text-blue-600"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Home</span>
          </Link>
          <Link
            to="/rides/history"
            className="flex flex-col items-center py-2 px-3 text-gray-500 hover:text-gray-700"
          >
            <svg
              className="h-6 w-6"
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
            <span className="text-xs mt-1">Rides</span>
          </Link>
          <Link to="/book-ride" className="flex flex-col items-center py-2 px-3">
            <div className="h-14 w-14 -mt-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors">
              <svg
                className="h-7 w-7 text-white"
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
            <span className="text-xs mt-1 text-gray-500">Book</span>
          </Link>
          <Link
            to="/wallet"
            className="flex flex-col items-center py-2 px-3 text-gray-500 hover:text-gray-700 relative"
          >
            <svg
              className="h-6 w-6"
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
            <span className="text-xs mt-1">Wallet</span>
            {rewardsCount > 0 && (
              <span className="absolute top-0 right-2 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {rewardsCount}
              </span>
            )}
          </Link>
          <Link
            to="/profile"
            className="flex flex-col items-center py-2 px-3 text-gray-500 hover:text-gray-700"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="h-20 sm:hidden"></div>
    </div>
  );
};

export default Home;