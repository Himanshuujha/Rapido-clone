import React from 'react';
import RideBooking from '../components/ride/RideBooking';
import useAuth from '../hooks/useAuth';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="page home-page">
      <header className="page-header">
        <h1>Welcome{user ? `, ${user.firstName}` : ''}</h1>
        <p>Book a quick and affordable ride from anywhere.</p>
      </header>

      <section className="page-content">
        <RideBooking />
      </section>
    </div>
  );
};

export default Home;