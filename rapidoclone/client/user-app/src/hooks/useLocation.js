// src/hooks/useLocation.js
import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCurrentLocation,
  setPermissionStatus,
  setLocationLoading,
  setLocationError,
} from '../redux/slices/locationSlice';

/**
 * Assumes locationSlice state shape:
 * {
 *   currentLocation: { latitude, longitude } | null,
 *   permissionStatus: 'idle' | 'granted' | 'denied' | 'error',
 *   loading: boolean,
 *   error: string | null
 * }
 */
const useLocation = () => {
  const dispatch = useDispatch();
  const watchIdRef = useRef(null);

  const { currentLocation, permissionStatus, loading, error } = useSelector(
    (state) => state.location
  );

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch(setLocationError('Geolocation is not supported by this browser.'));
      dispatch(setPermissionStatus('error'));
      return;
    }

    dispatch(setLocationLoading(true));
    dispatch(setLocationError(null));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        dispatch(setCurrentLocation(coords));
        dispatch(setPermissionStatus('granted'));
        dispatch(setLocationLoading(false));
      },
      (err) => {
        let status = 'error';
        if (err.code === err.PERMISSION_DENIED) status = 'denied';

        dispatch(
          setLocationError(err.message || 'Failed to get current location.')
        );
        dispatch(setPermissionStatus(status));
        dispatch(setLocationLoading(false));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [dispatch]);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch(setLocationError('Geolocation is not supported by this browser.'));
      dispatch(setPermissionStatus('error'));
      return;
    }

    if (watchIdRef.current != null) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        dispatch(setCurrentLocation(coords));
        dispatch(setPermissionStatus('granted'));
      },
      (err) => {
        let status = 'error';
        if (err.code === err.PERMISSION_DENIED) status = 'denied';
        dispatch(setLocationError(err.message || 'Location watch error.'));
        dispatch(setPermissionStatus(status));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
  }, [dispatch]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const setManualLocation = useCallback(
    (coords) => {
      dispatch(setCurrentLocation(coords));
      dispatch(setPermissionStatus('granted'));
    },
    [dispatch]
  );

  return {
    currentLocation,
    permissionStatus,
    loading,
    error,
    getCurrentLocation,
    startWatching,
    stopWatching,
    setManualLocation,
  };
};

export default useLocation;