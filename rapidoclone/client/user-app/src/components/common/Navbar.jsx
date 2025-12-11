import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Button from './Button';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium ${
      isActive ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
    }`;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <span className="text-lg font-bold text-blue-600">
                Rapido Clone
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isAuthenticated && (
              <>
                <NavLink to="/" className={navLinkClass} end>
                  Home
                </NavLink>
                <NavLink to="/book-ride" className={navLinkClass}>
                  Book Ride
                </NavLink>
                <NavLink to="/rides/history" className={navLinkClass}>
                  Rides
                </NavLink>
                <NavLink to="/wallet" className={navLinkClass}>
                  Wallet
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  Profile
                </NavLink>
              </>
            )}
          </div>

          {/* Right: Auth controls */}
          <div className="hidden md:flex md:items-center md:space-x-3">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                    {(user?.firstName?.[0] || 'U').toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700">
                    {user?.firstName}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                >
                  Register
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="sr-only">Open main menu</span>
              {open ? (
                <span className="text-xl">✕</span>
              ) : (
                <span className="text-xl">☰</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="space-y-1 px-2 pt-2 pb-3">
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/"
                  end
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Home
                </NavLink>
                <NavLink
                  to="/book-ride"
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Book Ride
                </NavLink>
                <NavLink
                  to="/rides/history"
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Rides
                </NavLink>
                <NavLink
                  to="/wallet"
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Wallet
                </NavLink>
                <NavLink
                  to="/profile"
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Profile
                </NavLink>

                <button
                  type="button"
                  className="mt-2 w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setOpen(false);
                    navigate('/login');
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setOpen(false);
                    navigate('/register');
                  }}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;