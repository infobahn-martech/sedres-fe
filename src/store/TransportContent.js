/**
 * Helpers for Transport Request save (multipart payload).
 */

/**
 * @param {string} [dateStr] YYYY-MM-DD
 * @param {string} [timeStr] HH:mm or HH:mm:ss
 * @returns {string} e.g. "2026-05-15 08:00:00", or "" if no date
 */
export function buildPickupDateTime(dateStr, timeStr) {
  const datePart = String(dateStr || "").trim();
  if (!datePart) return "";

  const rawTime = String(timeStr != null ? timeStr : "00:00").trim();
  let hh = "00";
  let mm = "00";
  let ss = "00";

  if (rawTime) {
    const segs = rawTime.split(":").map((s) => s.trim());
    if (segs.length >= 2) {
      hh = String(Number(segs[0]) || 0).padStart(2, "0");
      mm = String(Number(segs[1]) || 0).padStart(2, "0");
      ss =
        segs[2] != null && segs[2] !== ""
          ? String(Number(segs[2]) || 0).padStart(2, "0")
          : "00";
    }
  }

  return `${datePart} ${hh}:${mm}:${ss}`;
}

