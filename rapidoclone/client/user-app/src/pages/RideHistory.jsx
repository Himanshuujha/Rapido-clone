import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RideCard from '../components/ride/RideCard';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import api from '../services/api';

const RideHistory = () => {
  const navigate = useNavigate();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Fetching ride history...');
      const response = await api.get('/rides/history');
      console.log('Ride history response:', response);
      const rides = response.data?.data?.rides || [];
      setRides(Array.isArray(rides) ? rides : []);

    } catch (err) {
      console.error(err);
      setError('Failed to load ride history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredRides = rides.filter((ride) => {
    if (activeFilter === 'all') return true;
    return ride.status === activeFilter;
  });

  const getStats = () => {
    const completed = rides.filter((r) => r.status === 'completed');
    const totalSpent = completed.reduce((acc, r) => acc + (r.fare?.total || 0), 0);
    const totalDistance = completed.reduce(
      (acc, r) => acc + (r.route?.distance || 0),
      0
    );

    return {
      totalRides: completed.length,
      totalSpent,
      totalDistance: totalDistance.toFixed(1),
    };
  };

  const stats = getStats();

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
            <h1 className="text-xl font-semibold text-gray-900">Ride History</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalRides}
            </p>
            <p className="text-xs text-gray-500">Total Rides</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              ₹{stats.totalSpent}
            </p>
            <p className="text-xs text-gray-500">Total Spent</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalDistance}
            </p>
            <p className="text-xs text-gray-500">KM Travelled</p>
          </div>
        </section>

        {/* Filters */}
        <section className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {/* Rides List */}
        <section>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="h-16 w-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600">{error}</p>
              <Button onClick={fetchHistory} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          ) : filteredRides.length === 0 ? (
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
              <p className="text-gray-600">
                {activeFilter === 'all'
                  ? "You haven't taken any rides yet"
                  : `No ${activeFilter} rides found`}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Book your first ride to get started
              </p>
              <Button onClick={() => navigate('/book-ride')} className="mt-4">
                Book a Ride
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => (
                <RideCard key={ride._id || ride.rideId} ride={ride} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default RideHistory;