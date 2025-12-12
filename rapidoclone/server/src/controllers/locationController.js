// src/controllers/locationController.js
const axios = require('axios');
const crypto = require('crypto');
const Location = require('../models/Location');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Ride = require('../models/Ride');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { emitToUser, emitToCaptain } = require('../config/socket');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { calculateDistance } = require('../utils/helpers');

// ==========================================
// GOOGLE MAPS CONFIGURATION
// ==========================================

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api';

/**
 * Make Google Maps API request
 */
const googleMapsRequest = async (endpoint, params) => {
  try {
    const response = await axios.get(`${GOOGLE_MAPS_BASE_URL}${endpoint}`, {
      params: {
        ...params,
        key: GOOGLE_MAPS_API_KEY,
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    logger.error('Google Maps API error:', error.response?.data || error.message);
    throw ApiError.serviceUnavailable('Location service unavailable');
  }
};

/**
 * Parse Google address components
 */
const parseAddressComponents = (components = []) => {
  const result = {};

  components.forEach((component) => {
    if (component.types.includes('street_number')) {
      result.streetNumber = component.long_name;
    }
    if (component.types.includes('route')) {
      result.streetName = component.long_name;
    }
    if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
      result.locality = component.long_name;
    }
    if (component.types.includes('locality')) {
      result.city = component.long_name;
    }
    if (component.types.includes('administrative_area_level_2')) {
      result.district = component.long_name;
    }
    if (component.types.includes('administrative_area_level_1')) {
      result.state = component.long_name;
    }
    if (component.types.includes('country')) {
      result.country = component.long_name;
    }
    if (component.types.includes('postal_code')) {
      result.postalCode = component.long_name;
    }
  });

  return result;
};

/**
 * Get owner info from request
 */
const getOwnerInfo = (req) => {
  if (req.user) {
    return { ownerId: req.user._id, ownerType: 'User' };
  } else if (req.captain) {
    return { ownerId: req.captain._id, ownerType: 'Captain' };
  }
  throw ApiError.unauthorized('Authentication required');
};

// ==========================================
// GEOCODING & PLACES
// ==========================================

/**
 * @desc    Search places with autocomplete
 * @route   GET /api/v1/locations/autocomplete
 * @access  Private (User/Captain)
 */
exports.autocomplete = asyncHandler(async (req, res, next) => {
  const { input, latitude, longitude, radius = 50000, types, language = 'en' } = req.query;

  if (!input || input.length < 2) {
    throw ApiError.badRequest('Please enter at least 2 characters');
  }

  // Check cache
  const cacheKey = `autocomplete:${input}:${latitude || ''}:${longitude || ''}:${types || ''}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      data: { predictions: cached },
    });
  }

  const params = {
    input,
    language,
    components: 'country:in',
  };

  if (latitude && longitude) {
    params.location = `${latitude},${longitude}`;
    params.radius = radius;
  }

  if (types) {
    params.types = types;
  }

  const data = await googleMapsRequest('/place/autocomplete/json', params);

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw ApiError.serviceUnavailable('Failed to fetch suggestions');
  }

  const predictions = (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text,
    secondaryText: p.structured_formatting?.secondary_text,
    types: p.types,
  }));

  // Cache for 1 hour
  await cache.set(cacheKey, predictions, 3600);

  res.status(200).json({
    success: true,
    data: { predictions },
  });
});

/**
 * @desc    Get coordinates from address
 * @route   GET /api/v1/locations/geocode
 * @access  Private (User/Captain)
 */
exports.geocode = asyncHandler(async (req, res, next) => {
  const { address } = req.query;

  if (!address) {
    throw ApiError.badRequest('Address is required');
  }

  // Check cache
  const cacheKey = `geocode:${address.toLowerCase().trim()}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
    });
  }

  const data = await googleMapsRequest('/geocode/json', {
    address,
    region: 'in',
  });

  if (data.status !== 'OK' || !data.results?.length) {
    throw ApiError.notFound('Address not found');
  }

  const result = data.results[0];
  const location = {
    placeId: result.place_id,
    name: result.formatted_address.split(',')[0],
    address: result.formatted_address,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    addressComponents: parseAddressComponents(result.address_components),
  };

  // Cache for 24 hours
  await cache.set(cacheKey, location, 86400);

  res.status(200).json({
    success: true,
    data: location,
  });
});

/**
 * @desc    Get address from coordinates
 * @route   GET /api/v1/locations/reverse-geocode
 * @access  Private (User/Captain)
 */
