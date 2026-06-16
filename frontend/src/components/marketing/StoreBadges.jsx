import { PLAY_STORE_URL, APP_STORE_URL } from "../../constants/appStores";
import "../../styles/storeBadges.css";

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="store-badge-icon-svg" aria-hidden>
      <path
        fill="#34A853"
        d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.61 3 21.09 3 20.5Z"
      />
      <path
        fill="#FBBC04"
        d="M16.81 15.12 6.05 21.34l8.49-8.49 2.27 2.27Z"
      />
      <path
        fill="#4285F4"
        d="M20.16 10.81c.34.27.59.69.59 1.19s-.22.92-.57 1.2l-2.29 1.32-2.5-2.5 2.5-2.5 2.29 1.32Z"
      />
      <path
        fill="#EA4335"
        d="M6.05 2.66 16.81 8.88 14.54 11.15 6.05 2.66Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return <i className="fa-brands fa-apple store-badge-fa-apple" aria-hidden />;
}

function StoreBadgeButton({ href, label, eyebrow, store, variant }) {
  return (
    <a
      href={href}
      className={`store-badge-btn store-badge-btn--${variant}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      <span className="store-badge-btn__icon" aria-hidden>
        {store === "play" ? <GooglePlayIcon /> : <AppleIcon />}
      </span>
      <span className="store-badge-btn__copy">
        <span className="store-badge-btn__eyebrow">{eyebrow}</span>
        <span className="store-badge-btn__name">
          {store === "play" ? "Google Play" : "App Store"}
        </span>
      </span>
    </a>
  );
}

export default function StoreBadges({
  title = "Download the mobile app",
  variant = "dark",
  className = "",
}) {
  return (
    <div className={`store-badges store-badges--${variant} ${className}`.trim()}>
      {title ? <p className="store-badges__title">{title}</p> : null}
      <div className="store-badges__row">
        <StoreBadgeButton
          href={PLAY_STORE_URL}
          variant={variant}
          store="play"
          eyebrow="GET IT ON"
          label="Get Fast Recovery on Google Play"
        />
        <StoreBadgeButton
          href={APP_STORE_URL}
          variant={variant}
          store="apple"
          eyebrow="Download on the"
          label="Download Fast Recovery on the App Store"
        />
      </div>
    </div>
  );
}
