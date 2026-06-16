import { displayVehicleNumber, resolveVehicleNumber } from "../../utils/bankRecordDisplay";

/**
 * Single-line Indian-style vehicle number (from Excel or DB).
 * @param {{ record?: object, value?: string, size?: 'sm' | 'md' | 'lg' | 'hero', className?: string }} props
 */
export default function VehicleNumberPlate({
  record,
  value,
  size = "md",
  className = "",
}) {
  const display =
    value != null && String(value).trim()
      ? displayVehicleNumber({ vehicleNumber: value })
      : displayVehicleNumber(record || {});

  const full =
    value != null && String(value).trim()
      ? resolveVehicleNumber({ vehicleNumber: value })
      : resolveVehicleNumber(record || {});

  if (display === "—") {
    return <span className={`vehicle-number-plate vehicle-number-plate--empty ${className}`.trim()}>—</span>;
  }

  return (
    <span
      className={`vehicle-number-plate vehicle-number-plate--${size} ${className}`.trim()}
      title={full || display}
    >
      {display}
    </span>
  );
}