exports.reverseGeocode = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  // Round for better cache hits
  const lat = parseFloat(latitude).toFixed(5);
  const lng = parseFloat(longitude).toFixed(5);

  // Check cache
  const cacheKey = `reverse:${lat}:${lng}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
    });
  }

  const data = await googleMapsRequest('/geocode/json', {
    latlng: `${latitude},${longitude}`,
  });

  if (data.status !== 'OK' || !data.results?.length) {
    throw ApiError.notFound('Location not found');
  }

  const result = data.results[0];
  const addressComponents = parseAddressComponents(result.address_components);

  const location = {
    placeId: result.place_id,
    name: addressComponents.locality || addressComponents.city || result.formatted_address.split(',')[0],
    address: result.formatted_address,
    shortAddress: [addressComponents.locality, addressComponents.city]
      .filter(Boolean)
      .join(', '),
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    addressComponents,
  };

  // Cache for 24 hours
  await cache.set(cacheKey, location, 86400);

  res.status(200).json({
    success: true,
    data: location,
  });
});

/**
 * @desc    Get place details by place ID
 * @route   GET /api/v1/locations/place-details/:placeId
 * @access  Private (User/Captain)
 */
exports.getPlaceDetails = asyncHandler(async (req, res, next) => {
  const { placeId } = req.params;

  // Check cache
  const cacheKey = `place:${placeId}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    // Increment search count in background
    Location.findOneAndUpdate(
      { placeId },
      { $inc: { searchCount: 1 } }
    ).exec();

    return res.status(200).json({
      success: true,
      data: cached,
    });
  }

  const data = await googleMapsRequest('/place/details/json', {
    place_id: placeId,
    fields: 'name,formatted_address,geometry,address_components,type,formatted_phone_number,website,rating,user_ratings_total,photos,opening_hours',
  });

  if (data.status !== 'OK') {
    throw ApiError.notFound('Place not found');
  }

  const result = data.result;
  const addressComponents = parseAddressComponents(result.address_components || []);

  const location = {
    placeId,
    name: result.name,
    address: result.formatted_address,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    addressComponents,
    type: result.types?.[0] || 'other',
    additionalInfo: {
      phone: result.formatted_phone_number,
      website: result.website,
      rating: result.rating,
      totalRatings: result.user_ratings_total,
      photos: result.photos?.slice(0, 3).map((p) =>
        `${GOOGLE_MAPS_BASE_URL}/place/photo?maxwidth=400&photoreference=${p.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
      ),
    },
    operatingHours: result.opening_hours
      ? {
          is24Hours: result.opening_hours.periods?.some(
            (p) => p.open?.time === '0000' && !p.close
          ),
          weekdayText: result.opening_hours.weekday_text,
        }
      : null,
  };

  // Save/update in database
  await Location.findOneAndUpdate(
    { placeId },
    {
      ...location,
      coordinates: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
      },
      $inc: { searchCount: 1 },
    },
    { upsert: true }
  );

  // Cache for 24 hours
  await cache.set(cacheKey, location, 86400);

  res.status(200).json({
    success: true,
    data: location,
  });
});

/**
 * @desc    Validate a location (check if serviceable)
 * @route   POST /api/v1/locations/validate
 * @access  Private (User)
 */
exports.validateLocation = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  // Check if location is within service area
  // You can define service areas in your database or use a simple radius check
  const serviceableCities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];

  // Get city from coordinates
  const data = await googleMapsRequest('/geocode/json', {
    latlng: `${latitude},${longitude}`,
  });

  let isServiceable = false;
  let cityName = null;

  if (data.status === 'OK' && data.results?.length) {
    const addressComponents = parseAddressComponents(data.results[0].address_components);
    cityName = addressComponents.city;
    isServiceable = serviceableCities.some(
      (city) => city.toLowerCase() === cityName?.toLowerCase()
    );
  }

  res.status(200).json({
    success: true,
    data: {
      isServiceable,
      city: cityName,
      message: isServiceable
        ? 'Location is serviceable'
        : 'Sorry, we do not service this area yet',
    },
  });
});

// ==========================================
// DIRECTIONS & DISTANCE
// ==========================================

/**
 * @desc    Get directions between two points
 * @route   GET /api/v1/locations/directions
 * @access  Private (User/Captain)
 */
exports.getDirections = asyncHandler(async (req, res, next) => {
  const { originLat, originLng, destLat, destLng, mode = 'driving' } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    throw ApiError.badRequest('Origin and destination coordinates are required');
  }

  // Check cache
  const cacheKey = `directions:${originLat}:${originLng}:${destLat}:${destLng}:${mode}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
    });
  }

  const data = await googleMapsRequest('/directions/json', {
    origin: `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    mode,
    departure_time: 'now',
    traffic_model: 'best_guess',
    alternatives: true,
  });

  if (data.status !== 'OK') {
    throw ApiError.notFound('Could not find directions');
  }

  const routes = data.routes.map((route) => {
    const leg = route.legs[0];
    return {
      summary: route.summary,
      distance: {
        text: leg.distance.text,
        value: leg.distance.value,
      },
      duration: {
        text: leg.duration.text,
        value: leg.duration.value,
      },
      durationInTraffic: leg.duration_in_traffic
        ? {
            text: leg.duration_in_traffic.text,
            value: leg.duration_in_traffic.value,
          }
        : null,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      polyline: route.overview_polyline.points,
      steps: leg.steps.map((step) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
        distance: step.distance,
        duration: step.duration,
        startLocation: step.start_location,
        endLocation: step.end_location,
        maneuver: step.maneuver,
        polyline: step.polyline.points,
      })),
    };
  });

  const result = {
    routes,
    bestRoute: routes[0],
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get directions with waypoints
 * @route   POST /api/v1/locations/directions
 * @access  Private (User/Captain)
 */
exports.getDirectionsWithWaypoints = asyncHandler(async (req, res, next) => {
  const { origin, destination, waypoints = [], mode = 'driving' } = req.body;

  if (!origin || !destination) {
    throw ApiError.badRequest('Origin and destination are required');
  }

  const params = {
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode,
    departure_time: 'now',
  };

  if (waypoints.length > 0) {
    params.waypoints = waypoints
      .map((wp) => `${wp.latitude},${wp.longitude}`)
      .join('|');
  }

  const data = await googleMapsRequest('/directions/json', params);

  if (data.status !== 'OK') {
    throw ApiError.notFound('Could not find directions');
  }

  const route = data.routes[0];
  let totalDistance = 0;
  let totalDuration = 0;

  const legs = route.legs.map((leg) => {
    totalDistance += leg.distance.value;
    totalDuration += leg.duration.value;
    return {
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      distance: leg.distance,
      duration: leg.duration,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      totalDistance: {
        text: `${(totalDistance / 1000).toFixed(1)} km`,
        value: totalDistance,
      },
      totalDuration: {
        text: `${Math.ceil(totalDuration / 60)} mins`,
        value: totalDuration,
      },
      legs,
      polyline: route.overview_polyline.points,
    },
  });
});

/**
 * @desc    Get distance and duration between points
 * @route   GET /api/v1/locations/distance
 * @access  Private (User/Captain)
 */
exports.getDistance = asyncHandler(async (req, res, next) => {
  const { originLat, originLng, destLat, destLng } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    throw ApiError.badRequest('Origin and destination coordinates are required');
  }

  const data = await googleMapsRequest('/distancematrix/json', {
    origins: `${originLat},${originLng}`,
    destinations: `${destLat},${destLng}`,
    mode: 'driving',
    departure_time: 'now',
  });

  if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
    throw ApiError.serviceUnavailable('Could not calculate distance');
  }

  const element = data.rows[0].elements[0];

  if (element.status !== 'OK') {
    throw ApiError.notFound('Route not found');
  }

  res.status(200).json({
    success: true,
    data: {
      distance: element.distance,
      duration: element.duration,
      durationInTraffic: element.duration_in_traffic,
    },
  });
});

/**
 * @desc    Get distance matrix for multiple origins/destinations
 * @route   POST /api/v1/locations/distance-matrix
 * @access  Private (User/Captain)
 */
exports.getDistanceMatrix = asyncHandler(async (req, res, next) => {
  const { origins, destinations } = req.body;

  if (!origins?.length || !destinations?.length) {
    throw ApiError.badRequest('Origins and destinations are required');
  }

  if (origins.length > 25 || destinations.length > 25) {
    throw ApiError.badRequest('Maximum 25 origins/destinations allowed');
  }

  const originsStr = origins
    .map((o) => `${o.latitude},${o.longitude}`)
    .join('|');
  const destinationsStr = destinations
    .map((d) => `${d.latitude},${d.longitude}`)
    .join('|');

  const data = await googleMapsRequest('/distancematrix/json', {
    origins: originsStr,
    destinations: destinationsStr,
    mode: 'driving',
    departure_time: 'now',
  });

  if (data.status !== 'OK') {
    throw ApiError.serviceUnavailable('Could not calculate distances');
  }

  const matrix = data.rows.map((row, i) => ({
    origin: origins[i],
    destinations: row.elements.map((element, j) => ({
      destination: destinations[j],
      distance: element.distance,
      duration: element.duration,
      status: element.status,
    })),
  }));

  res.status(200).json({
    success: true,
    data: { matrix },
  });
});

/**
 * @desc    Get estimated time of arrival
 * @route   GET /api/v1/locations/eta
 * @access  Private (User/Captain)
 */
exports.getETA = asyncHandler(async (req, res, next) => {
  const { originLat, originLng, destLat, destLng, departureTime } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    throw ApiError.badRequest('Origin and destination coordinates are required');
  }

  const data = await googleMapsRequest('/distancematrix/json', {
    origins: `${originLat},${originLng}`,
    destinations: `${destLat},${destLng}`,
    mode: 'driving',
    departure_time: departureTime || 'now',
    traffic_model: 'best_guess',
  });

  if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
    throw ApiError.serviceUnavailable('Could not calculate ETA');
  }

  const element = data.rows[0].elements[0];

  if (element.status !== 'OK') {
    throw ApiError.notFound('Route not found');
  }

  const durationSeconds =
    element.duration_in_traffic?.value || element.duration.value;
  const arrivalTime = new Date(Date.now() + durationSeconds * 1000);

  res.status(200).json({
    success: true,
    data: {
      duration: element.duration_in_traffic || element.duration,
      distance: element.distance,
      estimatedArrival: arrivalTime,
      arrivalTimeText: arrivalTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  });
});

// ==========================================
// NEARBY PLACES & CAPTAINS
// ==========================================

/**
 * @desc    Get nearby places by type
 * @route   GET /api/v1/locations/nearby
 * @access  Private (User/Captain)
 */
exports.getNearbyPlaces = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, type, radius = 5000, limit = 20 } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  // First check database
  const dbLocations = await Location.findNearby(
    parseFloat(longitude),
    parseFloat(latitude),
    parseInt(radius),
    parseInt(limit)
  );

  if (dbLocations.length >= limit) {
    return res.status(200).json({
      success: true,
      data: { places: dbLocations },
    });
  }

  // Fetch from Google
  const params = {
    location: `${latitude},${longitude}`,
    radius,
    language: 'en',
  };

  if (type) {
    params.type = type;
  }

  const data = await googleMapsRequest('/place/nearbysearch/json', params);

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw ApiError.serviceUnavailable('Failed to fetch nearby places');
  }

  const places = (data.results || []).slice(0, limit).map((place) => ({
    placeId: place.place_id,
    name: place.name,
    address: place.vicinity,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    type: place.types?.[0],
    rating: place.rating,
    isOpen: place.opening_hours?.open_now,
    distance: calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      place.geometry.location.lat,
      place.geometry.location.lng
    ),
  }));

  // Sort by distance
  places.sort((a, b) => a.distance - b.distance);

  res.status(200).json({
    success: true,
    data: { places },
  });
});

/**
 * @desc    Get nearby available captains
 * @route   GET /api/v1/locations/nearby-captains
 * @access  Private (User)
 */
exports.getNearbyCaptains = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, vehicleType, radius = 5000 } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  const query = {
    isActive: true,
    isAvailable: true,
    isOnline: true,
    'currentLocation.coordinates': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance: parseInt(radius),
      },
    },
  };

  if (vehicleType) {
    query['vehicle.type'] = vehicleType;
  }

  const captains = await Captain.find(query)
    .select('firstName vehicle currentLocation ratings')
    .limit(20);

  const captainsWithDistance = captains.map((captain) => {
    const captainLat = captain.currentLocation.coordinates[1];
    const captainLng = captain.currentLocation.coordinates[0];

    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      captainLat,
      captainLng
    );

    return {
      id: captain._id,
      name: captain.firstName,
      vehicle: captain.vehicle,
      rating: captain.ratings?.average || 5,
      distance: Math.round(distance * 1000), // meters
      eta: Math.ceil((distance / 30) * 60), // minutes (assuming 30 km/h)
      location: {
        latitude: captainLat,
        longitude: captainLng,
      },
    };
  });

  res.status(200).json({
    success: true,
    data: {
      captains: captainsWithDistance,
      count: captainsWithDistance.length,
    },
  });
});

/**
 * @desc    Get ETA for nearest captain
 * @route   GET /api/v1/locations/captain-eta
 * @access  Private (User)
 */
exports.getCaptainETA = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, vehicleType } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  const query = {
    isActive: true,
    isAvailable: true,
    isOnline: true,
    'currentLocation.coordinates': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance: 10000, // 10 km
      },
    },
  };

  if (vehicleType) {
    query['vehicle.type'] = vehicleType;
  }

  const nearestCaptain = await Captain.findOne(query)
    .select('currentLocation')
    .limit(1);

  if (!nearestCaptain) {
    return res.status(200).json({
      success: true,
      data: {
        available: false,
        message: 'No captains available nearby',
      },
    });
  }

  // Get actual ETA using distance matrix
  const captainLat = nearestCaptain.currentLocation.coordinates[1];
  const captainLng = nearestCaptain.currentLocation.coordinates[0];

  const data = await googleMapsRequest('/distancematrix/json', {
    origins: `${captainLat},${captainLng}`,
    destinations: `${latitude},${longitude}`,
    mode: 'driving',
    departure_time: 'now',
  });

  let eta = 5; // Default 5 minutes

  if (
    data.status === 'OK' &&
    data.rows?.[0]?.elements?.[0]?.status === 'OK'
  ) {
    eta = Math.ceil(data.rows[0].elements[0].duration.value / 60);
  }

  res.status(200).json({
    success: true,
    data: {
      available: true,
      eta,
      etaText: `${eta} min${eta > 1 ? 's' : ''}`,
    },
  });
});

// ==========================================
// POPULAR & RECENT LOCATIONS
// ==========================================

/**
 * @desc    Get popular locations in city
 * @route   GET /api/v1/locations/popular
 * @access  Private (User)
 */
exports.getPopularLocations = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, city, limit = 10 } = req.query;

  let cityName = city;

  // Get city from coordinates if not provided
  if (!cityName && latitude && longitude) {
    const data = await googleMapsRequest('/geocode/json', {
      latlng: `${latitude},${longitude}`,
    });

    if (data.status === 'OK' && data.results?.length) {
      const components = parseAddressComponents(data.results[0].address_components);
      cityName = components.city;
    }
  }

  let locations;

  if (cityName) {
    locations = await Location.getPopularInCity(cityName, parseInt(limit));
  } else {
    locations = await Location.find({ isPopular: true, isActive: true })
      .sort({ searchCount: -1 })
      .limit(parseInt(limit));
  }

  res.status(200).json({
    success: true,
    data: { locations },
  });
});

/**
 * @desc    Get user's recent locations
 * @route   GET /api/v1/locations/recent
 * @access  Private (User)
 */
exports.getRecentLocations = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  // Get recent rides
  const recentRides = await Ride.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) * 2)
    .select('pickupAddress pickupCoordinates dropAddress dropCoordinates createdAt');

  // Extract unique locations
  const locationMap = new Map();

  recentRides.forEach((ride) => {
    // Add pickup
    if (ride.pickupCoordinates?.latitude && ride.pickupCoordinates?.longitude) {
      const pickupKey = `${ride.pickupCoordinates.latitude.toFixed(4)},${ride.pickupCoordinates.longitude.toFixed(4)}`;
      if (!locationMap.has(pickupKey)) {
        locationMap.set(pickupKey, {
          name: ride.pickupAddress?.split(',')[0] || 'Pickup Location',
          address: ride.pickupAddress,
          latitude: ride.pickupCoordinates.latitude,
          longitude: ride.pickupCoordinates.longitude,
          lastUsed: ride.createdAt,
          type: 'pickup',
        });
      }
    }

    // Add drop
    if (ride.dropCoordinates?.latitude && ride.dropCoordinates?.longitude) {
      const dropKey = `${ride.dropCoordinates.latitude.toFixed(4)},${ride.dropCoordinates.longitude.toFixed(4)}`;
      if (!locationMap.has(dropKey)) {
        locationMap.set(dropKey, {
          name: ride.dropAddress?.split(',')[0] || 'Drop Location',
          address: ride.dropAddress,
          latitude: ride.dropCoordinates.latitude,
          longitude: ride.dropCoordinates.longitude,
          lastUsed: ride.createdAt,
          type: 'drop',
        });
      }
    }
  });

  const locations = Array.from(locationMap.values())
    .slice(0, parseInt(limit))
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));

  res.status(200).json({
    success: true,
    data: { locations },
  });
});

/**
 * @desc    Clear recent locations
 * @route   DELETE /api/v1/locations/recent
 * @access  Private (User)
 */
exports.clearRecentLocations = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Clear from cache
  await cache.del(`recent_locations:${userId}`);

  res.status(200).json({
    success: true,
    message: 'Recent locations cleared',
  });
});

/**
 * @desc    Remove a recent location
 * @route   DELETE /api/v1/locations/recent/:locationId
 * @access  Private (User)
 */
exports.removeRecentLocation = asyncHandler(async (req, res, next) => {
  const { locationId } = req.params;

  // Since recent locations are derived from rides, we can't really delete them
  // But we can mark them as hidden in cache

  res.status(200).json({
    success: true,
    message: 'Location removed from recent',
  });
});

// ==========================================
// SAVED LOCATIONS
// ==========================================

/**
 * @desc    Get user's saved locations
 * @route   GET /api/v1/locations/saved
 * @access  Private (User)
 */
exports.getSavedLocations = asyncHandler(async (req, res, next) => {
  console.log('Fetching saved locations for user:', req.user._id);
  const userId = req.user._id;

  const user = await User.findById(userId).select('savedLocations');

  res.status(200).json({
    success: true,
    data: { locations: user.savedLocations || [] },
  });
});

/**
 * @desc    Save a location
 * @route   POST /api/v1/locations/saved
 * @access  Private (User)
 */
exports.saveLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { label, type = 'other', name, address, latitude, longitude, placeId } = req.body;

  if (!name || !address || !latitude || !longitude) {
    throw ApiError.badRequest('Name, address, and coordinates are required');
  }

  const user = await User.findById(userId).select('savedLocations');

  // Check limit
  if (user.savedLocations?.length >= 20) {
    throw ApiError.badRequest('Maximum 20 saved locations allowed');
  }

  // Check for duplicate
  const isDuplicate = user.savedLocations?.some(
    (loc) =>
      Math.abs(loc.coordinates.latitude - latitude) < 0.0001 &&
      Math.abs(loc.coordinates.longitude - longitude) < 0.0001
  );

  if (isDuplicate) {
    throw ApiError.badRequest('Location already saved');
  }

  const newLocation = {
    name: label || name,
    address,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    },
    type,
    placeId,
  };

  await User.findByIdAndUpdate(userId, {
    $push: { savedLocations: newLocation },
  });

  res.status(201).json({
    success: true,
    message: 'Location saved',
    data: { location: newLocation },
  });
});

/**
 * @desc    Get saved location details
 * @route   GET /api/v1/locations/saved/:locationId
 * @access  Private (User)
 */
exports.getSavedLocationById = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { locationId } = req.params;

  const user = await User.findById(userId).select('savedLocations');
  const location = user.savedLocations?.id(locationId);

  if (!location) {
    throw ApiError.notFound('Location not found');
  }

  res.status(200).json({
    success: true,
    data: { location },
  });
});

/**
 * @desc    Update saved location
 * @route   PUT /api/v1/locations/saved/:locationId
 * @access  Private (User)
 */
exports.updateSavedLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { locationId } = req.params;
  const { label, type, name, address, latitude, longitude } = req.body;

  const user = await User.findById(userId).select('savedLocations');
  const location = user.savedLocations?.id(locationId);

  if (!location) {
    throw ApiError.notFound('Location not found');
  }

  // Update fields
  if (label || name) location.name = label || name;
  if (type) location.type = type;
  if (address) location.address = address;
  if (latitude) location.coordinates.latitude = parseFloat(latitude);
  if (longitude) location.coordinates.longitude = parseFloat(longitude);

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Location updated',
    data: { location },
  });
});

/**
 * @desc    Delete saved location
 * @route   DELETE /api/v1/locations/saved/:locationId
 * @access  Private (User)
 */
exports.deleteSavedLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { locationId } = req.params;

  const result = await User.updateOne(
    { _id: userId },
    { $pull: { savedLocations: { _id: locationId } } }
  );

  if (result.modifiedCount === 0) {
    throw ApiError.notFound('Location not found');
  }

  res.status(200).json({
    success: true,
    message: 'Location deleted',
  });
});

/**
 * @desc    Get home location
 * @route   GET /api/v1/locations/saved/home
 * @access  Private (User)
 */
exports.getHomeLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('savedLocations');
  const homeLocation = user.savedLocations?.find((loc) => loc.type === 'home');

  res.status(200).json({
    success: true,
    data: { location: homeLocation || null },
  });
});

/**
 * @desc    Set/update home location
 * @route   PUT /api/v1/locations/saved/home
 * @access  Private (User)
 */
exports.setHomeLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { name, address, latitude, longitude, placeId } = req.body;

  if (!address || !latitude || !longitude) {
    throw ApiError.badRequest('Address and coordinates are required');
  }

  const user = await User.findById(userId).select('savedLocations');

  // Find existing home
  const existingHomeIndex = user.savedLocations?.findIndex(
    (loc) => loc.type === 'home'
  );

  const homeLocation = {
    name: name || 'Home',
    address,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    },
    type: 'home',
    placeId,
  };

  if (existingHomeIndex >= 0) {
    user.savedLocations[existingHomeIndex] = {
      ...user.savedLocations[existingHomeIndex].toObject(),
      ...homeLocation,
    };
  } else {
    user.savedLocations = user.savedLocations || [];
    user.savedLocations.push(homeLocation);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Home location saved',
    data: { location: homeLocation },
  });
});

/**
 * @desc    Get work location
 * @route   GET /api/v1/locations/saved/work
 * @access  Private (User)
 */
exports.getWorkLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('savedLocations');
  const workLocation = user.savedLocations?.find((loc) => loc.type === 'work');

  res.status(200).json({
    success: true,
    data: { location: workLocation || null },
  });
});

/**
 * @desc    Set/update work location
 * @route   PUT /api/v1/locations/saved/work
 * @access  Private (User)
 */
exports.setWorkLocation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { name, address, latitude, longitude, placeId } = req.body;

  if (!address || !latitude || !longitude) {
    throw ApiError.badRequest('Address and coordinates are required');
  }

  const user = await User.findById(userId).select('savedLocations');

  // Find existing work
  const existingWorkIndex = user.savedLocations?.findIndex(
    (loc) => loc.type === 'work'
  );

  const workLocation = {
    name: name || 'Work',
    address,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    },
    type: 'work',
    placeId,
  };

  if (existingWorkIndex >= 0) {
    user.savedLocations[existingWorkIndex] = {
      ...user.savedLocations[existingWorkIndex].toObject(),
      ...workLocation,
    };
  } else {
    user.savedLocations = user.savedLocations || [];
    user.savedLocations.push(workLocation);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Work location saved',
    data: { location: workLocation },
  });
});

// ==========================================
// SERVICE AREAS & ZONES
// ==========================================

/**
 * @desc    Get all service zones
 * @route   GET /api/v1/locations/zones
 * @access  Private (User/Captain)
 */
exports.getZones = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.query;

  // For simplicity, return predefined zones
  // In production, you'd have a Zone model
  const zones = [
    {
      id: 'zone_1',
      name: 'Bangalore Central',
      city: 'Bangalore',
      surgeMultiplier: 1.0,
      isActive: true,
    },
    {
      id: 'zone_2',
      name: 'Bangalore Airport',
      city: 'Bangalore',
      surgeMultiplier: 1.2,
      isActive: true,
    },
    {
      id: 'zone_3',
      name: 'Electronic City',
      city: 'Bangalore',
      surgeMultiplier: 1.0,
      isActive: true,
    },
  ];

  res.status(200).json({
    success: true,
    data: { zones },
  });
});

/**
 * @desc    Get zone details
 * @route   GET /api/v1/locations/zones/:zoneId
 * @access  Private (User/Captain)
 */
exports.getZoneDetails = asyncHandler(async (req, res, next) => {
  const { zoneId } = req.params;

  // Placeholder
  const zone = {
    id: zoneId,
    name: 'Bangalore Central',
    city: 'Bangalore',
    surgeMultiplier: 1.0,
    isActive: true,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5, 12.9],
          [77.7, 12.9],
          [77.7, 13.1],
          [77.5, 13.1],
          [77.5, 12.9],
        ],
      ],
    },
  };

  res.status(200).json({
    success: true,
    data: { zone },
  });
});

/**
 * @desc    Check if location is serviceable
 * @route   GET /api/v1/locations/check-serviceability
 * @access  Private (User)
 */
exports.checkServiceability = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  // Get city from coordinates
  const data = await googleMapsRequest('/geocode/json', {
    latlng: `${latitude},${longitude}`,
  });

  let isServiceable = false;
  let cityName = null;

  const serviceableCities = [
    'bangalore',
    'bengaluru',
    'mumbai',
    'delhi',
    'chennai',
    'hyderabad',
    'pune',
    'kolkata',
  ];

  if (data.status === 'OK' && data.results?.length) {
    const components = parseAddressComponents(data.results[0].address_components);
    cityName = components.city;
    isServiceable = serviceableCities.includes(cityName?.toLowerCase());
  }

  res.status(200).json({
    success: true,
    data: {
      isServiceable,
      city: cityName,
      message: isServiceable
        ? 'Location is serviceable'
        : 'Sorry, we do not service this area yet',
    },
  });
});

/**
 * @desc    Check if route is serviceable
 * @route   POST /api/v1/locations/check-route-serviceability
 * @access  Private (User)
 */
exports.checkRouteServiceability = asyncHandler(async (req, res, next) => {
  const { pickup, destination } = req.body;

  if (!pickup || !destination) {
    throw ApiError.badRequest('Pickup and destination are required');
  }

  const serviceableCities = [
    'bangalore',
    'bengaluru',
    'mumbai',
    'delhi',
    'chennai',
    'hyderabad',
  ];

  // Check pickup
  const pickupData = await googleMapsRequest('/geocode/json', {
    latlng: `${pickup.lat},${pickup.lng}`,
  });

  let pickupCity = null;
  let pickupServiceable = false;

  if (pickupData.status === 'OK' && pickupData.results?.length) {
    const components = parseAddressComponents(pickupData.results[0].address_components);
    pickupCity = components.city;
    pickupServiceable = serviceableCities.includes(pickupCity?.toLowerCase());
  }

  // Check destination
  const destData = await googleMapsRequest('/geocode/json', {
    latlng: `${destination.lat},${destination.lng}`,
  });

  let destCity = null;
  let destServiceable = false;

  if (destData.status === 'OK' && destData.results?.length) {
    const components = parseAddressComponents(destData.results[0].address_components);
    destCity = components.city;
    destServiceable = serviceableCities.includes(destCity?.toLowerCase());
  }

  const isServiceable = pickupServiceable && destServiceable;

  res.status(200).json({
    success: true,
    data: {
      isServiceable,
      pickup: {
        serviceable: pickupServiceable,
        city: pickupCity,
      },
      destination: {
        serviceable: destServiceable,
        city: destCity,
      },
      message: !isServiceable
        ? !pickupServiceable
          ? 'Pickup location is not serviceable'
          : 'Destination is not serviceable'
        : 'Route is serviceable',
    },
  });
});

/**
 * @desc    Get surge pricing zones
 * @route   GET /api/v1/locations/surge-zones
 * @access  Private (User/Captain)
 */
exports.getSurgeZones = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, radius = 10000 } = req.query;

  // Placeholder surge zones
  const surgeZones = [
    {
      id: 'surge_1',
      name: 'Airport Zone',
      surgeMultiplier: 1.5,
      center: { latitude: 13.1986, longitude: 77.7066 },
      radius: 5000,
    },
    {
      id: 'surge_2',
      name: 'MG Road',
      surgeMultiplier: 1.3,
      center: { latitude: 12.9716, longitude: 77.6199 },
      radius: 2000,
    },
  ];

  res.status(200).json({
    success: true,
    data: { zones: surgeZones },
  });
});

/**
 * @desc    Get surge multiplier for location
 * @route   GET /api/v1/locations/surge-multiplier
 * @access  Private (User)
 */
exports.getSurgeMultiplier = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, vehicleType } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  // Calculate surge based on demand/supply
  // This is simplified - in production, you'd calculate based on
  // active ride requests vs available captains in the area

  const nearbyCaptains = await Captain.countDocuments({
    isOnline: true,
    isAvailable: true,
    'currentLocation.coordinates': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance: 5000,
      },
    },
    ...(vehicleType && { 'vehicle.type': vehicleType }),
  });

  // Simple surge calculation
  let surgeMultiplier = 1.0;

  if (nearbyCaptains < 3) {
    surgeMultiplier = 2.0;
  } else if (nearbyCaptains < 5) {
    surgeMultiplier = 1.5;
  } else if (nearbyCaptains < 10) {
    surgeMultiplier = 1.2;
  }

  res.status(200).json({
    success: true,
    data: {
      surgeMultiplier,
      isSurge: surgeMultiplier > 1,
      nearbyCaptains,
      message:
        surgeMultiplier > 1
          ? `High demand in your area. Fares are ${surgeMultiplier}x normal.`
          : null,
    },
  });
});

// ==========================================
// CITIES & REGIONS
// ==========================================

/**
 * @desc    Get list of serviceable cities
 * @route   GET /api/v1/locations/cities
 * @access  Public
 */
exports.getCities = asyncHandler(async (req, res, next) => {
  const cities = [
    {
      id: 'bangalore',
      name: 'Bangalore',
      state: 'Karnataka',
      isActive: true,
      coordinates: { latitude: 12.9716, longitude: 77.5946 },
    },
    {
      id: 'mumbai',
      name: 'Mumbai',
      state: 'Maharashtra',
      isActive: true,
      coordinates: { latitude: 19.076, longitude: 72.8777 },
    },
    {
      id: 'delhi',
      name: 'Delhi',
      state: 'Delhi',
      isActive: true,
      coordinates: { latitude: 28.6139, longitude: 77.209 },
    },
    {
      id: 'chennai',
      name: 'Chennai',
      state: 'Tamil Nadu',
      isActive: true,
      coordinates: { latitude: 13.0827, longitude: 80.2707 },
    },
    {
      id: 'hyderabad',
      name: 'Hyderabad',
      state: 'Telangana',
      isActive: true,
      coordinates: { latitude: 17.385, longitude: 78.4867 },
    },
    {
      id: 'pune',
      name: 'Pune',
      state: 'Maharashtra',
      isActive: true,
      coordinates: { latitude: 18.5204, longitude: 73.8567 },
    },
    {
      id: 'kolkata',
      name: 'Kolkata',
      state: 'West Bengal',
      isActive: true,
      coordinates: { latitude: 22.5726, longitude: 88.3639 },
    },
  ];

  res.status(200).json({
    success: true,
    data: { cities },
  });
});

/**
 * @desc    Get city details
 * @route   GET /api/v1/locations/cities/:cityId
 * @access  Public
 */
exports.getCityDetails = asyncHandler(async (req, res, next) => {
  const { cityId } = req.params;

  const cities = {
    bangalore: {
      id: 'bangalore',
      name: 'Bangalore',
      state: 'Karnataka',
      isActive: true,
      coordinates: { latitude: 12.9716, longitude: 77.5946 },
      vehicleTypes: ['bike', 'auto', 'mini', 'sedan', 'suv'],
      popularAreas: ['MG Road', 'Koramangala', 'Indiranagar', 'Whitefield'],
    },
  };

  const city = cities[cityId];

  if (!city) {
    throw ApiError.notFound('City not found');
  }

  res.status(200).json({
    success: true,
    data: { city },
  });
});

/**
 * @desc    Get city info by coordinates
 * @route   GET /api/v1/locations/city-info
 * @access  Private (User/Captain)
 */
exports.getCityInfo = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  const data = await googleMapsRequest('/geocode/json', {
    latlng: `${latitude},${longitude}`,
  });

  if (data.status !== 'OK' || !data.results?.length) {
    throw ApiError.notFound('Could not determine city');
  }

  const components = parseAddressComponents(data.results[0].address_components);

  const serviceableCities = [
    'bangalore',
    'bengaluru',
    'mumbai',
    'delhi',
    'chennai',
    'hyderabad',
  ];

  res.status(200).json({
    success: true,
    data: {
      city: components.city,
      state: components.state,
      country: components.country,
      isServiceable: serviceableCities.includes(components.city?.toLowerCase()),
    },
  });
});

/**
 * @desc    Get airports in city
 * @route   GET /api/v1/locations/airports
 * @access  Private (User)
 */
exports.getAirports = asyncHandler(async (req, res, next) => {
  const { city, latitude, longitude, radius = 50000 } = req.query;

  let airports;

  if (latitude && longitude) {
    const data = await googleMapsRequest('/place/nearbysearch/json', {
      location: `${latitude},${longitude}`,
      radius,
      type: 'airport',
    });

    airports = (data.results || []).map((place) => ({
      placeId: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
    }));
  } else {
    airports = await Location.find({
      type: 'airport',
      isActive: true,
      ...(city && { 'addressComponents.city': new RegExp(city, 'i') }),
    })
      .select('name address latitude longitude placeId')
      .limit(10);
  }

  res.status(200).json({
    success: true,
    data: { airports },
  });
});

/**
 * @desc    Get railway stations in city
 * @route   GET /api/v1/locations/railway-stations
 * @access  Private (User)
 */
exports.getRailwayStations = asyncHandler(async (req, res, next) => {
  const { city, latitude, longitude, radius = 20000 } = req.query;

  let stations;

  if (latitude && longitude) {
    const data = await googleMapsRequest('/place/nearbysearch/json', {
      location: `${latitude},${longitude}`,
      radius,
      type: 'train_station',
    });

    stations = (data.results || []).map((place) => ({
      placeId: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
    }));
  } else {
    stations = await Location.find({
      type: 'railway_station',
      isActive: true,
      ...(city && { 'addressComponents.city': new RegExp(city, 'i') }),
    })
      .select('name address latitude longitude placeId')
      .limit(20);
  }

  res.status(200).json({
    success: true,
    data: { stations },
  });
});

// ==========================================
// RIDE TRACKING
// ==========================================

/**
 * @desc    Get real-time ride tracking info
 * @route   GET /api/v1/locations/track/:rideId
 * @access  Private (User)
 */
exports.getRideTracking = asyncHandler(async (req, res, next) => {
  const { rideId } = req.params;
  const userId = req.user._id;

  const ride = await Ride.findOne({ _id: rideId, user: userId })
    .populate('captain', 'firstName vehicle currentLocation phone')
    .select('status pickupAddress pickupCoordinates dropAddress dropCoordinates');

  if (!ride) {
    throw ApiError.notFound('Ride not found');
  }

  if (!['accepted', 'arriving', 'arrived', 'started'].includes(ride.status)) {
    throw ApiError.badRequest('Ride is not trackable');
  }

  let eta = null;
  let route = null;

  if (ride.captain?.currentLocation) {
    const captainLat = ride.captain.currentLocation.coordinates[1];
    const captainLng = ride.captain.currentLocation.coordinates[0];

    // Destination depends on status
    const isEnRoute = ride.status === 'started';
    const destLat = isEnRoute
      ? ride.dropCoordinates.latitude
      : ride.pickupCoordinates.latitude;
    const destLng = isEnRoute
      ? ride.dropCoordinates.longitude
      : ride.pickupCoordinates.longitude;

    // Get ETA
    try {
      const etaData = await googleMapsRequest('/distancematrix/json', {
        origins: `${captainLat},${captainLng}`,
        destinations: `${destLat},${destLng}`,
        mode: 'driving',
        departure_time: 'now',
      });

      if (
        etaData.status === 'OK' &&
        etaData.rows?.[0]?.elements?.[0]?.status === 'OK'
      ) {
        const element = etaData.rows[0].elements[0];
        eta = {
          duration: element.duration_in_traffic || element.duration,
          distance: element.distance,
        };
      }
    } catch (error) {
      logger.warn('Failed to get ETA:', error);
    }

    // Get route
    try {
      const directionsData = await googleMapsRequest('/directions/json', {
        origin: `${captainLat},${captainLng}`,
        destination: `${destLat},${destLng}`,
        mode: 'driving',
      });

      if (
        directionsData.status === 'OK' &&
        directionsData.routes?.length
      ) {
        route = directionsData.routes[0].overview_polyline.points;
      }
    } catch (error) {
      logger.warn('Failed to get route:', error);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ride: {
        id: ride._id,
        status: ride.status,
        pickup: {
          address: ride.pickupAddress,
          coordinates: ride.pickupCoordinates,
        },
        drop: {
          address: ride.dropAddress,
          coordinates: ride.dropCoordinates,
        },
      },
      captain: ride.captain
        ? {
            name: ride.captain.firstName,
            phone: ride.captain.phone,
            vehicle: ride.captain.vehicle,
            location: {
              latitude: ride.captain.currentLocation?.coordinates[1],
              longitude: ride.captain.currentLocation?.coordinates[0],
            },
          }
        : null,
      eta,
      route,
    },
  });
});

/**
 * @desc    Generate shareable tracking link
 * @route   POST /api/v1/locations/share/:rideId
 * @access  Private (User)
 */
exports.generateTrackingLink = asyncHandler(async (req, res, next) => {
  const { rideId } = req.params;
  const { expiresIn = 3600 } = req.body;
  const userId = req.user._id;

  const ride = await Ride.findOne({ _id: rideId, user: userId });

  if (!ride) {
    throw ApiError.notFound('Ride not found');
  }

  // Generate share token
  const shareToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  ride.shareToken = shareToken;
  ride.shareTokenExpiresAt = expiresAt;
  await ride.save();

  const shareUrl = `${process.env.APP_URL}/track/${shareToken}`;

  res.status(200).json({
    success: true,
    data: {
      shareToken,
      shareUrl,
      expiresAt,
    },
  });
});

/**
 * @desc    Get tracking info via share token
 * @route   GET /api/v1/locations/share/:shareToken
 * @access  Public
 */
exports.getSharedTracking = asyncHandler(async (req, res, next) => {
  const { shareToken } = req.params;

  const ride = await Ride.findOne({
    shareToken,
    shareTokenExpiresAt: { $gt: new Date() },
  })
    .populate('captain', 'firstName vehicle currentLocation')
    .populate('user', 'firstName')
    .select('status pickupAddress pickupCoordinates dropAddress dropCoordinates');

  if (!ride) {
    throw ApiError.notFound('Invalid or expired tracking link');
  }

  res.status(200).json({
    success: true,
    data: {
      ride: {
        status: ride.status,
        pickup: ride.pickupAddress,
        drop: ride.dropAddress,
        pickupCoordinates: ride.pickupCoordinates,
        dropCoordinates: ride.dropCoordinates,
      },
      captain: ride.captain
        ? {
            name: ride.captain.firstName,
            vehicle: ride.captain.vehicle,
            location: {
              latitude: ride.captain.currentLocation?.coordinates[1],
              longitude: ride.captain.currentLocation?.coordinates[0],
            },
          }
        : null,
      user: {
        name: ride.user?.firstName,
      },
    },
  });
});

/**
 * @desc    Revoke tracking link
 * @route   DELETE /api/v1/locations/share/:rideId
 * @access  Private (User)
 */
exports.revokeTrackingLink = asyncHandler(async (req, res, next) => {
  const { rideId } = req.params;
  const userId = req.user._id;

  await Ride.findOneAndUpdate(
    { _id: rideId, user: userId },
    { $unset: { shareToken: 1, shareTokenExpiresAt: 1 } }
  );

  res.status(200).json({
    success: true,
    message: 'Tracking link revoked',
  });
});

// ==========================================
// CAPTAIN LOCATION
// ==========================================

/**
 * @desc    Update captain current location
 * @route   PUT /api/v1/locations/captain/update
 * @access  Private (Captain)
 */
exports.updateCaptainLocation = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;
  const { latitude, longitude, heading, speed, accuracy } = req.body;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  const updateData = {
    currentLocation: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      heading: heading || 0,
      speed: speed || 0,
      accuracy: accuracy || 0,
      updatedAt: new Date(),
    },
    lastLocationUpdate: new Date(),
  };

  await Captain.findByIdAndUpdate(captainId, updateData);

  // Store in Redis for faster access
  await cache.set(
    `captain:${captainId}:location`,
    {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      heading,
      speed,
      updatedAt: Date.now(),
    },
    300
  );

  // If captain has active ride, emit location to user
  const activeRide = await Ride.findOne({
    captain: captainId,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  }).select('user');

  if (activeRide) {
    emitToUser(activeRide.user.toString(), 'captain:location:update', {
      rideId: activeRide._id,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        heading,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Location updated',
  });
});

/**
 * @desc    Get captain location history
 * @route   GET /api/v1/locations/captain/history
 * @access  Private (Captain)
 */
exports.getCaptainLocationHistory = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;
  const { startDate, endDate, rideId, limit = 100 } = req.query;

  // If rideId provided, get route for that ride
  if (rideId) {
    const ride = await Ride.findOne({ _id: rideId, captain: captainId }).select(
      'routeTaken startedAt completedAt'
    );

    if (!ride) {
      throw ApiError.notFound('Ride not found');
    }

    return res.status(200).json({
      success: true,
      data: {
        history: ride.routeTaken || [],
        rideId,
        startedAt: ride.startedAt,
        completedAt: ride.completedAt,
      },
    });
  }

  // Otherwise return recent location updates from cache
  const cacheKey = `captain:${captainId}:location_history`;
  let history = await cache.get(cacheKey);

  if (!history) {
    history = [];
  }

  // Filter by date if provided
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    history = history.filter((h) => h.timestamp >= start && h.timestamp <= end);
  }

  res.status(200).json({
    success: true,
    data: {
      history: history.slice(0, parseInt(limit)),
      count: history.length,
    },
  });
});

// ==========================================
// STATIC MAPS
// ==========================================

/**
 * @desc    Get static map image URL
 * @route   GET /api/v1/locations/static-map
 * @access  Private (User/Captain)
 */
exports.getStaticMap = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, zoom = 15, width = 600, height = 400, markers } =
    req.query;

  if (!latitude || !longitude) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  let url = `${GOOGLE_MAPS_BASE_URL}/staticmap?`;
  url += `center=${latitude},${longitude}`;
  url += `&zoom=${zoom}`;
  url += `&size=${width}x${height}`;
  url += `&maptype=roadmap`;
  url += `&key=${GOOGLE_MAPS_API_KEY}`;

  if (markers) {
    url += `&markers=${markers}`;
  } else {
    url += `&markers=color:red|${latitude},${longitude}`;
  }

  res.status(200).json({
    success: true,
    data: { url },
  });
});

/**
 * @desc    Get static map with route
 * @route   POST /api/v1/locations/route-map
 * @access  Private (User/Captain)
 */
exports.getRouteMap = asyncHandler(async (req, res, next) => {
  const { origin, destination, waypoints = [], width = 600, height = 400 } =
    req.body;

  if (!origin || !destination) {
    throw ApiError.badRequest('Origin and destination are required');
  }

  // Get directions first
  const params = {
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: 'driving',
  };

  if (waypoints.length > 0) {
    params.waypoints = waypoints
      .map((wp) => `${wp.latitude},${wp.longitude}`)
      .join('|');
  }

  const directionsData = await googleMapsRequest('/directions/json', params);

  if (directionsData.status !== 'OK' || !directionsData.routes?.length) {
    throw ApiError.notFound('Could not get route');
  }

  const polyline = directionsData.routes[0].overview_polyline.points;

  // Build static map URL
  let url = `${GOOGLE_MAPS_BASE_URL}/staticmap?`;
  url += `size=${width}x${height}`;
  url += `&maptype=roadmap`;
  url += `&path=enc:${encodeURIComponent(polyline)}`;
  url += `&markers=color:green|label:A|${origin.latitude},${origin.longitude}`;
  url += `&markers=color:red|label:B|${destination.latitude},${destination.longitude}`;
  url += `&key=${GOOGLE_MAPS_API_KEY}`;

  waypoints.forEach((wp, i) => {
    url += `&markers=color:blue|label:${i + 1}|${wp.latitude},${wp.longitude}`;
  });

  const route = directionsData.routes[0].legs[0];

  res.status(200).json({
    success: true,
    data: {
      url,
      polyline,
      distance: route.distance,
      duration: route.duration,
    },
  });
});