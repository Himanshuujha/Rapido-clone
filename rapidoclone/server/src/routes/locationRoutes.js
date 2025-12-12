// src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { protect, protectCaptain, protectBoth } = require('../middlewares/auth');

// ==========================================
// GEOCODING & PLACES
// ==========================================

/**
 * @route   GET /api/v1/locations/autocomplete
 * @desc    Search places with autocomplete
 * @access  Private (User/Captain)
 * @query   { input, latitude?, longitude?, radius?, types? }
 */
router.get('/autocomplete', protectBoth, locationController.autocomplete);

/**
 * @route   GET /api/v1/locations/geocode
 * @desc    Get coordinates from address
 * @access  Private (User/Captain)
 * @query   { address }
 */
router.get('/geocode', protectBoth, locationController.geocode);

/**
 * @route   GET /api/v1/locations/reverse-geocode
 * @desc    Get address from coordinates
 * @access  Private (User/Captain)
 * @query   { latitude, longitude }
 */
router.get('/reverse-geocode', protectBoth, locationController.reverseGeocode);

/**
 * @route   GET /api/v1/locations/place-details/:placeId
 * @desc    Get place details by place ID
 * @access  Private (User/Captain)
 */
router.get('/place-details/:placeId', protectBoth, locationController.getPlaceDetails);

/**
 * @route   POST /api/v1/locations/validate
 * @desc    Validate a location (check if serviceable)
 * @access  Private (User)
 * @body    { latitude, longitude }
 */
router.post('/validate', protect, locationController.validateLocation);

// ==========================================
// DIRECTIONS & DISTANCE
// ==========================================

/**
 * @route   GET /api/v1/locations/directions
 * @desc    Get directions between two points
 * @access  Private (User/Captain)
 * @query   { originLat, originLng, destLat, destLng, mode? }
 */
router.get('/directions', protectBoth, locationController.getDirections);

/**
 * @route   POST /api/v1/locations/directions
 * @desc    Get directions with waypoints
 * @access  Private (User/Captain)
 * @body    { origin, destination, waypoints?, mode? }
 */
router.post('/directions', protectBoth, locationController.getDirectionsWithWaypoints);

/**
 * @route   GET /api/v1/locations/distance
 * @desc    Get distance and duration between points
 * @access  Private (User/Captain)
 * @query   { originLat, originLng, destLat, destLng }
 */
router.get('/distance', protectBoth, locationController.getDistance);

/**
 * @route   POST /api/v1/locations/distance-matrix
 * @desc    Get distance matrix for multiple origins/destinations
 * @access  Private (User/Captain)
 * @body    { origins: [], destinations: [] }
 */
router.post('/distance-matrix', protectBoth, locationController.getDistanceMatrix);

/**
 * @route   GET /api/v1/locations/eta
 * @desc    Get estimated time of arrival
 * @access  Private (User/Captain)
 * @query   { originLat, originLng, destLat, destLng, departureTime? }
 */
router.get('/eta', protectBoth, locationController.getETA);

// ==========================================
// NEARBY PLACES & CAPTAINS
// ==========================================

/**
 * @route   GET /api/v1/locations/nearby
 * @desc    Get nearby places by type
 * @access  Private (User/Captain)
 * @query   { latitude, longitude, type, radius?, limit? }
 */
router.get('/nearby', protectBoth, locationController.getNearbyPlaces);

/**
 * @route   GET /api/v1/locations/nearby-captains
 * @desc    Get nearby available captains
 * @access  Private (User)
 * @query   { latitude, longitude, vehicleType?, radius? }
 */
router.get('/nearby-captains', protect, locationController.getNearbyCaptains);

/**
 * @route   GET /api/v1/locations/captain-eta
 * @desc    Get ETA for nearest captain
 * @access  Private (User)
 * @query   { latitude, longitude, vehicleType? }
 */
router.get('/captain-eta', protect, locationController.getCaptainETA);

// ==========================================
// POPULAR & RECENT LOCATIONS
// ==========================================

