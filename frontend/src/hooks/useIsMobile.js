import { useEffect, useState } from "react";

/** Phone-sized layout — not used for desktop/laptop browsers */
const NARROW_MQ = "(max-width: 767px)";

function isPhoneUserAgent() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (ua.includes("Android") && !ua.includes("Mobile"));
  if (isTablet) return false;
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function isDesktopBrowser() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)")
    .matches;
}

/** True on phones / narrow mobile layout; false on desktop & laptop web */
export function getIsMobileViewport() {
  if (typeof window === "undefined") return false;

  if (isDesktopBrowser() && !isPhoneUserAgent()) {
    return false;
  }

  if (isPhoneUserAgent()) {
    return true;
  }

  return window.matchMedia(NARROW_MQ).matches;
}

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);

  useEffect(() => {
    const sync = () => setIsMobile(getIsMobileViewport());
    sync();

    const mq = window.matchMedia(NARROW_MQ);
    const mqDesktop = window.matchMedia(
      "(min-width: 768px) and (hover: hover) and (pointer: fine)"
    );

    mq.addEventListener("change", sync);
    mqDesktop.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    return () => {
      mq.removeEventListener("change", sync);
      mqDesktop.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return isMobile;
}
