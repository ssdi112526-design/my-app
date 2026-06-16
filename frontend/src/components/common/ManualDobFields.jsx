import { useEffect, useRef, useState } from "react";
import { parseDobToParts } from "../../utils/dateOfBirthUtils";

export default function ManualDobFields({
  value = "",
  onChange,
  disabled = false,
  idPrefix = "dob",
}) {
  const [parts, setParts] = useState(() => parseDobToParts(value));
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    setParts(parseDobToParts(value));
  }, [value]);

  const emitChange = (next) => {
    setParts(next);
    if (onChange) onChange(next);
  };

  const updatePart = (field, raw) => {
    const maxLen = field === "year" ? 4 : 2;
    const cleaned = raw.replace(/\D/g, "").slice(0, maxLen);
    const next = { ...parts, [field]: cleaned };
    emitChange(next);

    if (disabled) return;

    if (field === "day" && cleaned.length === 2) {
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    if (field === "month" && cleaned.length === 2) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
  };

  const handleKeyDown = (field, e) => {
    if (e.key !== "Backspace" || e.currentTarget.value) return;

    if (field === "month") {
      e.preventDefault();
      dayRef.current?.focus();
    }
    if (field === "year") {
      e.preventDefault();
      monthRef.current?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text").trim();
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
    if (!dmy) return;

    e.preventDefault();
    const next = {
      day: dmy[1].padStart(2, "0"),
      month: dmy[2].padStart(2, "0"),
      year: dmy[3],
    };
    emitChange(next);
    yearRef.current?.focus();
  };

  return (
    <div
      className={`manual-dob-fields${disabled ? " manual-dob-fields--disabled" : ""}`}
      role="group"
      aria-label="Date of birth"
      onPaste={handlePaste}
    >
      <div className="manual-dob-box">
        <input
          ref={dayRef}
          id={`${idPrefix}-day`}
          className="manual-dob-segment manual-dob-segment--day"
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          maxLength={2}
          placeholder="DD"
          aria-label="Day"
          value={parts.day}
          onChange={(e) => updatePart("day", e.target.value)}
          onKeyDown={(e) => handleKeyDown("day", e)}
          disabled={disabled}
        />
        <span className="manual-dob-sep" aria-hidden="true">
          /
        </span>
        <input
          ref={monthRef}
          id={`${idPrefix}-month`}
          className="manual-dob-segment manual-dob-segment--month"
          type="text"
          inputMode="numeric"
          autoComplete="bday-month"
          maxLength={2}
          placeholder="MM"
          aria-label="Month"
          value={parts.month}
          onChange={(e) => updatePart("month", e.target.value)}
          onKeyDown={(e) => handleKeyDown("month", e)}
          disabled={disabled}
        />
        <span className="manual-dob-sep" aria-hidden="true">
          /
        </span>
        <input
          ref={yearRef}
          id={`${idPrefix}-year`}
          className="manual-dob-segment manual-dob-segment--year"
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          placeholder="YYYY"
          aria-label="Year"
          value={parts.year}
          onChange={(e) => updatePart("year", e.target.value)}
          onKeyDown={(e) => handleKeyDown("year", e)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}