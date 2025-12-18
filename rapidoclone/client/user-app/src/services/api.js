// src/services/api.js
import axios from 'axios';
import { store } from '../redux/store';
import { clearAuth } from '../redux/slices/authSlice';

const getApiBaseUrl = () => {
  // 1. Check environment variable first (highest priority)
  if (process.env.REACT_APP_API_URL) {
    console.log('Using env API URL:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // 2. For GitHub Codespaces - auto-detect and replace port
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // GitHub Codespaces pattern: {name}-{port}.app.github.dev
    if (hostname.includes('.app.github.dev')) {
      // Replace any port with 5000
      const backendHostname = hostname.replace(/-\d+\.app\.github\.dev$/, '-5000.app.github.dev');
      const apiUrl = `https://${backendHostname}/api/v1`;
      console.log('Codespaces API URL:', apiUrl);
      return apiUrl;
    }
    
    // Gitpod pattern
    if (hostname.includes('.gitpod.io')) {
      const backendHostname = hostname.replace(/\d+/, '5000');
      return `https://${backendHostname}/api/v1`;
    }
  }
  
  // 3. Default for local development
  return 'https://sturdy-guide-4jgj6wgwp6x92j6p4-5000.app.github.dev/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ... rest of your interceptors (they look good)

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

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getTokenFromStorage();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug log for requests
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const { token } = refreshResponse.data;
        
        if (token) {
          const authData = JSON.parse(localStorage.getItem('auth') || '{}');
          authData.token = token;
          localStorage.setItem('auth', JSON.stringify(authData));
          
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        store.dispatch(clearAuth());
        
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
