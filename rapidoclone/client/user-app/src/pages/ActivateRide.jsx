import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import useSocket from '../hooks/useSocket';
import useRide from '../hooks/useRide';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';
import { updateRideStatus, setCaptain } from '../redux/slices/rideSlice';

const ActiveRide = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { socket } = useSocket();
  const { activeRide, status, captain, cancelRide, fetchActiveRide } = useRide();

  const [captainLocation, setCaptainLocation] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  // Fetch active ride on mount
  useEffect(() => {
    fetchActiveRide();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('captain:location', (data) => {
      setCaptainLocation(data.location);
    });

    socket.on('ride:accepted', (data) => {
      dispatch(setCaptain(data.captain));
      dispatch(updateRideStatus('accepted'));
    });

    socket.on('ride:captain-arrived', () => {
      dispatch(updateRideStatus('arrived'));
    });

    socket.on('ride:started', () => {
      dispatch(updateRideStatus('started'));
    });

    socket.on('ride:completed', () => {
      dispatch(updateRideStatus('completed'));
      setShowRatingModal(true);
    });

    socket.on('ride:cancelled', () => {
      dispatch(updateRideStatus('cancelled'));
      navigate('/');
    });

    return () => {
      socket.off('captain:location');
      socket.off('ride:accepted');
      socket.off('ride:captain-arrived');
      socket.off('ride:started');
      socket.off('ride:completed');
      socket.off('ride:cancelled');
    };
  }, [socket, dispatch, navigate]);

  const handleCancelRide = async () => {
    try {
      setCancelling(true);
      await cancelRide({ reason: cancelReason });
      setShowCancelModal(false);
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRating = async () => {
    try {
      // Submit rating API call
      setShowRatingModal(false);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'searching':
        return {
          title: 'Finding your captain...',
          subtitle: 'This usually takes less than a minute',
          color: 'text-blue-600',
          icon: '🔍',
        };
      case 'accepted':
        return {
          title: 'Captain is on the way',
          subtitle: 'Your captain has accepted the ride',
          color: 'text-green-600',
          icon: '🚗',
        };
      case 'arriving':
        return {
          title: 'Captain arriving soon',
          subtitle: 'Almost there!',
          color: 'text-yellow-600',
          icon: '🚗',
        };
      case 'arrived':
        return {
          title: 'Captain has arrived',
          subtitle: 'Share OTP to start your ride',
          color: 'text-green-600',
          icon: '📍',
        };
      case 'started':
        return {
          title: 'Ride in progress',
          subtitle: 'Enjoy your ride!',
          color: 'text-blue-600',
          icon: '🛣️',
        };
      case 'completed':
        return {
          title: 'Ride completed',
          subtitle: 'Thanks for riding with us!',
          color: 'text-green-600',
          icon: '✅',
        };
      default:
        return {
          title: 'Loading...',
          subtitle: '',
          color: 'text-gray-600',
          icon: '⏳',
        };
    }
  };

  const statusConfig = getStatusConfig();

  // No active ride
  if (!activeRide && status === 'idle') {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Map placeholder */}
      <div className="h-72 bg-gray-200 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">Live tracking map</p>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 h-10 w-10 bg-white rounded-full shadow-md flex items-center justify-center"
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

        {/* SOS button */}
        <button className="absolute top-4 right-4 h-10 w-10 bg-red-500 rounded-full shadow-md flex items-center justify-center">
          <span className="text-white text-xs font-bold">SOS</span>
        </button>
      </div>

      {/* Status card */}
      <div className="relative -mt-8 mx-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                {statusConfig.icon}
              </div>
              <div>
                <h2 className={`font-semibold ${statusConfig.color}`}>
                  {statusConfig.title}
                </h2>
                <p className="text-sm text-gray-500">{statusConfig.subtitle}</p>
              </div>
              {status === 'searching' && (
                <div className="ml-auto">
                  <Loader size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* OTP display */}
          {status === 'arrived' && activeRide?.otp?.code && (
            <div className="p-4 bg-green-50 border-b border-green-100">
              <p className="text-sm text-green-700 mb-1">
                Share this OTP with your captain
              </p>
              <p className="text-3xl font-bold text-green-700 tracking-widest">
                {activeRide.otp.code}
              </p>
            </div>
          )}

          {/* Captain info */}
          {captain && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-semibold text-blue-700">
                  {captain.firstName?.[0]?.toUpperCase() || 'C'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {captain.firstName} {captain.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-sm text-gray-600">
                      {captain.ratings?.average?.toFixed(1) || '4.5'}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-600">
                      {captain.vehicle?.registrationNumber || 'KA-01-AB-1234'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
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
                  <button className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
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
                <div className="mt-1 h-3 w-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-xs text-gray-400">Pickup</p>
                  <p className="text-sm text-gray-800">
                    {activeRide.pickup?.address || 'Pickup location'}
                  </p>
                </div>
              </div>
              <div className="ml-1.5 border-l border-dashed border-gray-300 h-4 mb-1" />
              <div className="flex items-start gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-red-500" />
                <div>
                  <p className="text-xs text-gray-400">Drop</p>
                  <p className="text-sm text-gray-800">
                    {activeRide.destination?.address || 'Destination'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fare */}
          {activeRide?.fare && (
            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Estimated Fare</p>
                <p className="text-xl font-bold text-gray-900">
                  ₹{activeRide.fare.total}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {activeRide.payment?.method?.toUpperCase() || 'CASH'}
                </p>
              </div>
            </div>
          )}

          {/* Cancel button */}
          {['searching', 'accepted', 'arriving', 'arrived'].includes(status) && (
            <div className="p-4">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowCancelModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Cancel Ride
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Ride"
        maxWidth="max-w-sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to cancel this ride?
        </p>
        <div className="space-y-2 mb-4">
          {[
            'Driver is too far',
            'Changed my plans',
            'Booked by mistake',
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
          >
            Go Back
          </Button>
          <Button
            onClick={handleCancelRide}
            disabled={!cancelReason || cancelling}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {cancelling ? <Loader size="sm" /> : 'Cancel Ride'}
          </Button>
        </div>
      </Modal>

      {/* Rating Modal */}
      <Modal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        title="Rate your ride"
        maxWidth="max-w-sm"
        closeOnOverlayClick={false}
      >
        <div className="text-center">
          {captain && (
            <div className="mb-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-2xl font-semibold text-blue-700 mb-2">
                {captain.firstName?.[0]?.toUpperCase() || 'C'}
              </div>
              <p className="font-medium text-gray-900">
                {captain.firstName} {captain.lastName}
              </p>
            </div>
          )}

          {/* Star rating */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-3xl transition-transform hover:scale-110"
              >
                {star <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>

          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={3}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <Button onClick={handleSubmitRating} fullWidth className="mt-4">
            Submit Rating
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ActiveRide;