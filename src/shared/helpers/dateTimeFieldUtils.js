const pad2 = (n) => String(n).padStart(2, "0");

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

  // Backend stores unset dates as MySQL's zero-date sentinel ("0000-00-00"),
  // which matches the date regex below but isn't a real date — treating it as
  // one round-trips it straight back to the backend on the next save.
  if (datePart === "0000-00-00") {
    return { date, time };
  }

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

export function nextDayOf(rawDate) {
  const datePart = (rawDate || "").split(" ")[0].split("T")[0];
  if (!datePart) return undefined;
  const d = new Date(`${datePart}T00:00:00`);
  if (isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
