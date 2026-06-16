import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearControlPanelUnlock,
  getControlPanelUnlockState,
  setControlPanelUnlocked,
} from "../utils/controlPanelStorage";
import useAuth from "../hooks/useAuth";
import useIsMobile from "../hooks/useIsMobile";
import repoAdminService from "../services/repoAdmin.service";

const ControlPanelContext = createContext(null);

export function ControlPanelProvider({ children }) {
  const { auth } = useAuth();
  const isMobile = useIsMobile();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const requiresMobileGate = isRepoAdmin && isMobile;
  const [unlocked, setUnlocked] = useState(() => getControlPanelUnlockState().unlocked);

  useEffect(() => {
    if (!isRepoAdmin) {
      setUnlocked(false);
      return;
    }
    if (!isMobile) {
      setUnlocked(false);
      return;
    }
    setUnlocked(getControlPanelUnlockState().unlocked);
  }, [isRepoAdmin, isMobile, auth?.token]);

  const unlock = useCallback(() => {
    setControlPanelUnlocked();
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    clearControlPanelUnlock();
    setUnlocked(false);
  }, []);

  const verifyPassword = useCallback(
    async (password) => {
      if (!auth?.token) {
        throw new Error("Not signed in.");
      }
      await repoAdminService.verifyControlPanel(password, auth.token);
      unlock();
    },
    [auth?.token, unlock]
  );

  const isControlPanelUnlocked = !requiresMobileGate || unlocked;

  const value = useMemo(
    () => ({
      isRepoAdmin,
      isMobile,
      requiresMobileGate,
      isControlPanelUnlocked,
      unlock,
      lock,
      verifyPassword,
    }),
    [
      isRepoAdmin,
      isMobile,
      requiresMobileGate,
      isControlPanelUnlocked,
      unlock,
      lock,
      verifyPassword,
    ]
  );

  return (
    <ControlPanelContext.Provider value={value}>
      {children}
    </ControlPanelContext.Provider>
  );
}

export function useControlPanel() {
  return useContext(ControlPanelContext);
}
