import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import API, { TOKEN_KEY } from '../services/api.js';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    API.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => window.localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(credentials) {
        const { data } = await API.post('/auth/login', credentials);
        window.localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        return data.user;
      },
      async register(details) {
        const { data } = await API.post('/auth/register', details);
        window.localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        window.localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
