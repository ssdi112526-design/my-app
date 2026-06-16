import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiChevronDown, FiExternalLink, FiMail, FiMenu, FiPhone, FiX } from "react-icons/fi";
import BrandWordmark from "../brand/BrandWordmark";
import { PUBLIC_NAV_LINKS } from "../../constants/publicNavLinks";
import { SUPPORT_EMAIL } from "../../constants/brand";
import { LOGIN_PORTAL_OPTIONS } from "../../constants/loginPortals";
import "../../styles/brand.css";
import "../../styles/publicLogin.css";

export default function PublicLoginHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  const pickPortal = (route) => {
    setMenuOpen(false);
    setNavOpen(false);
    navigate(route);
  };

  const isActive = (to) => location.pathname === to;

  return (
    <header className="public-login-header">
      <div className="public-login-nav">
        <div className="public-login-nav__inner">
          <div className="public-login-nav__left">
            <Link to="/" className="public-login-nav__brand">
              <span className="public-login-nav__logo-icon" aria-hidden>
                FR
              </span>
              <BrandWordmark className="brand-wordmark--on-dark brand-wordmark--header" />
            </Link>

            <nav className="public-login-nav__menu" aria-label="Main">
              {PUBLIC_NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`public-login-nav__link${isActive(item.to) ? " is-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="public-login-nav__actions">
            <a
              href="tel:+919654008400"
              className="public-login-nav__icon public-login-nav__icon--hide-xs"
              aria-label="Phone"
            >
              <FiPhone />
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="public-login-nav__icon public-login-nav__icon--hide-xs"
              aria-label="Email"
            >
              <FiMail />
            </a>

            <div className="public-login-nav__login-wrap" ref={menuRef}>
              <button
                type="button"
                className="public-login-nav__login-btn"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => setMenuOpen((o) => !o)}
              >
                Login
                <FiChevronDown className={menuOpen ? "is-open" : ""} aria-hidden />
              </button>

              {menuOpen && (
                <div className="public-login-dropdown" role="menu">
                  {LOGIN_PORTAL_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="public-login-dropdown__item"
                      role="menuitem"
                      onClick={() => pickPortal(item.route)}
                    >
                      <span className="public-login-dropdown__text">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <FiExternalLink aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="public-login-nav__menu-toggle"
              aria-expanded={navOpen}
              aria-controls="public-mobile-nav"
              aria-label={navOpen ? "Close menu" : "Open menu"}
              onClick={() => setNavOpen((o) => !o)}
            >
              {navOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </div>

      {navOpen && (
        <button
          type="button"
          className="public-login-nav__backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      <nav
        id="public-mobile-nav"
        className={`public-login-nav__drawer${navOpen ? " is-open" : ""}`}
        aria-label="Mobile"
        aria-hidden={!navOpen}
      >
        <div className="public-login-nav__drawer-links">
          {PUBLIC_NAV_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`public-login-nav__drawer-link${isActive(item.to) ? " is-active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="public-login-nav__drawer-contact">
          <a href="tel:+919654008400">
            <FiPhone aria-hidden />
            9654008400
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <FiMail aria-hidden />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </nav>
    </header>
  );
}
