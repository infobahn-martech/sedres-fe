// Splits "YYYY-MM-DD HH:mm:ss" into the {date, time} shape DateTimeField's
// <input type="date"> / <input type="time"> pair expects.
export const parseApiDateTime = (raw) => {
  if (!raw) return { date: "", time: "" };
  const [datePart = "", timePart = ""] = String(raw).trim().split(" ");
  return { date: datePart, time: timePart ? timePart.slice(0, 5) : "" };
};

// api/da/status_timeline/{call_id} rows: { status_id, status_name, sticker_id,
// sequence_order, state, reached_date }. state comes back as "done" | "current" |
// "not_reached" — mapped to this section's "done" | "current" | "pending" below.
const STATUS_TIMELINE_STATE_MAP = { done: "done", current: "current", not_reached: "pending" };

// Shared between DA.jsx's Summary-tab Status Timeline and the Sales Order tab's header
// "DA Status" button (SalesOrderList.jsx) — both read the same api/da/status_timeline data.
export const mapStatusTimelineResponse = (rows) => {
  const mapped = [...(Array.isArray(rows) ? rows : [])]
    .sort((a, b) => Number(a?.sequence_order ?? 0) - Number(b?.sequence_order ?? 0))
    .map((row) => {
      const { date, time } = parseApiDateTime(row?.reached_date);
      return {
        key: String(row?.sequence_order ?? row?.status_name ?? ""),
        statusId: row?.status_id ?? null,
        stickerId: row?.sticker_id ?? null,
        label: row?.status_name ?? "",
        date: date || null,
        time: time || null,
        state: STATUS_TIMELINE_STATE_MAP[row?.state] ?? "pending",
      };
    });

  // api/da/status_timeline doesn't reliably send back a "current" row — a brand-new
  // card returns every row "not_reached", and advancing past a step (see
  // handleDaTimelineStepClick, CardForm.jsx) only flips the completed row to "done"
  // without promoting the next one to "current". Derive it client-side so the
  // click-to-advance logic (isForwardClickable in DA.jsx) always has a "current" step to
  // act on: the first non-done row after the last "done" one is the one in progress.
  if (!mapped.some((step) => step.state === "current")) {
    const nextPending = mapped.find((step) => step.state !== "done");
    if (nextPending) nextPending.state = "current";
  }

  return mapped;
};