/**
 * @route   GET /api/v1/locations/popular
 * @desc    Get popular locations in city
 * @access  Private (User)
 * @query   { latitude, longitude, city?, limit? }
 */
router.get('/popular', protect, locationController.getPopularLocations);

/**
 * @route   GET /api/v1/locations/recent
 * @desc    Get user's recent locations
 * @access  Private (User)
 * @query   { limit? }
 */
router.get('/recent', protect, locationController.getRecentLocations);

/**
 * @route   DELETE /api/v1/locations/recent
 * @desc    Clear recent locations
 * @access  Private (User)
 */
router.delete('/recent', protect, locationController.clearRecentLocations);

/**
 * @route   DELETE /api/v1/locations/recent/:locationId
 * @desc    Remove a recent location
 * @access  Private (User)
 */
router.delete('/recent/:locationId', protect, locationController.removeRecentLocation);

// ==========================================
// SAVED LOCATIONS
// ==========================================

/**
 * @route   GET /api/v1/locations/saved
 * @desc    Get user's saved locations
 * @access  Private (User)
 */
router.get('/saved', protect, locationController.getSavedLocations);

/**
 * @route   POST /api/v1/locations/saved
 * @desc    Save a location
 * @access  Private (User)
 * @body    { label, type, name, address, latitude, longitude, placeId? }
 */
router.post('/saved', protect, locationController.saveLocation);

/**
 * @route   GET /api/v1/locations/saved/:locationId
 * @desc    Get saved location details
 * @access  Private (User)
 */
router.get('/saved/:locationId', protect, locationController.getSavedLocationById);

/**
 * @route   PUT /api/v1/locations/saved/:locationId
 * @desc    Update saved location
 * @access  Private (User)
 * @body    { label?, type?, name?, address?, latitude?, longitude? }
 */
router.put('/saved/:locationId', protect, locationController.updateSavedLocation);

/**
 * @route   DELETE /api/v1/locations/saved/:locationId
 * @desc    Delete saved location
 * @access  Private (User)
 */
router.delete('/saved/:locationId', protect, locationController.deleteSavedLocation);

/**
 * @route   GET /api/v1/locations/saved/home
 * @desc    Get home location
 * @access  Private (User)
 */
router.get('/saved/home', protect, locationController.getHomeLocation);

/**
 * @route   PUT /api/v1/locations/saved/home
 * @desc    Set/update home location
 * @access  Private (User)
 * @body    { name, address, latitude, longitude }
 */
router.put('/saved/home', protect, locationController.setHomeLocation);

/**
 * @route   GET /api/v1/locations/saved/work
 * @desc    Get work location
 * @access  Private (User)
 */
router.get('/saved/work', protect, locationController.getWorkLocation);

/**
 * @route   PUT /api/v1/locations/saved/work
 * @desc    Set/update work location
 * @access  Private (User)
 * @body    { name, address, latitude, longitude }
 */
router.put('/saved/work', protect, locationController.setWorkLocation);

// ==========================================
// SERVICE AREAS & ZONES
// ==========================================

/**
 * @route   GET /api/v1/locations/zones
 * @desc    Get all service zones
 * @access  Private (User/Captain)
 * @query   { latitude?, longitude? }
 */
router.get('/zones', protectBoth, locationController.getZones);

/**
 * @route   GET /api/v1/locations/zones/:zoneId
 * @desc    Get zone details
 * @access  Private (User/Captain)
 */
router.get('/zones/:zoneId', protectBoth, locationController.getZoneDetails);

/**
 * @route   GET /api/v1/locations/check-serviceability
 * @desc    Check if location is serviceable
 * @access  Private (User)
 * @query   { latitude, longitude }
 */
router.get('/check-serviceability', protect, locationController.checkServiceability);

/**
 * @route   POST /api/v1/locations/check-route-serviceability
 * @desc    Check if route is serviceable
 * @access  Private (User)
 * @body    { pickup: { lat, lng }, destination: { lat, lng } }
 */
