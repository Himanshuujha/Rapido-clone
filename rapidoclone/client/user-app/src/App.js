// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Common components
import Navbar from './components/common/Navbar';
import Loader from './components/common/Loader';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BookRide from './pages/BookRide';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';
import ActiveRide from './pages/ActiveRide';
import Wallet from './pages/Wallet';

// Context
import { SocketProvider } from './context/SocketContext';

// Hooks
import useAuth from './hooks/useAuth';

// Optional global styles
// import './assets/styles/index.css';

// ---------- Route Guards ----------

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// ---------- Main App ----------

const App = () => {
  return (
    <SocketProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1">
          <Routes>
            {/* Guest-only routes */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/book-ride"
              element={
                <ProtectedRoute>
                  <BookRide />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rides/active"
              element={
                <ProtectedRoute>
                  <ActiveRide />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rides/history"
              element={
                <ProtectedRoute>
                  <RideHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </SocketProvider>
  );
};

export default App;