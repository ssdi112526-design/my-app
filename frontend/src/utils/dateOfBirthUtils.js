export function parseDobToParts(value) {
  if (!value) return { day: "", month: "", year: "" };

  const raw = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    return { day: iso[3], month: iso[2], year: iso[1] };
  }

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) {
    return {
      day: dmy[1].padStart(2, "0"),
      month: dmy[2].padStart(2, "0"),
      year: dmy[3],
    };
  }

  return { day: "", month: "", year: "" };
}

export function partsToDobIso({ day, month, year }) {
  const d = String(day || "").replace(/\D/g, "");
  const m = String(month || "").replace(/\D/g, "");
  const y = String(year || "").replace(/\D/g, "");

  if (!d || !m || !y || y.length !== 4) return "";

  const dayNum = Number(d);
  const monthNum = Number(m);
  const yearNum = Number(y);

  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
    return "";
  }

  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function formatDobDisplay(value) {
  const { day, month, year } = parseDobToParts(value);
  if (!day || !month || !year) return value || "—";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

export function validateDobParts({ day, month, year }) {
  const iso = partsToDobIso({ day, month, year });
  if (!iso) {
    return "Enter a valid DOB (DD / MM / YYYY).";
  }
  return "";
}
