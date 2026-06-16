/** Mobile app store URLs — set REACT_APP_PLAY_STORE_URL / REACT_APP_APP_STORE_URL in .env */
export const PLAY_STORE_URL =
  process.env.REACT_APP_PLAY_STORE_URL ||
  "https://play.google.com/store/apps/details?id=in.fastrecovery.app";

export const APP_STORE_URL =
  process.env.REACT_APP_APP_STORE_URL ||
  "https://apps.apple.com/app/fast-recovery/id000000000";
