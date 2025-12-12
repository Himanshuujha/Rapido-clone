// src/pages/BookRide.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetFareEstimateMutation,
  useBookRideMutation,
} from '../redux/api/rideApi';
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

  // Redux state
  const { pickup, destination, selectedVehicle, fareEstimate } = useSelector(
    (state) => state.ride
  );

  // RTK Query mutations
  const [getFareEstimate, { isLoading: isEstimating, error: estimateError }] =
    useGetFareEstimateMutation();
  const [bookRide, { isLoading: isBooking, error: bookingError }] =
    useBookRideMutation();

  // Custom hook for user location
  const { currentLocation, getCurrentLocation, isLoading: isLocationLoading } =
    useUserLocation();

  // Local state
  const [pickupInput, setPickupInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const vehicleTypes = [
    {
      id: 'bike',
      icon: '🏍️',
      name: 'Bike',
      description: 'Quick & affordable',
      capacity: '1 person',
      eta: '2 min',
      priceMultiplier: 1,
    },
    {
      id: 'auto',
      icon: '🛺',
      name: 'Auto',
      description: 'Comfortable ride',
      capacity: '3 people',
      eta: '4 min',
      priceMultiplier: 1.5,
    },
    {
      id: 'cab',
      icon: '🚗',
      name: 'Cab',
      description: 'AC, spacious',
      capacity: '4 people',
      eta: '5 min',
      priceMultiplier: 2,
    },
  ];

  const paymentMethods = [
    { id: 'cash', icon: '💵', name: 'Cash' },
    { id: 'wallet', icon: '👛', name: 'Wallet', balance: 250 },
    { id: 'upi', icon: '📱', name: 'UPI' },
    { id: 'card', icon: '💳', name: 'Card', last4: '4242' },
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
  }, [location.state, dispatch]);

  // Use current location as pickup
  useEffect(() => {
    if (currentLocation && !pickup) {
      const pickupData = {
        address: 'Current Location',
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      };
      dispatch(setPickup(pickupData));
      setPickupInput('Current Location');
    }
  }, [currentLocation, pickup, dispatch]);

  // Fetch fare estimate when locations and vehicle change
  const fetchFareEstimate = useCallback(async () => {
    if (!pickup?.coordinates || !destination?.coordinates) return;

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
    fetchFareEstimate();
  }, [fetchFareEstimate]);

  // Debounced search function
  const handleSearch = useCallback(
    async (query, type) => {
      if (query.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setActiveInput(type);

      // TODO: Replace with actual Google Places API or your backend search
      // For now, using mock data
      try {
        // Simulated API delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Mock search results - replace with actual API call
        const mockResults = [
          {
            id: '1',
            name: 'Indiranagar Metro Station',
            address: 'Indiranagar, Bangalore',
            coordinates: { latitude: 12.9784, longitude: 77.6408 },
          },
          {
            id: '2',
            name: 'Koramangala 4th Block',
            address: 'Koramangala, Bangalore',
            coordinates: { latitude: 12.9352, longitude: 77.6245 },
          },
          {
            id: '3',
            name: 'MG Road',
            address: 'MG Road, Bangalore',
            coordinates: { latitude: 12.9757, longitude: 77.6073 },
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
    },
    []
  );

  const handleSelectLocation = (loc, type) => {
    const locationData = {
      address: `${loc.name}, ${loc.address}`,
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

  const handleVehicleChange = (vehicleId) => {
    dispatch(setSelectedVehicle(vehicleId));
  };

  const handleUseCurrentLocation = async () => {
    try {
      await getCurrentLocation();
      setPickupInput('Current Location');
    } catch (err) {
      console.error('Failed to get current location:', err);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      alert('Please enter a coupon code');
      return;
    }

    // TODO: Replace with actual coupon validation API
    // POST /api/v1/rides/coupons/validate
    try {
      // Mock coupon validation
      if (couponCode.toUpperCase() === 'FIRST50') {
        const discount = Math.round((fareEstimate?.total || 0) * 0.5);
        setCouponDiscount(discount);
        setCouponApplied(true);
      } else if (couponCode.toUpperCase() === 'SAVE20') {
        const discount = Math.round((fareEstimate?.total || 0) * 0.2);
        setCouponDiscount(discount);
        setCouponApplied(true);
      } else {
        alert('Invalid coupon code');
      }
    } catch (err) {
      console.error('Coupon validation error:', err);
      alert('Failed to validate coupon');
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponDiscount(0);
  };

  const handleBookRide = async () => {
    if (!pickup || !destination) {
      alert('Please select pickup and destination');
      return;
    }

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
      };

      const result = await bookRide(bookingData).unwrap();

      // Update redux state with the booked ride
      dispatch(setActiveRide(result.data?.ride || result.ride));

      // Store OTP if provided
      if (result.data?.otp || result.otp) {
        dispatch(setOTP(result.data?.otp || result.otp));
      }

      setShowPaymentModal(false);

      // Navigate to active ride page
      navigate('/rides/active', {
        state: {
          rideId: result.data?.ride?._id || result.ride?._id,
          otp: result.data?.otp || result.otp,
        },
      });
    } catch (err) {
      console.error('Booking failed:', err);
      alert(err?.data?.message || 'Failed to book ride. Please try again.');
    }
  };

  // Calculate final fare
  const baseFare = fareEstimate?.total || fareEstimate?.fare || 0;
  const finalFare = Math.max(0, baseFare - couponDiscount);

  // Combined loading state
  const isLoading = isEstimating || isBooking;

  // Combined error
  const error = estimateError?.data?.message || bookingError?.data?.message;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
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
            <h1 className="text-xl font-semibold text-gray-900">Book a Ride</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Location Inputs */}
        <section className="bg-white rounded-xl shadow-sm p-4 relative">
          <div className="space-y-3">
            {/* Pickup */}
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <div className="w-0.5 h-8 bg-gray-300"></div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Pickup</label>
                  <input
                    type="text"
                    value={pickupInput}
                    onChange={(e) => {
                      setPickupInput(e.target.value);
                      handleSearch(e.target.value, 'pickup');
                    }}
                    onFocus={() => setActiveInput('pickup')}
                    onBlur={() => {
                      // Delay to allow click on search results
                      setTimeout(() => {
                        if (activeInput === 'pickup') {
                          setActiveInput(null);
                          setSearchResults([]);
                        }
                      }, 200);
                    }}
                    placeholder="Enter pickup location"
                    className="w-full py-2 text-gray-900 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleUseCurrentLocation}
                  disabled={isLocationLoading}
                  className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
                >
                  {isLocationLoading ? (
                    <Loader size="sm" />
                  ) : (
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
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Destination */}
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Destination</label>
                  <input
                    type="text"
                    value={destinationInput}
                    onChange={(e) => {
                      setDestinationInput(e.target.value);
                      handleSearch(e.target.value, 'destination');
                    }}
                    onFocus={() => setActiveInput('destination')}
                    onBlur={() => {
                      setTimeout(() => {
                        if (activeInput === 'destination') {
                          setActiveInput(null);
                          setSearchResults([]);
                        }
                      }, 200);
                    }}
                    placeholder="Where to?"
                    className="w-full py-2 text-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && activeInput && (
            <div className="absolute left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-20 max-h-60 overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader size="sm" />
                </div>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectLocation(result, activeInput)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                >
                  <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-gray-500"
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
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {result.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {result.address}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Map placeholder */}
        <section className="bg-gray-200 rounded-xl h-48 flex items-center justify-center overflow-hidden">
          {pickup && destination ? (
            <div className="text-center text-gray-600">
              <svg
                className="h-12 w-12 mx-auto mb-2 text-blue-500"
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
              <p className="text-sm">Route: {fareEstimate?.distance || '--'} km</p>
              <p className="text-xs text-gray-500">
                ETA: {fareEstimate?.duration || '--'} min
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <svg
                className="h-12 w-12 mx-auto mb-2"
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
              <p>Select locations to see route</p>
            </div>
          )}
        </section>

        {/* Vehicle Selection */}
        <section className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Choose your ride
          </h2>
          <div className="space-y-3">
            {vehicleTypes.map((vehicle) => {
              const vehicleFare = fareEstimate
                ? Math.round(
                    (fareEstimate.total || fareEstimate.fare || 0) *
                      vehicle.priceMultiplier
                  )
                : null;

              return (
                <button
                  key={vehicle.id}
                  onClick={() => handleVehicleChange(vehicle.id)}
                  disabled={isEstimating}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isEstimating ? 'opacity-50' : ''}`}
                >
                  <span className="text-4xl">{vehicle.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{vehicle.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {vehicle.capacity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{vehicle.description}</p>
                  </div>
                  <div className="text-right">
                    {isEstimating ? (
                      <Loader size="sm" />
                    ) : vehicleFare ? (
                      <p className="font-semibold text-gray-900">₹{vehicleFare}</p>
                    ) : (
                      <p className="text-gray-400">--</p>
                    )}
                    <p className="text-xs text-green-600">{vehicle.eta} away</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Fare Breakdown */}
        {fareEstimate && (
          <section className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Fare details
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base fare</span>
                <span className="text-gray-900">
                  ₹{fareEstimate.baseFare || fareEstimate.breakdown?.baseFare || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Distance ({fareEstimate.distance || 0} km)
                </span>
                <span className="text-gray-900">
                  ₹{fareEstimate.distanceFare || fareEstimate.breakdown?.distanceFare || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Time ({fareEstimate.duration || 0} min)
                </span>
                <span className="text-gray-900">
                  ₹{fareEstimate.timeFare || fareEstimate.breakdown?.timeFare || 0}
                </span>
              </div>
              {fareEstimate.surgeMultiplier > 1 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Surge ({fareEstimate.surgeMultiplier}x)</span>
                  <span>+₹{fareEstimate.surgeFare || 0}</span>
                </div>
              )}
              {couponApplied && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    Discount ({couponCode.toUpperCase()})
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-red-500 hover:text-red-600"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                  <span>-₹{couponDiscount}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">₹{finalFare}</span>
                </div>
              </div>
            </div>

            {/* Coupon Input */}
            {!couponApplied && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim()}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Try: FIRST50 for 50% off or SAVE20 for 20% off
                </p>
              </div>
            )}
          </section>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto">
          <Button
            fullWidth
            disabled={!pickup || !destination || isLoading}
            onClick={() => setShowPaymentModal(true)}
            className="py-4 text-base"
          >
            {isEstimating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Getting fare...
              </span>
            ) : fareEstimate ? (
              `Book ${
                selectedVehicle
                  ? selectedVehicle.charAt(0).toUpperCase() +
                    selectedVehicle.slice(1)
                  : 'Ride'
              } • ₹${finalFare}`
            ) : (
              'Select locations to continue'
            )}
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Confirm booking"
        maxWidth="max-w-md"
      >
        <div className="space-y-6">
          {/* Route summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <div className="w-0.5 h-6 bg-gray-300"></div>
                <div className="h-3 w-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {pickup?.address || 'Current Location'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Destination</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {destination?.address}
                  </p>
                </div>
              </div>
            </div>
            {fareEstimate && (
              <div className="flex justify-between mt-4 pt-3 border-t border-gray-200 text-sm">
                <span className="text-gray-500">
                  {fareEstimate.distance} km • {fareEstimate.duration} min
                </span>
                <span className="font-medium">
                  {vehicleTypes.find((v) => v.id === selectedVehicle)?.name}
                </span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Payment method
            </h3>
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{method.name}</p>
                    {method.balance !== undefined && (
                      <p className="text-xs text-gray-500">
                        Balance: ₹{method.balance}
                      </p>
                    )}
                    {method.last4 && (
                      <p className="text-xs text-gray-500">
                        •••• {method.last4}
                      </p>
                    )}
                  </div>
                  {paymentMethod === method.id && (
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Applied coupon display */}
          {couponApplied && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700">
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
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <span className="font-medium">{couponCode}</span>
                </div>
                <span className="text-green-700 font-medium">
                  -₹{couponDiscount}
                </span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center py-3 border-t border-gray-200">
            <span className="font-medium text-gray-900">Total fare</span>
            <div className="text-right">
              {couponApplied && (
                <span className="text-sm text-gray-500 line-through mr-2">
                  ₹{baseFare}
                </span>
              )}
              <span className="text-2xl font-bold text-gray-900">
                ₹{finalFare}
              </span>
            </div>
          </div>

          {/* Booking error */}
          {bookingError && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">
              {bookingError.data?.message || 'Booking failed. Please try again.'}
            </div>
          )}

          {/* Confirm button */}
          <Button
            fullWidth
            onClick={handleBookRide}
            disabled={isBooking}
            className="py-4 text-base"
          >
            {isBooking ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Booking your ride...
              </span>
            ) : (
              `Confirm Booking • ₹${finalFare}`
            )}
          </Button>

          {/* Terms note */}
          <p className="text-xs text-gray-500 text-center">
            By confirming, you agree to our{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </Modal>

      {/* Spacer for fixed bottom */}
      <div className="h-24"></div>
    </div>
  );
};

export default BookRide;