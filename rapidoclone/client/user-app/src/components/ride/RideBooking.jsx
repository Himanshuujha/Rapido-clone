// components/ride/RideBooking.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from '../../context/SocketContext';
import { setFareEstimate, setActiveRide, updateRideStatus } from '../../redux/slices/rideSlice';
import LocationPicker from '../map/LocationPicker';
import VehicleSelector from './VehicleSelector';
import FareEstimate from './FareEstimate';
import { useGetFareEstimateMutation, useBookRideMutation } from '../../redux/api/rideApi';

const RideBooking = () => {
  const dispatch = useDispatch();
  const { socket } = useSocket();
  const { pickup, destination, selectedVehicle, fareEstimate } = useSelector(state => state.ride);
  
  const [getFareEstimate] = useGetFareEstimateMutation();
  const [bookRide, { isLoading: isBooking }] = useBookRideMutation();

  // Calculate fare when locations are set
  useEffect(() => {
    if (pickup && destination) {
      calculateFare();
    }
  }, [pickup, destination, selectedVehicle]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('ride:accepted', (data) => {
      dispatch(setActiveRide(data.ride));
      dispatch(updateRideStatus('accepted'));
    });

    socket.on('ride:captain-arrived', (data) => {
      dispatch(updateRideStatus('arrived'));
    });

    socket.on('ride:started', (data) => {
      dispatch(updateRideStatus('started'));
    });

    socket.on('ride:completed', (data) => {
      dispatch(updateRideStatus('completed'));
    });

    return () => {
      socket.off('ride:accepted');
      socket.off('ride:captain-arrived');
      socket.off('ride:started');
      socket.off('ride:completed');
    };
  }, [socket, dispatch]);

  const calculateFare = async () => {
    try {
      const result = await getFareEstimate({
        pickup,
        destination,
        vehicleType: selectedVehicle
      }).unwrap();
      dispatch(setFareEstimate(result));
    } catch (error) {
      console.error('Failed to get fare estimate:', error);
    }
  };

  const handleBookRide = async () => {
    try {
      const ride = await bookRide({
        pickup,
        destination,
        vehicleType: selectedVehicle,
        paymentMethod: 'cash'
      }).unwrap();

      dispatch(setActiveRide(ride));
      dispatch(updateRideStatus('searching'));

      // Emit socket event for real-time updates
      socket.emit('ride:request', ride);
    } catch (error) {
      console.error('Failed to book ride:', error);
    }
  };

  return (
    <div className="ride-booking">
      <div className="location-section">
        <LocationPicker type="pickup" />
        <LocationPicker type="destination" />
      </div>

      {pickup && destination && (
        <>
          <VehicleSelector />
          
          {fareEstimate && (
            <FareEstimate fare={fareEstimate} />
          )}

          <button 
            className="book-btn"
            onClick={handleBookRide}
            disabled={isBooking}
          >
            {isBooking ? 'Booking...' : `Book ${selectedVehicle.toUpperCase()}`}
          </button>
        </>
      )}
    </div>
  );
};

export default RideBooking;