router.post('/check-route-serviceability', protect, locationController.checkRouteServiceability);

/**
 * @route   GET /api/v1/locations/surge-zones
 * @desc    Get surge pricing zones
 * @access  Private (User/Captain)
 * @query   { latitude, longitude, radius? }
 */
router.get('/surge-zones', protectBoth, locationController.getSurgeZones);

/**
 * @route   GET /api/v1/locations/surge-multiplier
 * @desc    Get surge multiplier for location
 * @access  Private (User)
 * @query   { latitude, longitude, vehicleType? }
 */
router.get('/surge-multiplier', protect, locationController.getSurgeMultiplier);

// ==========================================
// CITIES & REGIONS
// ==========================================

/**
 * @route   GET /api/v1/locations/cities
 * @desc    Get list of serviceable cities
 * @access  Public
 */
router.get('/cities', locationController.getCities);

/**
 * @route   GET /api/v1/locations/cities/:cityId
 * @desc    Get city details
 * @access  Public
 */
router.get('/cities/:cityId', locationController.getCityDetails);

/**
 * @route   GET /api/v1/locations/city-info
 * @desc    Get city info by coordinates
 * @access  Private (User/Captain)
 * @query   { latitude, longitude }
 */
router.get('/city-info', protectBoth, locationController.getCityInfo);

/**
 * @route   GET /api/v1/locations/airports
 * @desc    Get airports in city
 * @access  Private (User)
 * @query   { city?, latitude?, longitude? }
 */
router.get('/airports', protect, locationController.getAirports);

/**
 * @route   GET /api/v1/locations/railway-stations
 * @desc    Get railway stations in city
 * @access  Private (User)
 * @query   { city?, latitude?, longitude? }
 */
router.get('/railway-stations', protect, locationController.getRailwayStations);

// ==========================================
// RIDE TRACKING
// ==========================================

/**
 * @route   GET /api/v1/locations/track/:rideId
 * @desc    Get real-time ride tracking info
 * @access  Private (User)
 */
router.get('/track/:rideId', protect, locationController.getRideTracking);

/**
 * @route   POST /api/v1/locations/share/:rideId
 * @desc    Generate shareable tracking link
 * @access  Private (User)
 * @body    { expiresIn? }
 */
router.post('/share/:rideId', protect, locationController.generateTrackingLink);

/**
 * @route   GET /api/v1/locations/share/:shareToken
 * @desc    Get tracking info via share token
 * @access  Public
 */
router.get('/share/:shareToken', locationController.getSharedTracking);

/**
 * @route   DELETE /api/v1/locations/share/:rideId
 * @desc    Revoke tracking link
 * @access  Private (User)
 */
router.delete('/share/:rideId', protect, locationController.revokeTrackingLink);

// ==========================================
// CAPTAIN LOCATION
// ==========================================

/**
 * @route   PUT /api/v1/locations/captain/update
 * @desc    Update captain current location
 * @access  Private (Captain)
 * @body    { latitude, longitude, heading?, speed?, accuracy? }
 */
router.put('/captain/update', protectCaptain, locationController.updateCaptainLocation);

/**
 * @route   GET /api/v1/locations/captain/history
 * @desc    Get captain location history
 * @access  Private (Captain)
 * @query   { startDate, endDate, rideId? }
 */
router.get('/captain/history', protectCaptain, locationController.getCaptainLocationHistory);

// ==========================================
// STATIC MAPS
// ==========================================

/**
 * @route   GET /api/v1/locations/static-map
 * @desc    Get static map image URL
 * @access  Private (User/Captain)
 * @query   { latitude, longitude, zoom?, width?, height?, markers? }
 */
router.get('/static-map', protectBoth, locationController.getStaticMap);

/**
 * @route   POST /api/v1/locations/route-map
 * @desc    Get static map with route
 * @access  Private (User/Captain)
 * @body    { origin, destination, waypoints?, width?, height? }
 */
router.post('/route-map', protectBoth, locationController.getRouteMap);

module.exports = router;