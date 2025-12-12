// src/hooks/useAuth.js
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import {
  setCredentials,
  clearAuth,
  setAuthLoading,
  setAuthError,
  setUser as setUserAction,
} from '../redux/slices/authSlice';

/**
 * Assumes authSlice state shape:
 * {
 *   user: null | {...},
 *   token: string | null,
 *   loading: boolean,
 *   error: string | null
 * }
 */
const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, loading, error } = useSelector((state) => state.auth);

  const isAuthenticated = Boolean(token);

  const login = useCallback(
    async ({ emailOrPhone, password }) => {
      try {
        dispatch(setAuthLoading(true));
        dispatch(setAuthError(null));

        // Backend: POST /api/v1/auth/user/login
        const res = await api.post('/auth/user/login', {
          emailOrPhone,
          password,
        });

        const data = res.data?.data || res.data;
        // Expect data: { user, accessToken }
        dispatch(
          setCredentials({
            user: data.user,
            token: data.accessToken || data.token,
          })
        );

        // Persist to localStorage if you want
        if (data.accessToken || data.token) {
          localStorage.setItem(
            'auth',
            JSON.stringify({
              user: data.user,
              token: data.accessToken || data.token,
            })
          );
        }

        return data;
      } catch (err) {
        const message =
          err?.response?.data?.message || 'Failed to login. Please try again.';
        dispatch(setAuthError(message));
        throw err;
      } finally {
        dispatch(setAuthLoading(false));
      }
    },
    [dispatch]
  );

  const register = useCallback(
    async ({ firstName, lastName, email, phone, password }) => {
      try {
        dispatch(setAuthLoading(true));
        dispatch(setAuthError(null));

        // Backend: POST /api/v1/auth/user/register
        const res = await api.post('/auth/user/register', {
          firstName,
          lastName,
          email,
          phone,
          password,
        });

        const data = res.data?.data || res.data;
        // After registration, you may:
        // - auto-login with returned token
        // - or redirect to login page (current pages do redirect to /login)

        return data;
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          'Failed to register. Please check your details.';
        dispatch(setAuthError(message));
        throw err;
      } finally {
        dispatch(setAuthLoading(false));
      }
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    try {
      // Optional backend call: POST /api/v1/auth/user/logout
      try {
        await api.post('/auth/user/logout');
      } catch (e) {
        // ignore network/logout errors
      }

      localStorage.removeItem('auth');
      dispatch(clearAuth());
    } catch (err) {
      console.error('Logout error:', err);
      dispatch(clearAuth());
    }
  }, [dispatch]);

  const setUser = useCallback(
    (updatedUser) => {
      dispatch(setUserAction(updatedUser));

      const stored = localStorage.getItem('auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          'auth',
          JSON.stringify({ ...parsed, user: updatedUser })
        );
      }
    },
    [dispatch]
  );

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    setUser,
  };
};

export default useAuth;