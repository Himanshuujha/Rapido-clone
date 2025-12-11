import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import api from '../services/api';

const Profile = () => {
  const { user, setUser } = useAuth(); // assume useAuth exposes setUser or refreshUser
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="page profile-page">
        <header className="page-header">
          <h1>Profile</h1>
        </header>
        <section className="page-content">
          <p>Loading user...</p>
        </section>
      </div>
    };
  }

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      // Adjust URL to match your backend (e.g. /api/v1/users/profile)
      const res = await api.put('/users/profile', form);
      const updatedUser = res.data?.data || res.data;

      if (setUser) {
        setUser(updatedUser);
      }

      setMessage('Profile updated successfully');
    } catch (err) {
      console.error(err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page profile-page">
      <header className="page-header">
        <h1>Profile</h1>
        <p>Manage your personal information.</p>
      </header>

      <section className="page-content">
        <form className="profile-form" onSubmit={handleSave}>
          <div className="profile-avatar-section">
            <div className="avatar-placeholder">
              {user.firstName?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3>
                {user.firstName} {user.lastName}
              </h3>
              <p>{user.email}</p>
            </div>
          </div>

          <div className="profile-fields">
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
          </div>

          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? <Loader size="sm" /> : 'Save Changes'}
          </Button>
        </form>
      </section>
    </div>
  );
};

export default Profile;