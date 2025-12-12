// src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // keep cookies if you use them
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to safely get token from localStorage
const getTokenFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch (e) {
    console.error('Error reading token from localStorage', e);
    return null;
  }
};

// Request interceptor – attach Authorization header
api.interceptors.request.use(
  (config) => {
    const token = getTokenFromStorage();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: response interceptor (you can customize error handling here)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can centralize error logging here if you want
    // const status = error?.response?.status;
    // if (status === 401) { ... }
    return Promise.reject(error);
  }
);

export default api;