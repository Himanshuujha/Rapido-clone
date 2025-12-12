import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useLocation from '../hooks/useLocation';
import useRide from '../hooks/useRide';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentLocation, getCurrentLocation, loading: locationLoading } = useLocation();
  const { activeRide, fetchActiveRide } = useRide();

  const [recentRides, setRecentRides] = useState([]);
  const [loadingRides, setLoadingRides] = useState(true);

  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch recent rides and active ride
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchActiveRide();
        // Simulated recent rides - replace with actual API call
        setRecentRides([
          {
            _id: '1',
            destination: { address: 'Indiranagar, Bangalore' },
            createdAt: new Date().toISOString(),
            fare: { total: 85 },
          },
          {
            _id: '2',
            destination: { address: 'Koramangala, Bangalore' },
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            fare: { total: 120 },
          },
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRides(false);
      }
    };

    fetchData();
    getCurrentLocation();
  }, []);

  const quickDestinations = [
    { id: 1, icon: '🏠', label: 'Home', address: 'Add home address' },
    { id: 2, icon: '💼', label: 'Work', address: 'Add work address' },
    { id: 3, icon: '✈️', label: 'Airport', address: 'Nearest airport' },
    { id: 4, icon: '🚉', label: 'Station', address: 'Railway station' },
  ];

  const vehicleTypes = [
    {
      id: 'bike',
      icon: '🏍️',
      name: 'Bike',
      description: 'Affordable, quick rides',
      eta: '2 min',
    },
    {
      id: 'auto',
      icon: '🛺',
      name: 'Auto',
      description: 'Comfortable for 3',
      eta: '4 min',
    },
    {
      id: 'cab',
      icon: '🚗',
      name: 'Cab',
      description: 'AC, comfortable',
      eta: '5 min',
    },
  ];

  const promotions = [
    {
      id: 1,
      title: '50% OFF',
      subtitle: 'On your first 3 rides',
      code: 'FIRST50',
      bgColor: 'from-purple-500 to-pink-500',
    },
    {
      id: 2,
      title: 'FREE RIDE',
      subtitle: 'Refer a friend',
      code: 'REFER100',
      bgColor: 'from-blue-500 to-cyan-500',
    },
    {
      id: 3,
      title: '₹30 OFF',
      subtitle: 'Weekend special',
      code: 'WEEKEND30',
      bgColor: 'from-orange-500 to-yellow-500',
    },
  ];

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
              <p className="mt-1 text-blue-100 text-sm">
                Where would you like to go today?
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification bell */}
              <button className="relative p-2 rounded-full hover:bg-white/10 transition-colors">
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
              </button>
              {/* Profile avatar */}
              <Link
                to="/profile"
                className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-semibold"
              >
                {user?.firstName?.[0]?.toUpperCase() || 'U'}
              </Link>
            </div>
          </div>

          {/* Active Ride Banner */}
          {activeRide && (
            <div
              className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors"
              onClick={() => navigate('/rides/active')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-white animate-pulse"
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
                    <p className="font-medium">Ride in progress</p>
                    <p className="text-sm text-blue-100">
                      {activeRide.status === 'started'
                        ? 'On the way to destination'
                        : 'Captain is arriving'}
                    </p>
                  </div>
                </div>
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Search/Book Ride Card */}
          <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/book-ride')}
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

            {/* Current location */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {locationLoading ? (
                  <Loader size="sm" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Your location</p>
                  <p className="text-sm text-gray-700">
                    {currentLocation
                      ? 'Current location detected'
                      : 'Enable location for better experience'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Quick Destinations */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick access
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {quickDestinations.map((dest) => (
              <button
                key={dest.id}
                onClick={() => navigate('/book-ride', { state: { destination: dest } })}
                className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-2xl mb-2">{dest.icon}</span>
                <span className="text-sm font-medium text-gray-900">
                  {dest.label}
                </span>
              </button>
            ))}
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
                onClick={() =>
                  navigate('/book-ride', { state: { vehicleType: vehicle.id } })
                }
                className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-500 border-2 border-transparent transition-all"
              >
                <span className="text-4xl">{vehicle.icon}</span>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">{vehicle.name}</p>
                  <p className="text-sm text-gray-500">{vehicle.description}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {vehicle.eta}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Promotions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Offers for you
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className={`flex-shrink-0 w-64 p-4 rounded-xl bg-gradient-to-r ${promo.bgColor} text-white`}
              >
                <p className="text-2xl font-bold">{promo.title}</p>
                <p className="text-sm opacity-90 mt-1">{promo.subtitle}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">
                    {promo.code}
                  </span>
                  <button className="text-xs font-medium underline">
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Rides */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent rides
            </h2>
            <Link
              to="/rides/history"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>

          {loadingRides ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : recentRides.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="h-16 w-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600">No recent rides</p>
              <p className="text-sm text-gray-400 mt-1">
                Book your first ride to get started
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate('/book-ride')}
              >
                Book a Ride
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRides.map((ride) => (
                <div
                  key={ride._id}
                  className="bg-white rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/rides/${ride._id}`)}
                >
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-gray-600"
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
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {ride.destination?.address || 'Unknown destination'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(ride.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ₹{ride.fare?.total || 0}
                    </p>
                    <button className="text-xs text-blue-600 font-medium">
                      Rebook
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Safety Features */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Safety first
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="h-6 w-6 text-red-600"
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
              <p className="text-xs text-gray-500">Emergency help</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="h-6 w-6 text-blue-600"
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
              <p className="text-xs text-gray-500">With contacts</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="h-6 w-6 text-green-600"
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
              <p className="text-xs text-gray-500">All captains</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <svg
                  className="h-6 w-6 text-purple-600"
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
              <p className="text-xs text-gray-500">GPS enabled</p>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden">
        <div className="flex items-center justify-around py-2">
          <Link
            to="/"
            className="flex flex-col items-center py-2 px-3 text-blue-600"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            to="/rides/history"
            className="flex flex-col items-center py-2 px-3 text-gray-500"
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
          <Link
            to="/book-ride"
            className="flex flex-col items-center py-2 px-3"
          >
            <div className="h-12 w-12 -mt-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <span className="text-xs mt-1 text-gray-500">Book</span>
          </Link>
          <Link
            to="/wallet"
            className="flex flex-col items-center py-2 px-3 text-gray-500"
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
          </Link>
          <Link
            to="/profile"
            className="flex flex-col items-center py-2 px-3 text-gray-500"
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