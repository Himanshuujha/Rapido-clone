// src/hooks/useRide.js
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import {
  setPickup,
  setDestination,
  setSelectedVehicle,
  setFareEstimate,
  setActiveRide,
  updateRideStatus,
  resetRide,
} from '../redux/slices/rideSlice';
import useSocket from './useSocket';

/**
 * Assumes rideSlice state shape:
 * {
 *   activeRide: null | {...},
 *   pickup: {...} | null,
 *   destination: {...} | null,
 *   selectedVehicle: 'bike' | 'auto' | 'cab',
 *   fareEstimate: {...} | null,
 *   status: 'idle' | 'searching' | 'accepted' | ...
 * }
 */
const useRide = () => {
  const dispatch = useDispatch();
  const { socket } = useSocket();

  const rideState = useSelector((state) => state.ride);
  const {
    pickup,
    destination,
    selectedVehicle,
    fareEstimate,
    activeRide,
    status,
  } = rideState;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setPickupLocation = useCallback(
    (location) => {
      // location: { address, coordinates: { latitude, longitude }, ... }
      dispatch(setPickup(location));
    },
    [dispatch]
  );

  const setDestinationLocation = useCallback(
    (location) => {
      dispatch(setDestination(location));
    },
    [dispatch]
  );

  const changeVehicleType = useCallback(
    (vehicleType) => {
      dispatch(setSelectedVehicle(vehicleType));
    },
    [dispatch]
  );

  const estimateFare = useCallback(
    async ({ pickupOverride, destinationOverride, vehicleTypeOverride } = {}) => {
      try {
        setLoading(true);
        setError(null);

        const payload = {
          pickup: pickupOverride || pickup,
          destination: destinationOverride || destination,
          vehicleType: vehicleTypeOverride || selectedVehicle,
        };

        if (!payload.pickup || !payload.destination) {
          throw new Error('Pickup and destination are required for fare estimate');
        }

        // Backend: POST /api/v1/rides/estimate
        const res = await api.post('/rides/estimate', payload);
        const data = res.data?.data || res.data;

        dispatch(setFareEstimate(data));
        return data;
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err.message ||
          'Failed to get fare estimate';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [pickup, destination, selectedVehicle, dispatch]
  );

  const bookRide = useCallback(
    async ({ paymentMethod = 'cash' } = {}) => {
      try {
        setLoading(true);
        setError(null);

        if (!pickup || !destination) {
          throw new Error('Pickup and destination are required to book a ride');
        }

        const payload = {
          pickup,
          destination,
          vehicleType: selectedVehicle,
          paymentMethod,
        };

        // Backend: POST /api/v1/rides/book
        const res = await api.post('/rides/book', payload);
        const data = res.data?.data || res.data;

        dispatch(setActiveRide(data));
        dispatch(updateRideStatus(data.status || 'searching'));

        // Emit socket event to notify captains (optional)
        if (socket) {
          socket.emit('ride:request', data);
        }

        return data;
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err.message ||
          'Failed to book ride';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [pickup, destination, selectedVehicle, socket, dispatch]
  );

  const fetchActiveRide = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Backend: GET /api/v1/rides/active
      const res = await api.get('/rides/active');
      const data = res.data?.data || res.data;

      if (data) {
        dispatch(setActiveRide(data));
        dispatch(updateRideStatus(data.status));
      } else {
        dispatch(resetRide());
      }

      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err.message ||
        'Failed to fetch active ride';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const cancelRide = useCallback(
    async ({ rideId, reason }) => {
      try {
        setLoading(true);
        setError(null);

        const id = rideId || activeRide?._id || activeRide?.rideId;
        if (!id) throw new Error('Ride ID is required to cancel a ride');

        // Backend: POST /api/v1/rides/:rideId/cancel
        await api.post(`/rides/${id}/cancel`, { reason });

        dispatch(updateRideStatus('cancelled'));
        dispatch(resetRide());

        if (socket) {
          socket.emit('ride:cancel', { rideId: id, reason });
        }
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err.message ||
          'Failed to cancel ride';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeRide, socket, dispatch]
  );

  const clearRide = useCallback(() => {
    dispatch(resetRide());
  }, [dispatch]);

  return {
    // state
    pickup,
    destination,
    selectedVehicle,
    fareEstimate,
    activeRide,
    status,
    loading,
    error,

    // actions
    setPickupLocation,
    setDestinationLocation,
    changeVehicleType,
    estimateFare,
    bookRide,
    fetchActiveRide,
    cancelRide,
    clearRide,
  };
};

export default useRide;