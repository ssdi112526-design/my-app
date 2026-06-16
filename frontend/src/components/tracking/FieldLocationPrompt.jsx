import { useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { fieldTrackingService } from "../../services/fieldTracking.service";
import { shouldPromptForLocation } from "../../utils/fieldTrackingPermissions";
import LocationPermissionModal from "./LocationPermissionModal";
import {
  isLocationPermissionDismissed,
  isLocationPermissionGranted,
  markLocationPermissionDismissed,
  markLocationPermissionGranted,
} from "../../constants/locationPermission";

const PROMPT_DESCRIPTION =
  "Allow location access so your repo admin and team leader can see your position on the field map while you use the app.";

export default function FieldLocationPrompt() {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const shouldPrompt = shouldPromptForLocation(role);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shouldPrompt || !auth?.token) {
      setOpen(false);
      return undefined;
    }

    if (isLocationPermissionGranted() || isLocationPermissionDismissed()) {
      return undefined;
    }

    let cancelled = false;

    const showPrompt = () => {
      if (!cancelled) setOpen(true);
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "granted") {
            markLocationPermissionGranted();
            return;
          }
          showPrompt();
        })
        .catch(showPrompt);
    } else {
      showPrompt();
    }

    return () => {
      cancelled = true;
    };
  }, [shouldPrompt, auth?.token]);

  const handleAllow = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          await fieldTrackingService.postMyLocation(
            { latitude, longitude, accuracy },
            auth.token
          );
          markLocationPermissionGranted();
          window.dispatchEvent(new CustomEvent("repo:location-granted"));
          setOpen(false);
        } catch (err) {
          setError(
            err?.response?.data?.message ||
              "Could not save your location. Check your connection and try again."
          );
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError(
          "Location blocked. Enable location in your browser or phone settings, then tap Allow location again."
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleDismiss = () => {
    markLocationPermissionDismissed();
    setOpen(false);
    setError("");
  };

  if (!shouldPrompt) return null;

  return (
    <LocationPermissionModal
      open={open}
      onAllow={handleAllow}
      onDismiss={handleDismiss}
      busy={busy}
      error={error}
      description={PROMPT_DESCRIPTION}
    />
  );
}
