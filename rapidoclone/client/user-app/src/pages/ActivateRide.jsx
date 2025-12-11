import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import RideTracking from '../components/ride/RideTracking';
import Button from '../components/common/Button';

const ActiveRide = () => {
  const navigate = useNavigate();
  const { activeRide, status } = useSelector((state) => state.ride);

  if (!activeRide) {
    return (
      <div className="page active-ride-page">
        <header className="page-header">
          <h1>Active Ride</h1>
        </header>
        <section className="page-content text-center">
          <p>You don&apos;t have any active rides right now.</p>
          <Button onClick={() => navigate('/book-ride')} style={{ marginTop: '1rem' }}>
            Book a Ride
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="page active-ride-page">
      <header className="page-header">
        <h1>Active Ride</h1>
        <p>Status: {status}</p>
      </header>

      <section className="page-content">
        <RideTracking />
      </section>
    </div>
  );
};

export default ActiveRide;