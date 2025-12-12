// src/components/ride/RideCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const statusColors = {
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  started: 'bg-blue-100 text-blue-700',
  accepted: 'bg-yellow-100 text-yellow-800',
  searching: 'bg-gray-100 text-gray-700',
  default: 'bg-gray-100 text-gray-700',
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const formatCurrency = (amount, currency = 'INR') => {
  if (typeof amount !== 'number') return '';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

const RideCard = ({ ride }) => {
  if (!ride) return null;

  const {
    _id,
    rideId,
    status,
    vehicleType,
    pickup,
    destination,
    timestamps,
    fare,
    payment,
    captain,
    createdAt,
  } = ride;

  const displayStatus = (status || 'unknown').toLowerCase();
  const statusClass = statusColors[displayStatus] || statusColors.default;

  const pickupAddress =
    pickup?.address || pickup?.label || 'Pickup not available';
  const destinationAddress =
    destination?.address || destination?.label || 'Destination not available';

  const dateLabel =
    timestamps?.completed ||
    timestamps?.started ||
    timestamps?.accepted ||
    timestamps?.requested ||
    createdAt;

  const totalFare =
    typeof fare?.total === 'number'
      ? fare.total
      : typeof payment?.amount === 'number'
      ? payment.amount
      : null;

  const rideIdentifier = rideId || _id;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 mb-3 shadow-sm">
      {/* Top row: status + date + amount */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusClass}`}
            >
              {displayStatus}
            </span>

            {vehicleType && (
              <span className="text-xs text-gray-500 uppercase">
                {vehicleType}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {rideIdentifier && (
              <span className="mr-2 text-[11px] text-gray-400">
                #{String(rideIdentifier).slice(-8).toUpperCase()}
              </span>
            )}
            {dateLabel && formatDateTime(dateLabel)}
          </p>
        </div>

        {totalFare != null && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(totalFare)}
            </p>
            {payment?.method && (
              <p className="text-xs text-gray-500">
                Paid by {payment.method.toUpperCase()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Route */}
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-1">
          <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
          <div>
            <p className="text-xs text-gray-400">Pickup</p>
            <p className="text-sm text-gray-800 line-clamp-1">
              {pickupAddress}
            </p>
          </div>
        </div>

        <div className="ml-1 border-l border-dashed border-gray-300 h-4" />

        <div className="flex items-start gap-2 mt-1">
          <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
          <div>
            <p className="text-xs text-gray-400">Destination</p>
            <p className="text-sm text-gray-800 line-clamp-1">
              {destinationAddress}
            </p>
          </div>
        </div>
      </div>

      {/* Captain info + actions */}
      <div className="flex items-center justify-between mt-2">
        {captain && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
              {(captain.firstName?.[0] || 'C').toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800">
                {captain.firstName} {captain.lastName}
              </p>
              {captain.ratings?.average && (
                <p className="text-[11px] text-gray-500">
                  ⭐ {captain.ratings.average.toFixed(1)} ·{' '}
                  {captain.ratings.count || 0} rides
                </p>
              )}
            </div>
          </div>
        )}

        {/* Optional: link to ride details page if you add such a route */}
        <div className="text-right">
          <Link
            to={`/rides/${_id || rideId || ''}`}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RideCard;