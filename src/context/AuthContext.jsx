import { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken, clearAccessToken, refreshTokens } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On boot, try to restore the session by refreshing the access token.
  useEffect(() => {
    refreshTokens()
      .then((data) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Exchange email/password for an access token and store the user in memory.
  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  // Invalidate the server session, clear the local user, and return to login.
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
      setUser(null);
      navigate('/login');
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}