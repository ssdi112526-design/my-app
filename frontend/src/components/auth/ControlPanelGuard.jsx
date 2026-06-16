import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useControlPanel } from "../../context/ControlPanelContext";
import useIsMobile from "../../hooks/useIsMobile";
import { CONTROL_PANEL_SENSITIVE_PATHS } from "../../utils/controlPanelStorage";

export default function ControlPanelGuard() {
  const isMobile = useIsMobile();
  const { requiresMobileGate, isControlPanelUnlocked } = useControlPanel();
  const location = useLocation();

  const path = location.pathname;
  const isSensitive = CONTROL_PANEL_SENSITIVE_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (isMobile && requiresMobileGate && isSensitive && !isControlPanelUnlocked) {
    return (
      <Navigate
        to="/control-panel"
        replace
      />
    );
  }

  return <Outlet />;
}
