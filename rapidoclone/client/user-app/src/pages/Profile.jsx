import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';
import api from '../services/api';

const Profile = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const savedLocations = [
    { id: 1, icon: '🏠', label: 'Home', address: user?.savedLocations?.[0]?.address || 'Add home address' },
    { id: 2, icon: '💼', label: 'Work', address: user?.savedLocations?.[1]?.address || 'Add work address' },
  ];

  const emergencyContacts = user?.emergencyContacts || [];

  const menuItems = [
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
      ),
      label: 'Saved Locations',
      path: '/saved-locations',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      label: 'Emergency Contacts',
      path: '/emergency-contacts',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      label: 'Payment Methods',
      path: '/payment-methods',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      label: 'Notifications',
      path: '/notifications-settings',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      label: 'Privacy & Security',
      path: '/privacy',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Help & Support',
      path: '/help',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'About',
      path: '/about',
    },
  ];

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const res = await api.put('/users/profile', form);
      const updatedUser = res.data?.data || res.data;

      setUser(updatedUser);
      setMessage('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="h-6 w-6 text-gray-600"
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
              <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 font-medium text-sm hover:text-blue-700"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-600 font-medium text-sm hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
                {user.firstName?.[0]?.toUpperCase()}
              </div>
              {isEditing && (
                <button className="absolute bottom-0 right-0 h-8 w-8 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200">
                  <svg
                    className="h-4 w-4 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-500">{user.email}</p>
              <p className="text-sm text-gray-400">{user.phone}</p>
            </div>
          </div>

          {/* Ratings */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {user.ratings?.average || 5.0}
              </p>
              <p className="text-xs text-gray-500">Rating</p>
            </div>
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {user.ratings?.count || 0}
              </p>
              <p className="text-xs text-gray-500">Rides</p>
            </div>
            <div className="bg-gray-50 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900">
                {new Date(user.createdAt).getFullYear()}
              </p>
              <p className="text-xs text-gray-500">Member since</p>
            </div>
          </div>
        </section>

        {/* Edit Form */}
        {isEditing && (
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Profile
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                />
              </div>
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
              <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
              />

              {message && (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button onClick={handleSave} disabled={saving} fullWidth>
                {saving ? <Loader size="sm" /> : 'Save Changes'}
              </Button>
            </div>
          </section>
        )}

        {/* Saved Locations */}
        <section className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Saved Locations</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {savedLocations.map((loc) => (
              <button
                key={loc.id}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-2xl">{loc.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{loc.label}</p>
                  <p className="text-sm text-gray-500 truncate">{loc.address}</p>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
            <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left text-blue-600">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="font-medium">Add new location</span>
            </button>
          </div>
        </section>

        {/* Menu Items */}
        <section className="bg-white rounded-xl shadow-sm">
          <div className="divide-y divide-gray-100">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.path}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  {item.icon}
                </div>
                <span className="flex-1 font-medium text-gray-900">
                  {item.label}
                </span>
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* Logout */}
        <section className="bg-white rounded-xl shadow-sm">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 transition-colors text-red-600"
          >
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <span className="font-medium">Logout</span>
          </button>
        </section>

        {/* Version */}
        <p className="text-center text-sm text-gray-400 py-4">
          Version 1.0.0
        </p>
      </main>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout"
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Logout
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to logout from your account?
        </p>
      </Modal>
    </div>
  );
};

export default Profile;