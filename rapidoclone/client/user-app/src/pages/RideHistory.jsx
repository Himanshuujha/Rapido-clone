import React, { useEffect, useState } from 'react';
import RideCard from '../components/ride/RideCard';
import Loader from '../components/common/Loader';
import api from '../services/api';

const RideHistory = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');

      // Adjust URL to match your backend route (e.g. /api/v1/rides/history)
      const response = await api.get('/rides/history');
      const data = response.data?.data || response.data;

      setRides(Array.isArray(data) ? data : []);
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

  return (
    <div className="page ride-history-page">
      <header className="page-header">
        <h1>Ride History</h1>
        <p>View all your past rides and details.</p>
      </header>

      <section className="page-content">
        {loading && (
          <div className="centered">
            <Loader />
          </div>
        )}

        {error && !loading && <p className="error-text">{error}</p>}

        {!loading && !error && rides.length === 0 && (
          <p>You haven&apos;t taken any rides yet.</p>
        )}

        <div className="ride-history-list">
          {rides.map((ride) => (
            <RideCard key={ride._id || ride.rideId} ride={ride} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default RideHistory;