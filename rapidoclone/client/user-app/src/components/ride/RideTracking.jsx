// components/ride/RideTracking.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useSocket } from '../../context/SocketContext';

const RideTracking = () => {
  const dispatch = useDispatch();
  const { socket } = useSocket();
  const { activeRide, captain, status } = useSelector(state => state.ride);
  const [captainLocation, setCaptainLocation] = useState(null);
  const [directions, setDirections] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('captain:location', (data) => {
      setCaptainLocation(data.location);
    });

    return () => {
      socket.off('captain:location');
    };
  }, [socket]);

  // Calculate directions
  useEffect(() => {
    if (captainLocation && activeRide) {
      const directionsService = new window.google.maps.DirectionsService();
      
      const origin = status === 'started'
        ? { lat: captainLocation.latitude, lng: captainLocation.longitude }
        : { lat: activeRide.pickup.coordinates.latitude, lng: activeRide.pickup.coordinates.longitude };
      
      const destination = status === 'started'
        ? { lat: activeRide.destination.coordinates.latitude, lng: activeRide.destination.coordinates.longitude }
        : { lat: activeRide.pickup.coordinates.latitude, lng: activeRide.pickup.coordinates.longitude };

      directionsService.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === 'OK') {
            setDirections(result);
          }
        }
      );
    }
  }, [captainLocation, activeRide, status]);

  const getStatusMessage = () => {
    switch (status) {
      case 'accepted':
        return 'Captain is on the way';
      case 'arrived':
        return 'Captain has arrived';
      case 'started':
        return 'Ride in progress';
      default:
        return 'Finding captain...';
    }
  };

  return (
    <div className="ride-tracking">
      <div className="status-bar">
        <h3>{getStatusMessage()}</h3>
        {activeRide?.otp?.code && status === 'arrived' && (
          <div className="otp-display">
            <p>Share OTP with captain:</p>
            <h2>{activeRide.otp.code}</h2>
          </div>
        )}
      </div>

      <GoogleMap
        center={captainLocation || activeRide?.pickup?.coordinates}
        zoom={15}
        mapContainerStyle={{ height: '400px', width: '100%' }}
      >
        {captainLocation && (
          <Marker
            position={{ lat: captainLocation.latitude, lng: captainLocation.longitude }}
            icon={{
              url: '/icons/bike-marker.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
          />
        )}
        
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>

      {captain && (
        <div className="captain-info">
          <img src={captain.avatar} alt={captain.firstName} />
          <div className="captain-details">
            <h4>{captain.firstName} {captain.lastName}</h4>
            <p>{captain.vehicle.registrationNumber}</p>
            <div className="rating">⭐ {captain.ratings.average}</div>
          </div>
          <div className="contact-buttons">
            <button className="call-btn">📞 Call</button>
            <button className="chat-btn">💬 Chat</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideTracking;