import { Outlet } from "react-router-dom";
import AppFooter from "./AppFooter";

export default function PublicPageShell() {
  return (
    <div className="public-page-shell">
      <div className="public-page-main">
        <Outlet />
      </div>
      <AppFooter />
    </div>
  );
}
