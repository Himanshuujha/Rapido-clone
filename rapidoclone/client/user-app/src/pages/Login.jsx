import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Login = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    emailOrPhone: '',
    password: '',
  });

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await login({
        emailOrPhone: form.emailOrPhone,
        password: form.password,
      });
      navigate(from, { replace: true });
    } catch (err) {
      // useAuth should expose readable error; we just let it handle state
      console.error(err);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2 className="auth-title">Login</h2>
        <p className="auth-subtitle">Sign in to continue booking rides</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="Email or Phone"
            name="emailOrPhone"
            value={form.emailOrPhone}
            onChange={handleChange}
            placeholder="Enter your email or phone"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? <Loader size="sm" /> : 'Login'}
          </Button>
        </form>

        <div className="auth-footer">
          <span>Don&apos;t have an account?</span>{' '}
          <Link to="/register" className="auth-link">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;