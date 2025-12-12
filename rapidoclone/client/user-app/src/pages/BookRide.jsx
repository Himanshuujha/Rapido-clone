import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useRide from '../hooks/useRide';
import useUserLocation from '../hooks/useLocation';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';

const BookRide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    pickup,
    destination,
    selectedVehicle,
    fareEstimate,
    status,
    loading,
    error,
    setPickupLocation,
    setDestinationLocation,
    changeVehicleType,
    estimateFare,
    bookRide,
  } = useRide();

  const { currentLocation, getCurrentLocation } = useUserLocation();

  const [pickupInput, setPickupInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeInput, setActiveInput] = useState(null); // 'pickup' | 'destination'

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
      changeVehicleType(location.state.vehicleType);
    }
    if (location.state?.destination) {
      setDestinationInput(location.state.destination.address || '');
    }
  }, [location.state]);

  // Use current location as pickup
  useEffect(() => {
    if (currentLocation && !pickup) {
      setPickupLocation({
        address: 'Current Location',
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      });
      setPickupInput('Current Location');
    }
  }, [currentLocation]);

  // Estimate fare when locations change
  useEffect(() => {
    if (pickup && destination) {
      estimateFare();
    }
  }, [pickup, destination, selectedVehicle]);

  // Mock search function - replace with actual API
  const handleSearch = async (query, type) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    // Simulated search results
    setSearchResults([
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
    ]);
  };

  const handleSelectLocation = (loc, type) => {
    if (type === 'pickup') {
      setPickupLocation(loc);
      setPickupInput(loc.address);
    } else {
      setDestinationLocation(loc);
      setDestinationInput(loc.address);
    }
    setSearchResults([]);
    setActiveInput(null);
  };

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'FIRST50') {
      setCouponApplied(true);
    } else {
      alert('Invalid coupon code');
    }
  };

  const handleBookRide = async () => {
    try {
      await bookRide({ paymentMethod });
      setShowPaymentModal(false);
      navigate('/rides/active');
    } catch (err) {
      console.error(err);
    }
  };

  const discount = couponApplied ? Math.round((fareEstimate?.total || 0) * 0.5) : 0;
  const finalFare = (fareEstimate?.total || 0) - discount;

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
        <section className="bg-white rounded-xl shadow-sm p-4">
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
                    placeholder="Enter pickup location"
                    className="w-full py-2 text-gray-900 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    getCurrentLocation();
                    setPickupInput('Current Location');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
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
                    placeholder="Where to?"
                    className="w-full py-2 text-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && activeInput && (
              <div className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-20 max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectLocation(result, activeInput)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
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
                    <div>
                      <p className="font-medium text-gray-900">{result.name}</p>
                      <p className="text-sm text-gray-500">{result.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Map placeholder */}
        <section className="bg-gray-200 rounded-xl h-48 flex items-center justify-center">
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
            <p>Map will appear here</p>
          </div>
        </section>

        {/* Vehicle Selection */}
        <section className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Choose your ride
          </h2>
          <div className="space-y-3">
            {vehicleTypes.map((vehicle) => (
              <button
                key={vehicle.id}
                onClick={() => changeVehicleType(vehicle.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  selectedVehicle === vehicle.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
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
                  {fareEstimate ? (
                    <p className="font-semibold text-gray-900">
                      ₹{Math.round(fareEstimate.total * vehicle.priceMultiplier)}
                    </p>
                  ) : (
                    <p className="text-gray-400">--</p>
                  )}
                  <p className="text-xs text-green-600">{vehicle.eta} away</p>
                </div>
              </button>
            ))}
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
                <span className="text-gray-900">₹{fareEstimate.baseFare}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Distance ({fareEstimate.distance || 5} km)
                </span>
                <span className="text-gray-900">
                  ₹{fareEstimate.distanceFare}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Time ({fareEstimate.duration || 15} min)
                </span>
                <span className="text-gray-900">₹{fareEstimate.timeFare}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount (FIRST50)</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">₹{finalFare}</span>
                </div>
              </div>
            </div>

            {/* Coupon */}
            {!couponApplied && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCoupon}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Error */}
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
            disabled={!pickup || !destination || loading}
            onClick={() => setShowPaymentModal(true)}
            className="py-4 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Getting fare...
              </span>
            ) : fareEstimate ? (
              `Book ${selectedVehicle ? (selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1)) : 'Ride'} • ₹${finalFare}`
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
              <div className="flex-1 space-y-3">
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

          {/* Total */}
          <div className="flex justify-between items-center py-3 border-t border-gray-200">
            <span className="font-medium text-gray-900">Total fare</span>
            <span className="text-2xl font-bold text-gray-900">₹{finalFare}</span>
          </div>

          {/* Confirm button */}
          <Button
            fullWidth
            onClick={handleBookRide}
            disabled={loading}
            className="py-4 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Booking...
              </span>
            ) : (
              'Confirm Booking'
            )}
          </Button>
        </div>
      </Modal>

      {/* Spacer for fixed bottom */}
      <div className="h-24"></div>
    </div>
  );
};

export default BookRide;