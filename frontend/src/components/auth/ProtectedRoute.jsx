import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import AuthBootScreen from "./AuthBootScreen";

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { auth, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <AuthBootScreen />;
  }

  if (!auth?.isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(auth?.user?.role)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
