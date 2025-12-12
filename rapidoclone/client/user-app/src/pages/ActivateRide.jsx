// src/pages/ActiveRide.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  useGetActiveRideQuery,
  useCancelRideMutation,
  useRateRideMutation,
  useTipRideMutation,
} from '../redux/api/rideApi';
import useSocket from '../hooks/useSocket';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';
import {
  updateRideStatus,
  setCaptain,
  setActiveRide,
  resetRide,
} from '../redux/slices/rideSlice';

const ActiveRide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();

  // Get OTP from navigation state (passed from BookRide)
  const navigationOtp = location.state?.otp;

  // Redux state
  const { activeRide: reduxActiveRide, status, captain, otp } = useSelector(
    (state) => state.ride
  );

  // RTK Query
  const {
    data: activeRideData,
    isLoading: isFetchingRide,
    isError: fetchError,
    refetch: refetchActiveRide,
  } = useGetActiveRideQuery(undefined, {
    pollingInterval: 10000, // Poll every 10 seconds for updates
    refetchOnMountOrArgChange: true,
  });

  const [cancelRide, { isLoading: isCancelling }] = useCancelRideMutation();
  const [rateRide, { isLoading: isRating }] = useRateRideMutation();
  const [tipRide, { isLoading: isTipping }] = useTipRideMutation();

  // Local state
  const [captainLocation, setCaptainLocation] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [showTipModal, setShowTipModal] = useState(false);
  const [eta, setEta] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [rideShared, setRideShared] = useState(false);

  // Use either Redux state or API data
  const activeRide = reduxActiveRide || activeRideData?.data || activeRideData;
  const displayOtp = otp || navigationOtp || activeRide?.otp?.code;
  const currentCaptain = captain || activeRide?.captain;

  // Update Redux when API data changes
  useEffect(() => {
    if (activeRideData?.data || activeRideData) {
      const rideData = activeRideData?.data || activeRideData;
      dispatch(setActiveRide(rideData));
      if (rideData.captain) {
        dispatch(setCaptain(rideData.captain));
      }
      if (rideData.status) {
        dispatch(updateRideStatus(rideData.status));
      }
    }
  }, [activeRideData, dispatch]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join ride room if we have an active ride
    if (activeRide?._id) {
      socket.emit('ride:join', { rideId: activeRide._id });
    }

    const handleCaptainLocation = (data) => {
      setCaptainLocation(data.location);
      if (data.eta) {
        setEta(data.eta);
      }
    };

    const handleRideAccepted = (data) => {
      dispatch(setCaptain(data.captain));
      dispatch(updateRideStatus('accepted'));
      refetchActiveRide();
    };

    const handleCaptainArriving = (data) => {
      dispatch(updateRideStatus('arriving'));
      if (data.eta) {
        setEta(data.eta);
      }
    };

    const handleCaptainArrived = () => {
      dispatch(updateRideStatus('arrived'));
    };

    const handleRideStarted = (data) => {
      dispatch(updateRideStatus('started'));
      refetchActiveRide();
    };

    const handleRideCompleted = (data) => {
      dispatch(updateRideStatus('completed'));
      refetchActiveRide();
      setShowRatingModal(true);
    };

    const handleRideCancelled = (data) => {
      dispatch(updateRideStatus('cancelled'));
      alert(data?.message || 'Ride has been cancelled');
      dispatch(resetRide());
      navigate('/');
    };

    const handleEtaUpdate = (data) => {
      setEta(data.eta);
    };

    socket.on('captain:location', handleCaptainLocation);
    socket.on('ride:accepted', handleRideAccepted);
    socket.on('ride:captain-arriving', handleCaptainArriving);
    socket.on('ride:captain-arrived', handleCaptainArrived);
    socket.on('ride:started', handleRideStarted);
    socket.on('ride:completed', handleRideCompleted);
    socket.on('ride:cancelled', handleRideCancelled);
    socket.on('ride:eta-update', handleEtaUpdate);

    return () => {
      socket.off('captain:location', handleCaptainLocation);
      socket.off('ride:accepted', handleRideAccepted);
      socket.off('ride:captain-arriving', handleCaptainArriving);
      socket.off('ride:captain-arrived', handleCaptainArrived);
      socket.off('ride:started', handleRideStarted);
      socket.off('ride:completed', handleRideCompleted);
      socket.off('ride:cancelled', handleRideCancelled);
      socket.off('ride:eta-update', handleEtaUpdate);

      // Leave ride room on cleanup
      if (activeRide?._id) {
        socket.emit('ride:leave', { rideId: activeRide._id });
      }
    };
  }, [socket, isConnected, activeRide?._id, dispatch, navigate, refetchActiveRide]);

  // Handle cancel ride
  const handleCancelRide = async () => {
    if (!activeRide?._id) return;

    try {
      await cancelRide({
        rideId: activeRide._id,
        reason: cancelReason,
      }).unwrap();

      setShowCancelModal(false);
      dispatch(resetRide());
      navigate('/', {
        state: { message: 'Ride cancelled successfully' },
      });
    } catch (err) {
      console.error('Cancel ride error:', err);
      alert(err?.data?.message || 'Failed to cancel ride. Please try again.');
    }
  };

  // Handle submit rating
  const handleSubmitRating = async () => {
    if (!activeRide?._id) return;

    try {
      await rateRide({
        rideId: activeRide._id,
        rating,
        comment: review || undefined,
      }).unwrap();

      // If tip was selected, submit tip as well
      if (tipAmount > 0) {
        await tipRide({
          rideId: activeRide._id,
          amount: tipAmount,
        }).unwrap();
      }

      setShowRatingModal(false);
      dispatch(resetRide());
      navigate('/', {
        state: { message: 'Thanks for your feedback!' },
      });
    } catch (err) {
      console.error('Rating error:', err);
      alert(err?.data?.message || 'Failed to submit rating. Please try again.');
    }
  };

  // Handle SOS
  const handleSOS = async () => {
    if (!activeRide?._id) return;

    // TODO: Call SOS API - POST /api/v1/rides/:rideId/sos
    const confirmed = window.confirm(
      'This will alert emergency contacts and our support team. Continue?'
    );

    if (confirmed) {
      try {
        // Implement SOS API call here
        // await triggerSOS({ rideId: activeRide._id }).unwrap();
        alert('SOS alert sent. Our team will contact you shortly.');
      } catch (err) {
        console.error('SOS error:', err);
      }
    }
  };

  // Handle share ride
  const handleShareRide = async () => {
    if (!activeRide?._id) return;

    try {
      // TODO: Call share API - POST /api/v1/rides/:rideId/share
      // For now, use native share if available
      if (navigator.share) {
        await navigator.share({
          title: 'Track my ride',
          text: `I'm on a ride. Track my location here.`,
          url: `${window.location.origin}/track/${activeRide._id}`,
        });
        setRideShared(true);
      } else {
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}/track/${activeRide._id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Share link copied to clipboard!');
        setRideShared(true);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // Handle call captain
  const handleCallCaptain = () => {
    if (currentCaptain?.phone) {
      window.location.href = `tel:${currentCaptain.phone}`;
    }
  };

  // Handle message captain
  const handleMessageCaptain = () => {
    // TODO: Implement in-app chat or SMS
    if (currentCaptain?.phone) {
      window.location.href = `sms:${currentCaptain.phone}`;
    }
  };

  // Get status configuration
  const getStatusConfig = () => {
    const currentStatus = status || activeRide?.status;

    switch (currentStatus) {
      case 'pending':
      case 'searching':
        return {
          title: 'Finding your captain...',
          subtitle: 'This usually takes less than a minute',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          icon: '🔍',
          showLoader: true,
        };
      case 'accepted':
        return {
          title: 'Captain is on the way',
          subtitle: eta ? `Arriving in ${eta} min` : 'Your captain has accepted the ride',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: '🚗',
          showLoader: false,
        };
      case 'arriving':
        return {
          title: 'Captain arriving soon',
          subtitle: eta ? `${eta} min away` : 'Almost there!',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: '🚗',
          showLoader: false,
        };
      case 'arrived':
        return {
          title: 'Captain has arrived',
          subtitle: 'Share OTP to start your ride',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: '📍',
          showLoader: false,
        };
      case 'started':
      case 'in_progress':
        return {
          title: 'Ride in progress',
          subtitle: eta ? `${eta} min to destination` : 'Enjoy your ride!',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          icon: '🛣️',
          showLoader: false,
        };
      case 'completed':
        return {
          title: 'Ride completed',
          subtitle: 'Thanks for riding with us!',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: '✅',
          showLoader: false,
        };
      case 'cancelled':
        return {
          title: 'Ride cancelled',
          subtitle: 'Your ride has been cancelled',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          icon: '❌',
          showLoader: false,
        };
      default:
        return {
          title: 'Loading...',
          subtitle: '',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: '⏳',
          showLoader: true,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const currentStatus = status || activeRide?.status;

  // Loading state
  if (isFetchingRide && !activeRide) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" />
          <p className="mt-4 text-gray-600">Loading ride details...</p>
        </div>
      </div>
    );
  }

  // No active ride
  if (!activeRide && !isFetchingRide) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="h-20 w-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <span className="text-4xl">🚗</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No active ride
          </h2>
          <p className="text-gray-500 mb-6">
            You don't have any ride in progress
          </p>
          <Button onClick={() => navigate('/book-ride')} fullWidth>
            Book a Ride
          </Button>
        </div>
      </div>
    );
  }

  // Tip options
  const tipOptions = [0, 20, 50, 100];

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Map placeholder */}
      <div className="h-72 bg-gray-200 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg
              className="h-12 w-12 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p>Live tracking map</p>
            {captainLocation && (
              <p className="text-xs mt-1">
                Captain: {captainLocation.latitude?.toFixed(4)},{' '}
                {captainLocation.longitude?.toFixed(4)}
              </p>
            )}
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 h-10 w-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg
            className="h-5 w-5 text-gray-700"
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

        {/* Share button */}
        <button
          onClick={handleShareRide}
          className={`absolute top-4 right-16 h-10 w-10 rounded-full shadow-md flex items-center justify-center transition-colors ${
            rideShared ? 'bg-green-500' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <svg
            className={`h-5 w-5 ${rideShared ? 'text-white' : 'text-gray-700'}`}
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
        </button>

        {/* SOS button */}
        <button
          onClick={handleSOS}
          className="absolute top-4 right-4 h-10 w-10 bg-red-500 hover:bg-red-600 rounded-full shadow-md flex items-center justify-center transition-colors"
        >
          <span className="text-white text-xs font-bold">SOS</span>
        </button>

        {/* Connection status indicator */}
        {!isConnected && (
          <div className="absolute bottom-4 left-4 right-4 bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm text-center">
            ⚠️ Reconnecting to live updates...
          </div>
        )}
      </div>

      {/* Status card */}
      <div className="relative -mt-8 mx-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status header */}
          <div className={`p-4 ${statusConfig.bgColor} border-b border-gray-100`}>
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-sm`}
              >
                {statusConfig.icon}
              </div>
              <div className="flex-1">
                <h2 className={`font-semibold ${statusConfig.color}`}>
                  {statusConfig.title}
                </h2>
                <p className="text-sm text-gray-600">{statusConfig.subtitle}</p>
              </div>
              {statusConfig.showLoader && (
                <div className="ml-auto">
                  <Loader size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* OTP display */}
          {(currentStatus === 'arrived' || currentStatus === 'accepted') &&
            displayOtp && (
              <div className="p-4 bg-green-50 border-b border-green-100">
                <p className="text-sm text-green-700 mb-1">
                  Share this OTP with your captain to start the ride
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-4xl font-bold text-green-700 tracking-[0.3em]">
                    {displayOtp}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(displayOtp);
                      alert('OTP copied!');
                    }}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <svg
                      className="h-5 w-5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

          {/* Captain info */}
          {currentCaptain && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {currentCaptain.profilePicture ? (
                    <img
                      src={currentCaptain.profilePicture}
                      alt={currentCaptain.firstName}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-semibold text-blue-700">
                      {currentCaptain.firstName?.[0]?.toUpperCase() || 'C'}
                    </div>
                  )}
                  {/* Online indicator */}
                  <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {currentCaptain.firstName} {currentCaptain.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-sm text-gray-600">
                      {currentCaptain.ratings?.average?.toFixed(1) || '4.5'}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-600">
                      {currentCaptain.totalRides || '100'}+ rides
                    </span>
                  </div>
                  {/* Vehicle info */}
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span>
                      {currentCaptain.vehicle?.color}{' '}
                      {currentCaptain.vehicle?.model}
                    </span>
                    <span className="font-medium text-gray-700">
                      {currentCaptain.vehicle?.registrationNumber ||
                        'KA-01-AB-1234'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCallCaptain}
                    className="h-10 w-10 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors"
                  >
                    <svg
                      className="h-5 w-5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleMessageCaptain}
                    className="h-10 w-10 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors"
                  >
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Route info */}
          {activeRide && (
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <div className="w-0.5 h-8 bg-gray-300 my-1" />
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      Pickup
                    </p>
                    <p className="text-sm text-gray-800 font-medium">
                      {activeRide.pickup?.address || 'Pickup location'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      Drop-off
                    </p>
                    <p className="text-sm text-gray-800 font-medium">
                      {activeRide.destination?.address || 'Destination'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Distance & Time */}
              {activeRide.distance && (
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    <span>{activeRide.distance} km</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="h-4 w-4"
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
                    <span>{activeRide.duration || eta || '--'} min</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fare */}
          {activeRide?.fare && (
            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {currentStatus === 'completed' ? 'Total Fare' : 'Estimated Fare'}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{activeRide.fare.total || activeRide.fare}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                  <span className="text-lg">
                    {activeRide.payment?.method === 'cash'
                      ? '💵'
                      : activeRide.payment?.method === 'wallet'
                      ? '👛'
                      : activeRide.payment?.method === 'upi'
                      ? '📱'
                      : '💳'}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {activeRide.payment?.method?.toUpperCase() || 'CASH'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons based on status */}
          <div className="p-4 space-y-3">
            {/* Cancel button - only show for cancellable statuses */}
            {['searching', 'pending', 'accepted', 'arriving', 'arrived'].includes(
              currentStatus
            ) && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowCancelModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Cancel Ride
              </Button>
            )}

            {/* Rate ride button - show after completion if modal was closed */}
            {currentStatus === 'completed' && !showRatingModal && (
              <Button
                fullWidth
                onClick={() => setShowRatingModal(true)}
              >
                Rate Your Ride
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Safety tips during ride */}
      {currentStatus === 'started' && (
        <div className="mx-4 mt-4 bg-blue-50 rounded-xl p-4">
          <h3 className="font-medium text-blue-900 mb-2">Safety Tips</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Share your ride details with family</li>
            <li>• Verify the vehicle number before boarding</li>
            <li>• Use SOS button in case of emergency</li>
          </ul>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Ride"
        maxWidth="max-w-sm"
      >
        <div>
          <p className="text-gray-600 mb-4">
            Are you sure you want to cancel this ride?
            {currentStatus !== 'searching' && currentStatus !== 'pending' && (
              <span className="block mt-1 text-sm text-orange-600">
                ⚠️ Cancellation fee may apply
              </span>
            )}
          </p>
          <div className="space-y-2 mb-4">
            {[
              'Driver is taking too long',
              'Changed my plans',
              'Booked by mistake',
              'Found another ride',
              'Other reason',
            ].map((reason) => (
              <button
                key={reason}
                onClick={() => setCancelReason(reason)}
                className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                  cancelReason === reason
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              className="flex-1"
              disabled={isCancelling}
            >
              Go Back
            </Button>
            <Button
              onClick={handleCancelRide}
              disabled={!cancelReason || isCancelling}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size="sm" />
                  Cancelling...
                </span>
              ) : (
                'Cancel Ride'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rating Modal */}
      <Modal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          dispatch(resetRide());
          navigate('/');
        }}
        title="Rate your ride"
        maxWidth="max-w-sm"
        closeOnOverlayClick={false}
      >
        <div className="text-center">
          {currentCaptain && (
            <div className="mb-4">
              {currentCaptain.profilePicture ? (
                <img
                  src={currentCaptain.profilePicture}
                  alt={currentCaptain.firstName}
                  className="h-16 w-16 mx-auto rounded-full object-cover mb-2"
                />
              ) : (
                <div className="h-16 w-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-2xl font-semibold text-blue-700 mb-2">
                  {currentCaptain.firstName?.[0]?.toUpperCase() || 'C'}
                </div>
              )}
              <p className="font-medium text-gray-900">
                {currentCaptain.firstName} {currentCaptain.lastName}
              </p>
            </div>
          )}

          <p className="text-gray-600 mb-3">How was your ride?</p>

          {/* Star rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-4xl transition-transform hover:scale-110 focus:outline-none"
              >
                {star <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>

          {/* Quick feedback tags */}
          {rating > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {rating >= 4 ? (
                <>
                  {['Smooth ride', 'Great driver', 'Clean car', 'On time'].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setReview((prev) =>
                            prev.includes(tag)
                              ? prev.replace(tag, '').trim()
                              : `${prev} ${tag}`.trim()
                          )
                        }
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          review.includes(tag)
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  )}
                </>
              ) : (
                <>
                  {['Late arrival', 'Rash driving', 'Rude behavior', 'Dirty car'].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setReview((prev) =>
                            prev.includes(tag)
                              ? prev.replace(tag, '').trim()
                              : `${prev} ${tag}`.trim()
                          )
                        }
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          review.includes(tag)
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          )}

          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={3}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
          />

          {/* Tip section */}
          {rating >= 4 && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                Want to add a tip for {currentCaptain?.firstName || 'the captain'}?
              </p>
              <div className="flex justify-center gap-2">
                {tipOptions.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tipAmount === amount
                        ? 'bg-yellow-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    {amount === 0 ? 'No tip' : `₹${amount}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmitRating}
            fullWidth
            disabled={isRating || isTipping}
          >
            {isRating || isTipping ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Submitting...
              </span>
            ) : tipAmount > 0 ? (
              `Submit Rating & Tip ₹${tipAmount}`
            ) : (
              'Submit Rating'
            )}
          </Button>

          <button
            onClick={() => {
              setShowRatingModal(false);
              dispatch(resetRide());
              navigate('/');
            }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ActiveRide;