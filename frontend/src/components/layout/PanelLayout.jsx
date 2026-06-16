import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { MobileNavProvider } from "../../contexts/MobileNavContext";
import AppFooter from "./AppFooter";
import "../../styles/layout.css";
import "../../styles/footer.css";

export default function PanelLayout({ brand, sidebar, header }) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const openNav = useCallback(() => setNavOpen(true), []);

  return (
    <MobileNavProvider value={{ closeNav }}>
      <div className={`layout-root${navOpen ? " layout-root--nav-open" : ""}`}>
        <button
          type="button"
          className="layout-nav-backdrop"
          aria-label="Close menu"
          onClick={closeNav}
        />

        <div className="layout-sidebar-shell">{sidebar}</div>

        <div className="layout-main">
          <div className="layout-mobile-bar">
            <button
              type="button"
              className="layout-menu-btn"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={openNav}
            >
              <FiMenu aria-hidden />
            </button>
            <div className="layout-mobile-brand">{brand}</div>
          </div>

          {header}
          <div className="layout-content">
            <Outlet />
          </div>
          <AppFooter />
        </div>
      </div>
    </MobileNavProvider>
  );
}
