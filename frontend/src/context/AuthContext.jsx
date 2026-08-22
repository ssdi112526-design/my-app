import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AUTH_EXPIRED_EVENT,
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  getValidStoredAuth,
  setStoredAuth,
} from "../utils/storage";
import { clearControlPanelUnlock } from "../utils/controlPanelStorage";
import { authService } from "../services/auth.service";

const AuthContext = createContext(null);

const EMPTY_AUTH = {
  user: null,
  token: null,
  isAuthenticated: false,
};

function readPersistedAuth() {
  const saved = getValidStoredAuth();
  if (!saved) return EMPTY_AUTH;
  return {
    user: saved.user,
    token: saved.token,
    isAuthenticated: true,
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readPersistedAuth);
  const [isReady, setIsReady] = useState(true);

  const login = ({ user, token }) => {
    const normalizedUser = {
      ...user,
      id: user?.id || user?._id || null,
    };

    setStoredAuth({ user: normalizedUser, token });

    setAuth({
      user: normalizedUser,
      token,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    clearControlPanelUnlock();
    clearStoredAuth();
    setAuth(EMPTY_AUTH);
  };

  const patchUser = (partial) => {
    setAuth((prev) => {
      if (!prev?.user) return prev;
      const nextUser = {
        ...prev.user,
        ...partial,
        id: partial?.id || partial?._id || prev.user.id || prev.user._id,
      };
      setStoredAuth({ user: nextUser, token: prev.token });
      return { ...prev, user: nextUser };
    });
  };

  useEffect(() => {
    const saved = readPersistedAuth();
    setAuth(saved);
    setIsReady(true);

    if (!saved.token) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const data = await authService.refreshSession(saved.token);
        if (cancelled || !data?.token) return;
        login({
          user: data.user || saved.user,
          token: data.token,
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          logout();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => logout();
    const onStorage = (event) => {
      if (event.key && event.key !== AUTH_STORAGE_KEY) return;
      const saved = getValidStoredAuth();
      if (saved?.token && saved?.user) {
        setAuth({
          user: saved.user,
          token: saved.token,
          isAuthenticated: true,
        });
        return;
      }
      setAuth(EMPTY_AUTH);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      auth,
      isReady,
      isLoading: !isReady,
      isAuthenticated: Boolean(auth?.isAuthenticated),
      user: auth?.user || null,
      login,
      logout,
      setAuth,
      patchUser,
    }),
    [auth, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
