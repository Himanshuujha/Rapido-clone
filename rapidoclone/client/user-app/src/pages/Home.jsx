// src/pages/Home.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import useAuth from '../hooks/useAuth';
import useLocation from '../hooks/useLocation';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

// Import from specific API files
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
  const promoRef = useRef(null);
  
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
  
  const { 
    data: activeRideData, 
    isLoading: activeRideLoading, 
    error: activeRideError,
    refetch: refetchActiveRide,
  } = useGetActiveRideQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 10000,
    refetchOnMountOrArgChange: true,
  });

  const { 
    data: recentRidesData, 
    isLoading: recentRidesLoading, 
    error: recentRidesError,
  } = useGetRecentRidesQuery(undefined, {
    skip: !isAuthenticated,
  });

  const { 
    data: rideHistoryData, 
    isLoading: rideHistoryLoading,
  } = useGetRideHistoryQuery({ limit: 10 }, {
    skip: !isAuthenticated,
  });

  const {
    data: rideStatsData,
    isLoading: rideStatsLoading,
  } = useGetUserRideStatsQuery(undefined, {
    skip: !isAuthenticated,
  });

  const { 
    data: walletBalanceData, 
    isLoading: walletLoading,
    error: walletError,
    refetch: refetchWallet,
  } = useGetWalletBalanceQuery(undefined, {
    skip: !isAuthenticated,
  });

  const {
    data: rewardsData,
    isLoading: rewardsLoading,
  } = useGetRewardsQuery(undefined, {
    skip: !isAuthenticated,
  });

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
  const [isScrolled, setIsScrolled] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  // ===== Extract Data =====
  const activeRide = activeRideData?.data || activeRideData;
  const walletBalance = walletBalanceData?.data?.balance || walletBalanceData?.balance || cachedBalance || 0;
  const walletCurrency = walletBalanceData?.data?.currency || walletBalanceData?.currency || 'INR';
  const rewards = rewardsData?.data || rewardsData || [];
  const savedLocations = savedLocationsData?.data || savedLocationsData || [];
  const rideStats = rideStatsData?.data || rideStatsData || {};

  // ===== Effects =====

  // Handle scroll for floating header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // ===== Helper Functions =====

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: walletCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [walletCurrency]);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-IN', { weekday: 'long' });
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, []);

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
    } else if (destination.type === 'home' || destination.type === 'work') {
      navigate('/saved-locations', { state: { addType: destination.type } });
    } else {
      navigate('/book-ride', { state: { searchQuery: destination.label } });
    }
  }, [navigate]);

  const handleVehicleSelect = useCallback((vehicleType) => {
    navigate('/book-ride', { state: { vehicleType } });
  }, [navigate]);

  const handleSearchClick = useCallback(() => {
    navigate('/book-ride');
  }, [navigate]);

  const handleActiveRideClick = useCallback(() => {
    navigate('/rides/active');
  }, [navigate]);

  const handleRetryLocation = useCallback(() => {
    setShowLocationPrompt(false);
    getCurrentLocation();
  }, [getCurrentLocation]);

  const copyPromoCode = useCallback((code) => {
    navigator.clipboard.writeText(code);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  }, []);

  // Swipe handling for promotions
  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
      } else {
        setCurrentPromoIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
      }
    }
    setTouchStart(null);
  };

  // ===== Build Quick Destinations =====
  const quickDestinations = React.useMemo(() => {
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
        coordinates: null,
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
      isPopular: true,
    },
    {
      id: 'auto',
      icon: '🛺',
      name: 'Auto',
      description: 'Comfortable for 3',
      eta: '4 min',
      basePrice: 30,
      isPopular: false,
    },
    {
      id: 'cab',
      icon: '🚗',
      name: 'Cab',
      description: 'AC, comfortable',
      eta: '5 min',
      basePrice: 50,
      isPopular: false,
    },
  ];

  // ===== Promotions =====
  const promotions = [
    {
      id: 1,
      title: '50% OFF',
      subtitle: 'On your first 3 rides',
      code: 'FIRST50',
      bgColor: 'from-purple-500 via-purple-600 to-pink-500',
      icon: '🎉',
    },
    {
      id: 2,
      title: 'FREE RIDE',
      subtitle: 'Refer a friend & earn',
      code: 'REFER100',
      bgColor: 'from-blue-500 via-blue-600 to-cyan-500',
      icon: '👥',
    },
    {
      id: 3,
      title: '₹30 OFF',
      subtitle: 'Weekend special offer',
      code: 'WEEKEND30',
      bgColor: 'from-orange-500 via-orange-600 to-yellow-500',
      icon: '🌟',
    },
  ];

  // ===== Computed Values =====
  const hasActiveRide = activeRide && 
    activeRide.status && 
    !['completed', 'cancelled'].includes(activeRide.status);
  
  const totalRides = rideStats?.totalRides || recentRides.length || 0;
  const rewardsCount = rewards.length;

  // ===== Render =====
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Floating Header on Scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/90 backdrop-blur-lg shadow-lg py-3 translate-y-0'
            : 'bg-transparent py-0 -translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">🚗</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">RideApp</p>
              <p className="text-xs text-gray-500 truncate max-w-[150px]">
                {currentAddress || 'Set location'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/wallet"
              className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold border border-green-200"
            >
              <span className="text-base">💰</span>
              {formatCurrency(walletBalance)}
            </Link>
            <button
              onClick={handleSearchClick}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25"
            >
              Book Ride
            </button>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <header className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/5 blur-3xl animate-pulse" />
          <div className="absolute top-20 -left-20 h-60 w-60 rounded-full bg-blue-400/10 blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-10 right-20 h-40 w-40 rounded-full bg-indigo-400/10 blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
          
          {/* Decorative Grid */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
          </div>
          
          {/* Floating Dots */}
          <div className="absolute top-10 right-10 grid grid-cols-3 gap-2 opacity-20">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-2 w-2 rounded-full bg-white" />
            ))}
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-xl">
                <span className="text-2xl">🚗</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold">
                    {getGreeting()}, {user?.firstName || 'there'}!
                  </h1>
                  <span className="text-2xl animate-bounce">👋</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {locationLoading ? (
                    <div className="flex items-center gap-2 text-blue-200">
                      <div className="h-4 w-4 border-2 border-blue-200 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Getting location...</span>
                    </div>
                  ) : currentAddress ? (
                    <button
                      onClick={handleSearchClick}
                      className="flex items-center gap-1.5 text-blue-100 hover:text-white transition-colors group"
                    >
                      <div className="h-5 w-5 rounded-full bg-green-400/30 flex items-center justify-center">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                      </div>
                      <span className="text-sm truncate max-w-[200px] sm:max-w-[300px]">
                        {currentAddress}
                      </span>
                      <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleRetryLocation}
                      className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span className="text-sm">Enable location</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-2">
              {/* Wallet Pill - Desktop */}
              <Link
                to="/wallet"
                className="hidden sm:flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 hover:bg-white/25 transition-all border border-white/20 group"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-lg">💳</span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-blue-200">Balance</p>
                  <p className="text-sm font-bold">
                    {walletLoading ? (
                      <span className="inline-block h-4 w-16 bg-white/20 rounded animate-pulse" />
                    ) : (
                      formatCurrency(walletBalance)
                    )}
                  </p>
                </div>
                <svg className="h-4 w-4 text-blue-200 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Rewards Badge */}
              {rewardsCount > 0 && (
                <Link
                  to="/wallet"
                  state={{ showRewards: true }}
                  className="relative p-2.5 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20 group"
                  title={`${rewardsCount} rewards available`}
                >
                  <span className="text-xl group-hover:scale-125 transition-transform inline-block">🎁</span>
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-br from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {rewardsCount}
                  </span>
                </Link>
              )}

              {/* Notifications */}
              <Link
                to="/notifications"
                className="relative p-2.5 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20 group"
              >
                <svg
                  className="h-6 w-6 group-hover:scale-110 transition-transform"
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
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-blue-700" />
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full animate-ping" />
              </Link>

              {/* Profile */}
              <Link
                to="/profile"
                className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-semibold hover:bg-white/30 transition-all overflow-hidden border-2 border-white/30 group"
              >
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.firstName}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {user?.firstName?.[0]?.toUpperCase() || '👤'}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Active Ride Banner */}
          {hasActiveRide && (
            <div
              className="relative bg-white/10 backdrop-blur-md rounded-2xl p-5 cursor-pointer hover:bg-white/15 transition-all border border-white/20 shadow-xl overflow-hidden group mb-6"
              onClick={handleActiveRideClick}
            >
              {/* Animated gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-blue-400/20 to-purple-400/20 opacity-50" />
              
              {/* Progress bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000"
                  style={{ 
                    width: activeRide.status === 'started' || activeRide.status === 'in_progress' 
                      ? '75%' 
                      : activeRide.status === 'arrived' 
                      ? '50%' 
                      : '25%' 
                  }}
                />
              </div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div className="absolute inset-0 rounded-2xl border-2 border-green-400/50 animate-ping" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/30 text-green-100 border border-green-400/30">
                        <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />
                        LIVE
                      </span>
                      <p className="font-semibold text-lg">Ride in progress</p>
                    </div>
                    <p className="text-sm text-blue-100 mt-1 max-w-[250px] truncate">
                      {activeRide.status === 'started' || activeRide.status === 'in_progress'
                        ? `🚗 On the way to ${activeRide.destination?.address?.slice(0, 25) || 'destination'}...`
                        : activeRide.status === 'arrived'
                        ? '📍 Captain arrived - Share your OTP'
                        : activeRide.status === 'arriving'
                        ? `⏱️ Arriving in ${activeRide.eta || 'few'} min`
                        : '🔄 Captain is on the way'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {activeRide.otp && activeRide.status === 'arrived' && (
                    <div className="bg-white rounded-xl px-4 py-2 shadow-lg">
                      <p className="text-xs text-gray-500 font-medium">OTP</p>
                      <p className="text-xl font-bold text-blue-700 tracking-wider font-mono">
                        {activeRide.otp.code || activeRide.otp}
                      </p>
                    </div>
                  )}
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <svg
                      className="h-5 w-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Captain info */}
              {activeRide.captain && (
                <div className="relative mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/30">
                      {activeRide.captain.profilePicture ? (
                        <img
                          src={activeRide.captain.profilePicture}
                          alt={activeRide.captain.firstName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">👨‍✈️</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {activeRide.captain.firstName} {activeRide.captain.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-blue-200">
                          {activeRide.captain.vehicle?.registrationNumber}
                        </span>
                        <span className="inline-flex items-center text-yellow-300 text-sm">
                          ⭐ {activeRide.captain.ratings?.average?.toFixed(1) || '4.5'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`tel:${activeRide.captain.phone}`);
                      }}
                      className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg"
                    >
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/chat/${activeRide._id}`);
                      }}
                      className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden transform hover:scale-[1.01] transition-transform">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={handleSearchClick}
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <svg
                  className="h-6 w-6 text-white"
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
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-sm">Where to?</p>
                <p className="text-gray-900 font-semibold text-lg truncate">
                  Search for a destination
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/book-ride', { state: { scheduleRide: true } });
                  }}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">Later</span>
                </button>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Location indicator */}
            <div className="mx-4 mb-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  {locationLoading ? (
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : permissionStatus === 'denied' ? (
                    <button
                      onClick={handleRetryLocation}
                      className="h-10 w-10 rounded-xl bg-yellow-50 flex items-center justify-center hover:bg-yellow-100 transition-colors"
                    >
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </button>
                  ) : currentLocation ? (
                    <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <div className="relative">
                        <div className="h-3 w-3 bg-green-500 rounded-full" />
                        <div className="absolute inset-0 h-3 w-3 bg-green-500 rounded-full animate-ping opacity-50" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    Pickup Location
                  </p>
                  <p className="text-sm text-gray-700 font-medium truncate">
                    {locationLoading
                      ? 'Detecting location...'
                      : permissionStatus === 'denied'
                      ? 'Tap to enable location access'
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
                    className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors group flex-shrink-0"
                    title="Refresh location"
                  >
                    <svg
                      className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-500"
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

        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full h-8 sm:h-12">
            <path
              d="M0 60V0c240 40 480 60 720 60s480-20 720-60v60H0z"
              className="fill-gray-50"
            />
          </svg>
        </div>
      </header>

      {/* Location Permission Banner */}
      {showLocationPrompt && (
        <div className="sticky top-0 z-40 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200 px-4 py-3 animate-slideDown">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-yellow-800">Enable location for faster pickup</p>
                <p className="text-xs text-yellow-600">We'll find captains near you quickly</p>
              </div>
            </div>
            <button
              onClick={handleRetryLocation}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-yellow-500/30 flex-shrink-0"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 -mt-4 relative z-10">
        
        {/* Quick Destinations */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quick access</h2>
              <p className="text-sm text-gray-500 mt-0.5">Your saved locations</p>
            </div>
            <Link
              to="/saved-locations"
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {savedLocationsLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 animate-pulse shadow-sm">
                  <div className="h-14 w-14 bg-gray-200 rounded-xl mb-3" />
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded mt-2" />
                </div>
              ))
            ) : (
              quickDestinations.map((dest, index) => (
                <button
                  key={dest.id}
                  onClick={() => handleQuickDestination(dest)}
                  className={`relative bg-white rounded-2xl p-5 text-left hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 ${
                    !dest.isSet && (dest.id === 'home' || dest.id === 'work')
                      ? 'border-2 border-dashed border-gray-200 hover:border-blue-300'
                      : 'shadow-md border border-gray-100 hover:border-blue-200'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {dest.isSet && (
                    <div className="absolute top-3 right-3">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </div>
                  )}
                  <div className={`h-14 w-14 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
                    dest.id === 'home' ? 'bg-blue-50' :
                    dest.id === 'work' ? 'bg-purple-50' :
                    dest.id === 'airport' ? 'bg-sky-50' :
                    'bg-orange-50'
                  }`}>
                    <span className="text-3xl">{dest.icon}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{dest.label}</p>
                  {dest.isSet ? (
                    <p className="text-xs text-gray-500 mt-1 truncate pr-4">{dest.address}</p>
                  ) : (dest.id === 'home' || dest.id === 'work') ? (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add address
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Tap to search</p>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Vehicle Types */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Choose your ride</h2>
              <p className="text-sm text-gray-500 mt-0.5">Select vehicle type</p>
            </div>
            <Link
              to="/book-ride"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              See all
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {vehicleTypes.map((vehicle, index) => (
              <button
                key={vehicle.id}
                onClick={() => handleVehicleSelect(vehicle.id)}
                className="relative bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 border border-gray-100 hover:border-blue-200 overflow-hidden text-left"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Background decoration */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-blue-50 to-transparent opacity-50 group-hover:scale-150 transition-transform duration-500" />
                
                {vehicle.isPopular && (
                  <span className="absolute top-3 right-3 text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
                    Popular
                  </span>
                )}
                
                <div className="relative flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                      <span className="text-4xl">{vehicle.icon}</span>
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-lg">{vehicle.name}</p>
                    <p className="text-sm text-gray-500 truncate">{vehicle.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-semibold text-gray-900">
                        From {formatCurrency(vehicle.basePrice)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                        <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                        {vehicle.eta}
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Promotions Carousel */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Special offers</h2>
              <p className="text-sm text-gray-500 mt-0.5">Exclusive deals for you</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPromoIndex((prev) => (prev - 1 + promotions.length) % promotions.length)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-1.5">
                {promotions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPromoIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentPromoIndex === idx
                        ? 'w-6 bg-blue-600'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentPromoIndex((prev) => (prev + 1) % promotions.length)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <div 
            className="relative overflow-hidden rounded-2xl"
            ref={promoRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentPromoIndex * 100}%)` }}
            >
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`flex-shrink-0 w-full p-6 sm:p-8 bg-gradient-to-br ${promo.bgColor} text-white relative overflow-hidden`}
                >
                  {/* Decorative elements */}
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                  <div className="absolute right-5 top-5 text-6xl sm:text-8xl opacity-20">{promo.icon}</div>
                  
                  <div className="relative">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/30">
                        <span className="text-4xl sm:text-5xl">{promo.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-3xl sm:text-4xl font-bold">{promo.title}</p>
                        <p className="text-base sm:text-lg opacity-90 mt-1">{promo.subtitle}</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                        <p className="text-xs opacity-75">Promo Code</p>
                        <p className="text-lg sm:text-xl font-mono font-bold tracking-wider">{promo.code}</p>
                      </div>
                      <button
                        onClick={() => copyPromoCode(promo.code)}
                        className="flex items-center gap-2 bg-white/25 hover:bg-white/35 backdrop-blur-sm px-5 py-3 rounded-xl font-semibold transition-all border border-white/20 hover:scale-105"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Code
                      </button>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2 text-sm opacity-75">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Valid till end of month
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile promo cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 mt-4 -mx-4 px-4 sm:hidden scrollbar-hide">
            {promotions.map((promo, idx) => (
              <div
                key={promo.id}
                onClick={() => setCurrentPromoIndex(idx)}
                className={`flex-shrink-0 w-44 p-4 rounded-xl bg-gradient-to-br ${promo.bgColor} text-white cursor-pointer transition-all ${
                  currentPromoIndex === idx ? 'ring-2 ring-white ring-offset-2' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <span className="text-2xl mb-2 block">{promo.icon}</span>
                <p className="text-lg font-bold">{promo.title}</p>
                <p className="text-xs opacity-90 mt-0.5">{promo.subtitle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* User Stats */}
        {totalRides > 0 && (
          <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Your journey with us</h2>
                  <p className="text-sm text-blue-200">Keep riding to unlock rewards</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 text-center border border-white/10">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 mx-auto rounded-xl bg-blue-400/30 flex items-center justify-center mb-3">
                    <span className="text-2xl sm:text-3xl">🚗</span>
                  </div>
                  <p className="text-2xl sm:text-4xl font-bold">{rideStats?.totalRides || totalRides}</p>
                  <p className="text-sm text-blue-200 mt-1">Total Rides</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 text-center border border-white/10">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 mx-auto rounded-xl bg-green-400/30 flex items-center justify-center mb-3">
                    <span className="text-2xl sm:text-3xl">📍</span>
                  </div>
                  <p className="text-2xl sm:text-4xl font-bold">
                    {rideStats?.totalDistance || '--'}
                    <span className="text-lg">km</span>
                  </p>
                  <p className="text-sm text-blue-200 mt-1">Distance</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 text-center border border-white/10">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 mx-auto rounded-xl bg-yellow-400/30 flex items-center justify-center mb-3">
                    <span className="text-2xl sm:text-3xl">💰</span>
                  </div>
                  <p className="text-2xl sm:text-4xl font-bold">{formatCurrency(rideStats?.totalSaved || 0)}</p>
                  <p className="text-sm text-blue-200 mt-1">Saved</p>
                </div>
              </div>
              
              {/* Progress to next reward */}
              <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress to next reward</span>
                  <span className="text-sm text-blue-200">3 more rides</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-1000" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recent Rides */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent rides</h2>
              <p className="text-sm text-gray-500 mt-0.5">Your travel history</p>
            </div>
            {recentRides.length > 0 && (
              <Link
                to="/rides/history"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>

          {recentRidesLoading || rideHistoryLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 flex items-center gap-4 animate-pulse shadow-sm">
                  <div className="h-14 w-14 rounded-xl bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : recentRidesError ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <div className="h-20 w-20 mx-auto bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold text-lg">Failed to load ride history</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Please check your connection and try again</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : recentRides.length === 0 ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center border border-blue-100">
              <div className="h-24 w-24 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
                <span className="text-5xl">🚗</span>
              </div>
              <p className="text-gray-900 font-bold text-xl">No rides yet</p>
              <p className="text-sm text-gray-500 mt-2 mb-6 max-w-xs mx-auto">
                Book your first ride and start your journey with us!
              </p>
              <Button onClick={() => navigate('/book-ride')} size="lg">
                Book Your First Ride
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentRides.map((ride, index) => (
                <div
                  key={ride._id}
                  className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-100 hover:border-blue-200"
                  onClick={() => navigate(`/rides/${ride._id}`)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group-hover:from-blue-50 group-hover:to-blue-100 transition-colors">
                        <svg className="h-7 w-7 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center ${
                        ride.status === 'completed' ? 'bg-green-500' :
                        ride.status === 'cancelled' ? 'bg-red-500' : 'bg-gray-400'
                      }`}>
                        {ride.status === 'completed' && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {ride.status === 'cancelled' && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {ride.destination?.address || 'Unknown destination'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(ride.createdAt)}
                        </span>
                        <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          ride.status === 'completed' ? 'bg-green-100 text-green-700' :
                          ride.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ride.status?.charAt(0).toUpperCase() + ride.status?.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="font-bold text-gray-900 text-lg">
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
                        className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Rebook
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Safety Features */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
                <span className="text-2xl">🛡️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Safety first</h2>
                <p className="text-sm text-gray-500">Your safety is our priority</p>
              </div>
            </div>
            <Link to="/safety" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Learn more
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: '🆘', label: 'SOS', desc: 'Emergency help', link: '/emergency-contacts', color: 'red' },
              { icon: '📤', label: 'Share ride', desc: 'With contacts', color: 'blue' },
              { icon: '✅', label: 'Verified', desc: 'All captains', color: 'green' },
              { icon: '📍', label: 'Live track', desc: 'GPS enabled', color: 'purple' },
            ].map((item, idx) => (
              <Link
                key={idx}
                to={item.link || '#'}
                className={`group text-center p-5 rounded-2xl bg-gradient-to-br from-${item.color}-50 to-${item.color}-100/50 hover:from-${item.color}-100 hover:to-${item.color}-200/50 transition-all duration-300 border border-${item.color}-100`}
              >
                <div className="h-16 w-16 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-xl transition-all">
                  <span className="text-3xl">{item.icon}</span>
                </div>
                <p className="font-semibold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Referral Section */}
        <section className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 sm:p-8 text-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            <div className="h-20 w-20 sm:h-24 sm:w-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/30 shadow-xl flex-shrink-0">
              <span className="text-5xl">👥</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <span className="text-3xl">🎁</span>
                <h3 className="font-bold text-2xl sm:text-3xl">Refer & Earn ₹100</h3>
              </div>
              <p className="text-base sm:text-lg text-indigo-100">
                Invite your friends and earn ₹100 for each successful referral. Your friend gets ₹50 too!
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <p className="text-xs text-indigo-200">Your referral code</p>
                  <p className="text-lg font-mono font-bold tracking-wider">
                    {user?.referralCode || 'RIDE100'}
                  </p>
                </div>
                <Link
                  to="/wallet"
                  state={{ showReferral: true }}
                  className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Invite Friends
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 sm:hidden z-50 pb-safe">
        <div className="flex items-center justify-around py-2 px-2">
          <Link to="/" className="flex flex-col items-center py-2 px-4 text-blue-600 relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-600 rounded-full" />
            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
            <span className="text-xs mt-1 font-medium">Home</span>
          </Link>
          
          <Link to="/rides/history" className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-gray-700">
            <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs mt-1">Rides</span>
          </Link>
          
          <Link to="/book-ride" className="flex flex-col items-center -mt-6">
            <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 transition-all hover:scale-105 rotate-45">
              <svg className="h-7 w-7 text-white -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs mt-2 font-medium text-gray-500">Book</span>
          </Link>
          
          <Link to="/wallet" className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-gray-700 relative">
            <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="text-xs mt-1">Wallet</span>
            {rewardsCount > 0 && (
              <span className="absolute top-1 right-2 h-5 w-5 bg-gradient-to-br from-red-500 to-pink-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-lg animate-bounce">
                {rewardsCount}
              </span>
            )}
          </Link>
          
          <Link to="/profile" className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-gray-700">
            <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Spacer for bottom nav */}
      <div className="h-24 sm:hidden" />

      {/* Toast Notification */}
      {showCopiedToast && (
        <div className="fixed bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fadeInUp">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Code copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;