// src/pages/BookRide.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetFareEstimateMutation,
  useBookRideMutation,
  useValidateCouponMutation,
} from '../redux/api/rideApi';
import { useGetSavedLocationsQuery } from '../redux/api/userApi';
import { useGetWalletBalanceQuery } from '../redux/api/walletApi';
import {
  setPickup,
  setDestination,
  setSelectedVehicle,
  setFareEstimate,
  setActiveRide,
  setOTP,
} from '../redux/slices/rideSlice';
import useUserLocation from '../hooks/useLocation';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';

const BookRide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const searchInputRef = useRef(null);
  const destinationInputRef = useRef(null);

  // Redux state
  const { pickup, destination, selectedVehicle, fareEstimate } = useSelector(
    (state) => state.ride
  );

  // RTK Query mutations & queries
  const [getFareEstimate, { isLoading: isEstimating, error: estimateError }] =
    useGetFareEstimateMutation();
  const [bookRide, { isLoading: isBooking, error: bookingError }] =
    useBookRideMutation();
  const [validateCoupon, { isLoading: isValidatingCoupon }] =
    useValidateCouponMutation();

  const { data: savedLocationsData } = useGetSavedLocationsQuery();
  const { data: walletData } = useGetWalletBalanceQuery();

  // Custom hook for user location
  const {
    currentLocation,
    currentAddress,
    getCurrentLocation,
    loading: isLocationLoading,
    permissionStatus,
  } = useUserLocation();

  // Local state
  const [pickupInput, setPickupInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [rideNote, setRideNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [bookingStep, setBookingStep] = useState('idle'); // idle, finding, matched, arriving
  const [tipAmount, setTipAmount] = useState(0);
  const [showTipSection, setShowTipSection] = useState(false);

  // Extract data
  const savedLocations = savedLocationsData?.data || savedLocationsData || [];
  const walletBalance = walletData?.data?.balance || walletData?.balance || 0;

  // Vehicle types with more details
  const vehicleTypes = [
    {
      id: 'bike',
      icon: '🏍️',
      name: 'Bike',
      description: 'Quick & affordable',
      capacity: '1 person',
      eta: '2 min',
      priceMultiplier: 1,
      features: ['Fastest option', 'Single rider'],
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
    },
    {
      id: 'auto',
      icon: '🛺',
      name: 'Auto',
      description: 'Comfortable ride',
      capacity: '3 people',
      eta: '4 min',
      priceMultiplier: 1.5,
      features: ['Budget friendly', 'Up to 3 riders'],
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-500',
      popular: true,
    },
    {
      id: 'cab',
      icon: '🚗',
      name: 'Cab',
      description: 'AC, spacious',
      capacity: '4 people',
      eta: '5 min',
      priceMultiplier: 2,
      features: ['Air conditioned', 'Most comfortable'],
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
    },
    {
      id: 'premium',
      icon: '🚙',
      name: 'Premium',
      description: 'Luxury sedans',
      capacity: '4 people',
      eta: '7 min',
      priceMultiplier: 3,
      features: ['Premium cars', 'Top-rated drivers'],
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-500',
    },
  ];

  // Payment methods
  const paymentMethods = [
    { id: 'cash', icon: '💵', name: 'Cash', description: 'Pay after ride' },
    {
      id: 'wallet',
      icon: '👛',
      name: 'Wallet',
      balance: walletBalance,
      description: `Balance: ₹${walletBalance}`,
      disabled: walletBalance < (fareEstimate?.total || 0),
    },
    { id: 'upi', icon: '📱', name: 'UPI', description: 'Pay via UPI app' },
    {
      id: 'card',
      icon: '💳',
      name: 'Card',
      last4: '4242',
      description: '•••• 4242',
    },
  ];

  // Tip options
  const tipOptions = [0, 10, 20, 30, 50];

  // Quick location suggestions
  const quickLocations = [
    { id: 'current', icon: '📍', name: 'Current Location', type: 'current' },
    ...savedLocations.slice(0, 3).map((loc) => ({
      id: loc._id,
      icon: loc.type === 'home' ? '🏠' : loc.type === 'work' ? '💼' : '📍',
      name: loc.name || loc.type,
      address: loc.address,
      coordinates: loc.coordinates,
      type: loc.type,
    })),
  ];

  // Pre-fill from navigation state
  useEffect(() => {
    if (location.state?.vehicleType) {
      dispatch(setSelectedVehicle(location.state.vehicleType));
    }
    if (location.state?.destination) {
      const dest = location.state.destination;
      dispatch(setDestination(dest));
      setDestinationInput(dest.address || '');
    }
    if (location.state?.scheduleRide) {
      setShowScheduleModal(true);
    }
    if (location.state?.searchQuery) {
      setDestinationInput(location.state.searchQuery);
      setActiveInput('destination');
      destinationInputRef.current?.focus();
    }
  }, [location.state, dispatch]);

  // Use current location as pickup
  useEffect(() => {
    if (currentLocation && !pickup) {
      const pickupData = {
        address: currentAddress || 'Current Location',
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      };
      dispatch(setPickup(pickupData));
      setPickupInput(currentAddress || 'Current Location');
    }
  }, [currentLocation, currentAddress, pickup, dispatch]);

  // Fetch fare estimate when locations and vehicle change
  const fetchFareEstimate = useCallback(async () => {
    if (!pickup?.coordinates || !destination?.coordinates || !selectedVehicle) return;

    try {
      const result = await getFareEstimate({
        pickup: {
          address: pickup.address,
          coordinates: pickup.coordinates,
        },
        destination: {
          address: destination.address,
          coordinates: destination.coordinates,
        },
        vehicleType: selectedVehicle,
      }).unwrap();

      dispatch(setFareEstimate(result.data || result));
    } catch (err) {
      console.error('Failed to get fare estimate:', err);
    }
  }, [pickup, destination, selectedVehicle, getFareEstimate, dispatch]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchFareEstimate();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchFareEstimate]);

  // Debounced search function
  const handleSearch = useCallback(async (query, type) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setActiveInput(type);

    try {
      // Simulated API delay - Replace with actual Google Places API
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Mock search results
      const mockResults = [
        {
          id: '1',
          name: 'Indiranagar Metro Station',
          address: 'Indiranagar, Bangalore',
          coordinates: { latitude: 12.9784, longitude: 77.6408 },
          distance: '2.5 km',
        },
        {
          id: '2',
          name: 'Koramangala 4th Block',
          address: 'Koramangala, Bangalore',
          coordinates: { latitude: 12.9352, longitude: 77.6245 },
          distance: '4.2 km',
        },
        {
          id: '3',
          name: 'MG Road Metro Station',
          address: 'MG Road, Bangalore',
          coordinates: { latitude: 12.9757, longitude: 77.6073 },
          distance: '3.1 km',
        },
        {
          id: '4',
          name: 'Whitefield',
          address: 'Whitefield, Bangalore',
          coordinates: { latitude: 12.9698, longitude: 77.7500 },
          distance: '8.5 km',
        },
        {
          id: '5',
          name: 'Electronic City',
          address: 'Electronic City, Bangalore',
          coordinates: { latitude: 12.8456, longitude: 77.6603 },
          distance: '12.3 km',
        },
      ].filter(
        (loc) =>
          loc.name.toLowerCase().includes(query.toLowerCase()) ||
          loc.address.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(mockResults);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectLocation = (loc, type) => {
    const locationData = {
      address: loc.address ? `${loc.name}, ${loc.address}` : loc.name,
      coordinates: loc.coordinates,
    };

    if (type === 'pickup') {
      dispatch(setPickup(locationData));
      setPickupInput(locationData.address);
    } else {
      dispatch(setDestination(locationData));
      setDestinationInput(locationData.address);
    }
    setSearchResults([]);
    setActiveInput(null);
  };

  const handleQuickLocationSelect = async (loc, type) => {
    if (loc.type === 'current') {
      try {
        await getCurrentLocation();
        if (type === 'pickup') {
          setPickupInput('Current Location');
        }
      } catch (err) {
        console.error('Failed to get current location:', err);
      }
    } else if (loc.coordinates) {
      handleSelectLocation(loc, type);
    }
  };

  const handleVehicleChange = (vehicleId) => {
    dispatch(setSelectedVehicle(vehicleId));
  };

  const handleSwapLocations = () => {
    if (pickup && destination) {
      const tempPickup = pickup;
      const tempPickupInput = pickupInput;
      
      dispatch(setPickup(destination));
      dispatch(setDestination(tempPickup));
      setPickupInput(destinationInput);
      setDestinationInput(tempPickupInput);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setCouponError('');

    try {
      // Try API validation first
      if (validateCoupon) {
        const result = await validateCoupon({
          code: couponCode.toUpperCase(),
          fare: fareEstimate?.total || 0,
        }).unwrap();

        setCouponDiscount(result.discount || 0);
        setCouponApplied(true);
        setShowCouponInput(false);
        return;
      }
    } catch (err) {
      // Fallback to mock validation
    }

    // Mock coupon validation
    const code = couponCode.toUpperCase();
    if (code === 'FIRST50') {
      const discount = Math.round((fareEstimate?.total || 0) * 0.5);
      setCouponDiscount(Math.min(discount, 100)); // Max ₹100 discount
      setCouponApplied(true);
      setShowCouponInput(false);
    } else if (code === 'SAVE20') {
      const discount = Math.round((fareEstimate?.total || 0) * 0.2);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setShowCouponInput(false);
    } else if (code === 'FLAT30') {
      setCouponDiscount(30);
      setCouponApplied(true);
      setShowCouponInput(false);
    } else {
      setCouponError('Invalid or expired coupon code');
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponDiscount(0);
    setCouponError('');
  };

  const handleScheduleRide = (date, time) => {
    const scheduledDateTime = new Date(`${date}T${time}`);
    setScheduledTime(scheduledDateTime);
    setShowScheduleModal(false);
  };

  const handleBookRide = async () => {
    if (!pickup || !destination) {
      alert('Please select pickup and destination');
      return;
    }

    setBookingStep('finding');

    try {
      const bookingData = {
        pickup: {
          address: pickup.address,
          coordinates: pickup.coordinates,
        },
        destination: {
          address: destination.address,
          coordinates: destination.coordinates,
        },
        vehicleType: selectedVehicle,
        paymentMethod,
        ...(couponApplied && { couponCode: couponCode.toUpperCase() }),
        ...(scheduledTime && { scheduledTime: scheduledTime.toISOString() }),
        ...(rideNote && { note: rideNote }),
        ...(tipAmount > 0 && { tip: tipAmount }),
      };

      const result = await bookRide(bookingData).unwrap();

      dispatch(setActiveRide(result.data?.ride || result.ride));

      if (result.data?.otp || result.otp) {
        dispatch(setOTP(result.data?.otp || result.otp));
      }

      setBookingStep('matched');
      setShowPaymentModal(false);

      // Short delay to show success animation
      setTimeout(() => {
        navigate('/rides/active', {
          state: {
            rideId: result.data?.ride?._id || result.ride?._id,
            otp: result.data?.otp || result.otp,
          },
        });
      }, 1500);
    } catch (err) {
      console.error('Booking failed:', err);
      setBookingStep('idle');
      // Error is handled by bookingError state
    }
  };

  // Calculate final fare
  const selectedVehicleData = vehicleTypes.find((v) => v.id === selectedVehicle);
  const baseFare = fareEstimate
    ? Math.round(
        (fareEstimate.total || fareEstimate.fare || 0) *
          (selectedVehicleData?.priceMultiplier || 1)
      )
    : 0;
  const finalFare = Math.max(0, baseFare - couponDiscount + tipAmount);

  // Check if can proceed
  const canProceed = pickup?.coordinates && destination?.coordinates && selectedVehicle;

  // Generate schedule times
  const generateScheduleTimes = () => {
    const times = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (let i = 0; i < 24; i++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = (currentHour + Math.floor((currentMinute + 30 + i * 60 + m) / 60)) % 24;
        const minute = (currentMinute + 30 + m) % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayStr = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
        times.push({ value: timeStr, display: displayStr });
        if (times.length >= 20) break;
      }
      if (times.length >= 20) break;
    }
    return times;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors"
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
              <div>
                <h1 className="text-xl font-bold text-gray-900">Book a Ride</h1>
                {scheduledTime && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Scheduled for {scheduledTime.toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                scheduledTime
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {scheduledTime ? 'Change' : 'Schedule'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-32">
        {/* Location Inputs Card */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4">
            {/* Pickup Input */}
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-3">
                  <div className="relative">
                    <div className="h-4 w-4 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
                    <div className="absolute inset-0 h-4 w-4 bg-green-500 rounded-full animate-ping opacity-50" />
                  </div>
                  <div className="w-0.5 h-12 bg-gradient-to-b from-green-500 via-gray-300 to-red-500 my-1" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Pickup
                  </label>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={pickupInput}
                    onChange={(e) => {
                      setPickupInput(e.target.value);
                      handleSearch(e.target.value, 'pickup');
                    }}
                    onFocus={() => setActiveInput('pickup')}
                    placeholder="Enter pickup location"
                    className="w-full py-2 text-gray-900 font-medium focus:outline-none placeholder:text-gray-400 text-base"
                  />
                </div>
                <button
                  onClick={() => handleQuickLocationSelect({ type: 'current' }, 'pickup')}
                  disabled={isLocationLoading}
                  className="mt-3 p-2.5 hover:bg-blue-50 rounded-xl disabled:opacity-50 transition-colors group"
                  title="Use current location"
                >
                  {isLocationLoading ? (
                    <Loader size="sm" />
                  ) : (
                    <svg
                      className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform"
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
                  )}
                </button>
              </div>

              {/* Destination Input */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-3">
                  <div className="h-4 w-4 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Destination
                  </label>
                  <input
                    ref={destinationInputRef}
                    type="text"
                    value={destinationInput}
                    onChange={(e) => {
                      setDestinationInput(e.target.value);
                      handleSearch(e.target.value, 'destination');
                    }}
                    onFocus={() => setActiveInput('destination')}
                    placeholder="Where to?"
                    className="w-full py-2 text-gray-900 font-medium focus:outline-none placeholder:text-gray-400 text-base"
                  />
                </div>
              </div>

              {/* Swap Button */}
              {pickup && destination && (
                <button
                  onClick={handleSwapLocations}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors group"
                  title="Swap locations"
                >
                  <svg
                    className="h-4 w-4 text-gray-600 group-hover:rotate-180 transition-transform duration-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Quick Location Suggestions */}
          {activeInput && !searchResults.length && !isSearching && (
            <div className="border-t border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Quick select
              </p>
              <div className="flex flex-wrap gap-2">
                {quickLocations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleQuickLocationSelect(loc, activeInput)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                  >
                    <span>{loc.icon}</span>
                    <span>{loc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results Dropdown */}
          {(searchResults.length > 0 || isSearching) && activeInput && (
            <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader size="md" />
                  <span className="ml-3 text-gray-500">Searching...</span>
                </div>
              )}
              {searchResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectLocation(result, activeInput)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-b-0"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-gray-500"
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
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{result.name}</p>
                    <p className="text-sm text-gray-500 truncate">{result.address}</p>
                  </div>
                  {result.distance && (
                    <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-lg">
                      {result.distance}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Map Section */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-100 relative flex items-center justify-center">
            {/* This would be replaced with actual map component */}
            {pickup?.coordinates && destination?.coordinates ? (
              <div className="text-center px-4">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white shadow-lg mb-3">
                  <svg
                    className="h-8 w-8 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {fareEstimate?.distance || '--'} km
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {fareEstimate?.duration || '--'} min
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center px-4">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/50 backdrop-blur-sm mb-3">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">Select locations to see route</p>
              </div>
            )}

            {/* Decorative elements */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button className="h-10 w-10 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button className="h-10 w-10 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Vehicle Selection */}
        <section className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Choose your ride</h2>
            {isEstimating && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader size="sm" />
                <span>Updating fares...</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {vehicleTypes.map((vehicle, index) => {
              const vehicleFare = fareEstimate
                ? Math.round(
                    (fareEstimate.total || fareEstimate.fare || 0) *
                      vehicle.priceMultiplier
                  )
                : null;
              const isSelected = selectedVehicle === vehicle.id;

              return (
                <button
                  key={vehicle.id}
                  onClick={() => handleVehicleChange(vehicle.id)}
                  disabled={isEstimating}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group ${
                    isSelected
                      ? `${vehicle.borderColor} ${vehicle.bgColor}`
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  } ${isEstimating ? 'opacity-60' : ''}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Background gradient on select */}
                  {isSelected && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${vehicle.color} opacity-5`} />
                  )}

                  {/* Popular badge */}
                  {vehicle.popular && (
                    <span className="absolute top-2 right-2 text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-medium">
                      Popular
                    </span>
                  )}

                  <div className={`relative h-16 w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    isSelected ? 'bg-white shadow-lg' : 'bg-gray-100'
                  }`}>
                    <span className="text-4xl">{vehicle.icon}</span>
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-left relative">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-lg ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        {vehicle.name}
                      </p>
                      <span className="text-xs bg-gray-200/80 text-gray-600 px-2 py-0.5 rounded-full">
                        {vehicle.capacity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{vehicle.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {vehicle.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className="text-xs text-gray-500 flex items-center gap-1"
                        >
                          <span className="h-1 w-1 bg-gray-400 rounded-full" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right relative">
                    {isEstimating ? (
                      <div className="h-6 w-16 bg-gray-200 rounded-lg animate-pulse" />
                    ) : vehicleFare ? (
                      <p className={`text-xl font-bold ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        ₹{vehicleFare}
                      </p>
                    ) : (
                      <p className="text-gray-400 font-medium">--</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-xs text-green-600 font-medium">{vehicle.eta} away</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Fare Breakdown */}
        {fareEstimate && selectedVehicle && (
          <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Fare breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base fare</span>
                  <span className="text-gray-900 font-medium">
                    ₹{fareEstimate.baseFare || fareEstimate.breakdown?.baseFare || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Distance charge ({fareEstimate.distance || 0} km)
                  </span>
                  <span className="text-gray-900 font-medium">
                    ₹{fareEstimate.distanceFare || fareEstimate.breakdown?.distanceFare || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Time charge ({fareEstimate.duration || 0} min)
                  </span>
                  <span className="text-gray-900 font-medium">
                    ₹{fareEstimate.timeFare || fareEstimate.breakdown?.timeFare || 0}
                  </span>
                </div>

                {/* Surge pricing */}
                {fareEstimate.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600 flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Surge ({fareEstimate.surgeMultiplier}x)
                    </span>
                    <span className="text-orange-600 font-medium">
                      +₹{fareEstimate.surgeFare || 0}
                    </span>
                  </div>
                )}

                {/* Coupon discount */}
                {couponApplied && (
                  <div className="flex justify-between text-sm bg-green-50 -mx-5 px-5 py-3">
                    <span className="text-green-700 flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {couponCode.toUpperCase()} applied
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-red-500 hover:text-red-600 ml-1"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                    <span className="text-green-700 font-medium">-₹{couponDiscount}</span>
                  </div>
                )}

                {/* Tip */}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      💝 Tip for captain
                    </span>
                    <span className="text-gray-900 font-medium">+₹{tipAmount}</span>
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total</span>
                    <div className="text-right">
                      {couponApplied && (
                        <span className="text-sm text-gray-400 line-through mr-2">
                          ₹{baseFare}
                        </span>
                      )}
                      <span className="text-2xl font-bold text-gray-900">₹{finalFare}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coupon Section */}
            <div className="border-t border-gray-100 p-5">
              {!couponApplied && (
                <>
                  {showCouponInput ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError('');
                          }}
                          placeholder="Enter coupon code"
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                          autoFocus
                        />
                        <Button
                          onClick={handleApplyCoupon}
                          disabled={!couponCode.trim() || isValidatingCoupon}
                          className="px-6"
                        >
                          {isValidatingCoupon ? <Loader size="sm" /> : 'Apply'}
                        </Button>
                      </div>
                      {couponError && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {couponError}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="h-1 w-1 bg-gray-400 rounded-full" />
                        Try: FIRST50, SAVE20, or FLAT30
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCouponInput(true)}
                      className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-blue-700">Apply coupon</p>
                          <p className="text-xs text-blue-600">Save up to 50% on this ride</p>
                        </div>
                      </div>
                      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}

              {/* Tip Section */}
              <div className="mt-4">
                {showTipSection ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">Add a tip for your captain</p>
                      <button
                        onClick={() => {
                          setShowTipSection(false);
                          setTipAmount(0);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {tipOptions.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setTipAmount(amount)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            tipAmount === amount
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {amount === 0 ? 'None' : `₹${amount}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTipSection(true)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💝</span>
                      <span className="text-gray-700">Add a tip</span>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Add Note Section */}
        <section className="bg-white rounded-2xl shadow-lg p-5">
          {showNoteInput ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-medium text-gray-900">Add a note for your captain</label>
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setRideNote('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={rideNote}
                onChange={(e) => setRideNote(e.target.value)}
                placeholder="E.g., I'm at the main entrance, wearing a blue shirt..."
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{rideNote.length}/200 characters</span>
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="text-blue-600 font-medium"
                >
                  Save note
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoteInput(true)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">
                    {rideNote ? 'Edit note' : 'Add a note'}
                  </p>
                  <p className="text-sm text-gray-500 truncate max-w-[200px]">
                    {rideNote || 'Help your captain find you'}
                  </p>
                </div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </section>

        {/* Error Display */}
        {(estimateError || bookingError) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-red-800">Something went wrong</p>
              <p className="text-sm text-red-600 mt-0.5">
                {estimateError?.data?.message || bookingError?.data?.message || 'Please try again'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">
                {selectedVehicle
                  ? vehicleTypes.find((v) => v.id === selectedVehicle)?.name
                  : 'Select a ride'}
              </p>
              {fareEstimate && (
                <p className="text-2xl font-bold text-gray-900">₹{finalFare}</p>
              )}
            </div>
            {scheduledTime && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Scheduled for</p>
                <p className="text-sm font-medium text-blue-600">
                  {scheduledTime.toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            )}
          </div>
          <Button
            fullWidth
            disabled={!canProceed || isEstimating || isBooking}
            onClick={() => setShowPaymentModal(true)}
            className="py-4 text-base rounded-2xl"
            size="lg"
          >
            {isEstimating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Getting fare...
              </span>
            ) : !canProceed ? (
              'Select locations to continue'
            ) : (
              `Book ${
                selectedVehicle
                  ? vehicleTypes.find((v) => v.id === selectedVehicle)?.name
                  : 'Ride'
              } • ₹${finalFare}`
            )}
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Confirm your ride"
        size="md"
      >
        <div className="space-y-6">
          {/* Booking Animation */}
          {bookingStep !== 'idle' && (
            <div className="text-center py-8">
              {bookingStep === 'finding' && (
                <>
                  <div className="relative h-24 w-24 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl">🚗</span>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Finding your captain...</p>
                  <p className="text-sm text-gray-500 mt-1">This usually takes less than 30 seconds</p>
                </>
              )}
              {bookingStep === 'matched' && (
                <>
                  <div className="h-24 w-24 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Ride confirmed! 🎉</p>
                  <p className="text-sm text-gray-500 mt-1">Your captain is on the way</p>
                </>
              )}
            </div>
          )}

          {bookingStep === 'idle' && (
            <>
              {/* Route Summary */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full shadow-sm" />
                    <div className="w-0.5 h-8 bg-gradient-to-b from-green-500 to-red-500" />
                    <div className="h-3 w-3 bg-red-500 rounded-full shadow-sm" />
                  </div>
                  <div className="flex-1 space-y-4 min-w-0">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Pickup</p>
                      <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                        {pickup?.address || 'Current Location'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Drop-off</p>
                      <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                        {destination?.address}
                      </p>
                    </div>
                  </div>
                </div>
                
                {fareEstimate && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {fareEstimate.distance} km
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {fareEstimate.duration} min
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">
                        {vehicleTypes.find((v) => v.id === selectedVehicle)?.icon}
                      </span>
                      <span className="font-medium text-gray-900">
                        {vehicleTypes.find((v) => v.id === selectedVehicle)?.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                  Payment method
                </h3>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => !method.disabled && setPaymentMethod(method.id)}
                      disabled={method.disabled}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === method.id
                          ? 'border-blue-500 bg-blue-50'
                          : method.disabled
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900">{method.name}</p>
                        <p className="text-xs text-gray-500">{method.description}</p>
                      </div>
                      {paymentMethod === method.id && (
                        <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coupon Applied */}
              {couponApplied && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-green-700">
                    <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">{couponCode}</p>
                      <p className="text-xs text-green-600">Coupon applied</p>
                    </div>
                  </div>
                  <span className="font-bold text-green-700 text-lg">-₹{couponDiscount}</span>
                </div>
              )}

              {/* Note */}
              {rideNote && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Note for captain</p>
                  <p className="text-sm text-gray-700">{rideNote}</p>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between py-4 border-t border-gray-200">
                <span className="font-bold text-gray-900 text-lg">Total fare</span>
                <div className="text-right">
                  {couponApplied && (
                    <span className="text-sm text-gray-400 line-through mr-2">₹{baseFare}</span>
                  )}
                  <span className="text-3xl font-bold text-gray-900">₹{finalFare}</span>
                </div>
              </div>

              {/* Booking Error */}
              {bookingError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-red-800">Booking failed</p>
                    <p className="text-sm text-red-600">
                      {bookingError.data?.message || 'Please try again'}
                    </p>
                  </div>
                </div>
              )}

              {/* Confirm Button */}
              <Button
                fullWidth
                onClick={handleBookRide}
                disabled={isBooking}
                size="lg"
                className="py-4 text-base rounded-2xl"
              >
                {isBooking ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size="sm" />
                    Booking...
                  </span>
                ) : scheduledTime ? (
                  `Schedule Ride • ₹${finalFare}`
                ) : (
                  `Confirm Booking • ₹${finalFare}`
                )}
              </Button>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center">
                By confirming, you agree to our{' '}
                <button className="text-blue-600 hover:underline">Terms of Service</button>
                {' '}and{' '}
                <button className="text-blue-600 hover:underline">Privacy Policy</button>
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule your ride"
        size="sm"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select date</label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((dayOffset) => {
                const date = new Date();
                date.setDate(date.getDate() + dayOffset);
                const dateStr = date.toISOString().split('T')[0];
                const displayStr = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
                
                return (
                  <button
                    key={dayOffset}
                    onClick={() => {
                      // Set scheduled date
                    }}
                    className="p-3 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                  >
                    <p className="font-medium text-gray-900">{displayStr}</p>
                    <p className="text-xs text-gray-500">{date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select time</label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {generateScheduleTimes().map((time) => (
                <button
                  key={time.value}
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    handleScheduleRide(today, time.value);
                  }}
                  className="p-2 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700"
                >
                  {time.display}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setScheduledTime(null);
                setShowScheduleModal(false);
              }}
            >
              Ride Now
            </Button>
            <Button
              fullWidth
              onClick={() => setShowScheduleModal(false)}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Spacer for fixed bottom */}
      <div className="h-32" />
    </div>
  );
};

export default BookRide;