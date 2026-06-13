const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Split API / stored datetime into separate date (YYYY-MM-DD) and time (HH:mm).
 * Avoids `new Date("YYYY-MM-DD")` UTC timezone shift.
 */
export function splitApiDateTimeParts(raw, separateTime) {
  let date = "";
  let time = "";

  const timeFromField = String(separateTime ?? "").trim();
  if (timeFromField) {
    const timeMatch = timeFromField.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      time = `${pad2(timeMatch[1])}:${timeMatch[2]}`;
    }
  }

  if (raw == null || String(raw).trim() === "") {
    return { date, time };
  }

  const normalized = String(raw).trim().replace("T", " ");
  const [datePart = "", timeRaw = ""] = normalized.split(/\s+/);

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    date = datePart;
    if (!time && timeRaw) {
      const timeMatch = String(timeRaw).match(/^(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        time = `${pad2(timeMatch[1])}:${timeMatch[2]}`;
      }
    }
  }

  return { date, time };
}

/**
 * Build API datetime string: "YYYY-MM-DD HH:mm:ss" (matches transport/hotel payloads).
 */
export function buildApiDateTime(dateStr, timeStr) {
  const datePart = String(dateStr ?? "").trim();
  if (!datePart) return "";

  const rawTime = String(timeStr ?? "").trim();
  let hh = "00";
  let mm = "00";

  if (rawTime) {
    const segs = rawTime.split(":").map((s) => s.trim());
    if (segs.length >= 2) {
      hh = pad2(Number(segs[0]) || 0);
      mm = pad2(Number(segs[1]) || 0);
    }
  }

  return `${datePart} ${hh}:${mm}:00`;
}

/** ISO-style payload: "YYYY-MM-DDTHH:mm:ss" */
export function buildApiDateTimeIso(dateStr, timeStr) {
  const datePart = String(dateStr ?? "").trim();
  if (!datePart) return "";
  const rawTime = String(timeStr ?? "00:00").trim() || "00:00";
  const segs = rawTime.split(":");
  const hh = pad2(Number(segs[0]) || 0);
  const mm = pad2(Number(segs[1]) || 0);
  return `${datePart}T${hh}:${mm}:00`;
}

export function formatDisplayDateTime(raw, separateTime) {
  const { date, time } = splitApiDateTimeParts(raw, separateTime);
  if (!date) return "";
  const effectiveTime = time || "00:00";
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = effectiveTime.split(":").map(Number);
  const d = new Date(year, month - 1, day, hours || 0, minutes || 0);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Returns the next calendar day (YYYY-MM-DD) after the date in rawDate, or undefined if invalid. */
export function nextDayOf(rawDate) {
  const datePart = (rawDate || "").split(" ")[0].split("T")[0];
  if (!datePart) return undefined;
  const d = new Date(`${datePart}T00:00:00`);
  if (isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
