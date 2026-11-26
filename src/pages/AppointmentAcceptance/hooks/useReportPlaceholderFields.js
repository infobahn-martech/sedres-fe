import { useCallback, useEffect, useState } from "react";
import appointmentAcceptanceService from "../../../services/appointmentAcceptanceService";
import { normalizePlaceholderGroups } from "../utils/reportPlaceholders";

const IDLE = { status: "idle", groups: [], error: "" };

// Insertable fields for the selected report type (GET report_template/placeholders).
// Loads only once `enabled` (the picker has been opened) and again whenever the report type
// changes. status: "idle" (no report type) | "loading" | "ready" | "error".
export default function useReportPlaceholderFields({ reportTypeId, enabled }) {
  const [state, setState] = useState(IDLE);
  const [reloadKey, setReloadKey] = useState(0);
  const resolvedReportTypeId = String(reportTypeId ?? "").trim();

  useEffect(() => {
    if (!resolvedReportTypeId) {
      setState(IDLE);
      return undefined;
    }
    if (!enabled) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    appointmentAcceptanceService
      .getReportPlaceholders(resolvedReportTypeId)
      .then(({ data }) => {
        if (cancelled) return;
        setState({ status: "ready", groups: normalizePlaceholderGroups(data?.data), error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          groups: [],
          error: error?.response?.data?.message || error?.message || "Failed to load fields.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedReportTypeId, enabled, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { ...state, hasReportType: Boolean(resolvedReportTypeId), retry };
}
