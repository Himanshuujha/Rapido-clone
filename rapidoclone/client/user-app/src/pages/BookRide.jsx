import React from 'react';
import RideBooking from '../components/ride/RideBooking';

const BookRide = () => {
  return (
    <div className="page book-ride-page">
      <header className="page-header">
        <h1>Book a Ride</h1>
        <p>Choose pickup and drop locations, select vehicle, and get fare estimate.</p>
      </header>

      <section className="page-content">
        <RideBooking />
      </section>
    </div>
  );
};

export default BookRide;