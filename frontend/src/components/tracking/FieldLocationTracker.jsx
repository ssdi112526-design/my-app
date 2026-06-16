import { useEffect, useRef } from "react";
import useAuth from "../../hooks/useAuth";
import { fieldTrackingService } from "../../services/fieldTracking.service";
import { shouldShareLiveLocation } from "../../utils/fieldTrackingPermissions";
import {
  isLocationPermissionGranted,
  markLocationPermissionGranted,
} from "../../constants/locationPermission";

const MIN_POST_INTERVAL_MS = 45_000;

/**
 * While the app is open, sends GPS to the server for admin / team leader maps.
 * Starts after the user has allowed location (modal or browser already granted).
 */
export default function FieldLocationTracker() {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const watchIdRef = useRef(null);
  const lastPostRef = useRef(0);
  const postingRef = useRef(false);

  useEffect(() => {
    if (!shouldShareLiveLocation(role) || !auth?.token) {
      return undefined;
    }

    if (!navigator.geolocation) {
      return undefined;
    }

    const postPosition = async (position) => {
      const now = Date.now();
      if (postingRef.current || now - lastPostRef.current < MIN_POST_INTERVAL_MS) {
        return;
      }
      postingRef.current = true;
      try {
        const { latitude, longitude, accuracy } = position.coords;
        await fieldTrackingService.postMyLocation(
          { latitude, longitude, accuracy },
          auth.token
        );
        lastPostRef.current = Date.now();
        markLocationPermissionGranted();
      } catch {
        /* network / auth — retry on next tick */
      } finally {
        postingRef.current = false;
      }
    };

    const onPosition = (position) => {
      postPosition(position);
    };

    const onError = () => {
      /* keep watching; user may fix settings */
    };

    const startWatch = () => {
      if (watchIdRef.current != null) return;
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPosition,
        onError,
        {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 20_000,
        }
      );
    };

    const stopWatch = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const tryStart = () => {
      if (document.visibilityState === "hidden") {
        stopWatch();
        return;
      }

      if (isLocationPermissionGranted()) {
        startWatch();
        navigator.geolocation.getCurrentPosition(onPosition, onError, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
        return;
      }

      if (!navigator.permissions?.query) {
        return;
      }

      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "granted") {
            markLocationPermissionGranted();
            startWatch();
            navigator.geolocation.getCurrentPosition(onPosition, onError, {
              enableHighAccuracy: true,
              timeout: 15_000,
              maximumAge: 0,
            });
          }
        })
        .catch(() => {});
    };

    tryStart();
    document.addEventListener("visibilitychange", tryStart);
    window.addEventListener("repo:location-granted", tryStart);

    return () => {
      document.removeEventListener("visibilitychange", tryStart);
      window.removeEventListener("repo:location-granted", tryStart);
      stopWatch();
    };
  }, [auth?.token, role]);

  return null;
}
