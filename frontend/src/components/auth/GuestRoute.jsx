import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { landingPathForRole } from "../../utils/navReturn";
import AuthBootScreen from "./AuthBootScreen";

export default function GuestRoute() {
  const { auth, isReady } = useAuth();

  if (!isReady) {
    return <AuthBootScreen />;
  }

  if (auth?.isAuthenticated) {
    return <Navigate to={landingPathForRole(auth?.user?.role)} replace />;
  }

  return <Outlet />;
}
