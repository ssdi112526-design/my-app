import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
} from "../utils/storage";
import { clearControlPanelUnlock } from "../utils/controlPanelStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    token: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    const saved = getStoredAuth();

    if (saved?.token && saved?.user) {
      setAuth({
        user: saved.user,
        token: saved.token,
        isAuthenticated: true,
      });
    }
  }, []);

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
    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
    });
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

  const value = useMemo(
    () => ({
      auth,
      login,
      logout,
      setAuth,
      patchUser,
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}