import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import { sanitizeChassisInput } from "../../../utils/vehicleNumberUtils";
import {
  resolveActiveSearch,
  sanitizeVehicleOrPhoneInput,
  CHASSIS_SEARCH_MAX_CHARS,
} from "./findVehiclesHelpers";
import { repoCaseService } from "../../../services/repoCase.service";
import VehicleChassisSearchBar from "./VehicleChassisSearchBar";
import "../../../styles/vehicles.css";

export default function FindVehicles() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [draftVehicle, setDraftVehicle] = useState("");
  const [draftChassis, setDraftChassis] = useState("");
  const [lastInteraction, setLastInteraction] = useState("vehicle");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    repoCaseService.warmSearchCache(auth.token).catch(() => {});
  }, [auth?.token]);

  useEffect(() => {
    const resolved = resolveActiveSearch(draftVehicle, draftChassis, lastInteraction);
    if (!resolved) return undefined;
    const timer = setTimeout(() => {
      const t =
        resolved.mode === "chassis"
          ? "chassis"
          : resolved.mode === "phone"
            ? "phone"
            : "vehicle";
      navigate(
        `/find-vehicles/results?q=${encodeURIComponent(resolved.normalized)}&type=${t}`,
        { replace: true }
      );
    }, 320);
    return () => clearTimeout(timer);
  }, [draftVehicle, draftChassis, lastInteraction, navigate]);

  return (
    <div className="find-vehicles-page fv-find-home-layout">
      <div className="fv-header fv-desktop-only">
        <h1>Find Vehicles</h1>
      </div>

      <div className="fv-search-card fv-mobile-search-shell">
        <VehicleChassisSearchBar
          draftVehicle={draftVehicle}
          draftChassis={draftChassis}
          onVehicleChange={(value) => {
            setFormError("");
            setLastInteraction("vehicle");
            setDraftVehicle(sanitizeVehicleOrPhoneInput(value));
          }}
          onChassisChange={(value) => {
            setFormError("");
            setLastInteraction("chassis");
            setDraftChassis(sanitizeChassisInput(value, CHASSIS_SEARCH_MAX_CHARS));
          }}
          onVehicleFocus={() => setLastInteraction("vehicle")}
          onChassisFocus={() => setLastInteraction("chassis")}
          onClearVehicle={() => {
            setDraftVehicle("");
            setFormError("");
          }}
          onClearChassis={() => {
            setDraftChassis("");
            setFormError("");
          }}
        />

        {formError && <p className="fv-error">{formError}</p>}
      </div>
    </div>
  );
}
