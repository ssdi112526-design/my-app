import { FiX } from "react-icons/fi";
import {
  CHASSIS_SEARCH_MAX_CHARS,
  PHONE_SEARCH_MAX_CHARS,
} from "./findVehiclesHelpers";

/**
 * Unified vehicle + chassis search bar (mobile + desktop).
 * Vehicle field uses tel/numeric hints so Android opens a number keypad.
 */
export default function VehicleChassisSearchBar({
  draftVehicle,
  draftChassis,
  onVehicleChange,
  onChassisChange,
  onVehicleFocus,
  onChassisFocus,
  onClearVehicle,
  onClearChassis,
  vehiclePlaceholder = "Vehicle or mobile (10 digits)",
  chassisPlaceholder = "Chassis (min 4 chars)",
}) {
  return (
    <div className="fv-results-search-form fv-unified-search-bar" role="search">
      <div className="fv-results-search-unified">
        <div className="fv-results-search-half fv-results-search-half--vehicle">
          <span className="fv-results-search-inline-label" id="fv-lbl-v">
            Vehicle / mobile
          </span>
          <div className="fv-results-search-input-wrap">
            <input
              type="tel"
              inputMode="numeric"
              data-search-field="vehicle"
              aria-labelledby="fv-lbl-v"
              value={draftVehicle}
              onChange={(e) => onVehicleChange(e.target.value)}
              onFocus={onVehicleFocus}
              placeholder={vehiclePlaceholder}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={PHONE_SEARCH_MAX_CHARS}
            />
            {draftVehicle.length > 0 && (
              <button
                type="button"
                className="fv-search-clear fv-results-search-clear"
                onClick={onClearVehicle}
                aria-label="Clear vehicle number"
              >
                <FiX aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="fv-results-search-divider" aria-hidden />
        <div className="fv-results-search-half fv-results-search-half--chassis">
          <span className="fv-results-search-inline-label" id="fv-lbl-c">
            Chassis number
          </span>
          <div className="fv-results-search-input-wrap">
            <input
              type="tel"
              inputMode="numeric"
              data-search-field="chassis"
              aria-labelledby="fv-lbl-c"
              value={draftChassis}
              onChange={(e) => onChassisChange(e.target.value)}
              onFocus={onChassisFocus}
              placeholder={chassisPlaceholder}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={CHASSIS_SEARCH_MAX_CHARS}
            />
            {draftChassis.length > 0 && (
              <button
                type="button"
                className="fv-search-clear fv-results-search-clear"
                onClick={onClearChassis}
                aria-label="Clear chassis number"
              >
                <FiX aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
