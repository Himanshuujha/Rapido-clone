import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Register = () => {
  const { register: registerUser, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });

      // After registration you might want to go to login or home
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">Register to start booking rides</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-row">
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

          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? <Loader size="sm" /> : 'Register'}
          </Button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>{' '}
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;