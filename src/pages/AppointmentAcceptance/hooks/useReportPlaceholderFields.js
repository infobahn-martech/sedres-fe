import { useCallback, useEffect, useState } from "react";
import formTemplateService from "../../../services/formTemplateService";
import { normalizePlaceholderGroups } from "../utils/reportPlaceholders";

const IDLE = { status: "idle", groups: [], error: "" };

// Insertable fields for the selected call type, grouped by tab / sub-tab.
// Loads only once `enabled` (the picker has been opened) and again whenever the call type
// changes. status: "idle" (no call type) | "loading" | "ready" | "error".
export default function useReportPlaceholderFields({ callTypeId, enabled }) {
  const [state, setState] = useState(IDLE);
  const [reloadKey, setReloadKey] = useState(0);
  const resolvedCallTypeId = String(callTypeId ?? "").trim();

  useEffect(() => {
    if (!resolvedCallTypeId) {
      setState(IDLE);
      return undefined;
    }
    if (!enabled) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    formTemplateService
      .getSystemBindings(resolvedCallTypeId)
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
  }, [resolvedCallTypeId, enabled, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { ...state, hasCallType: Boolean(resolvedCallTypeId), retry };
}
