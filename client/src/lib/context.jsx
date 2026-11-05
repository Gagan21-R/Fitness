import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

/* ---------- Auth ---------- */
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    queryClient.clear();
    // The next person to sign in starts at the dashboard, not on the last person's page.
    navigate('/', { replace: true });
  }, [queryClient, navigate]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [signOut]);

  const accept = useCallback(({ token, user: next }) => {
    setToken(token);
    setUser(next);
  }, []);

  const value = useMemo(() => ({ user, loading, accept, signOut }), [user, loading, accept, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------- Theme ---------- */
// v2: the maximalist redesign starts everyone on its light theme once.
const THEME_KEY = 'fc_theme_v2';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return saved;
    } catch {
      // Fall through to the default.
    }
    return 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme just won't be remembered.
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const push = useCallback((message, kind = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
