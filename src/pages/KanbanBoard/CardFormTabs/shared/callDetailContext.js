import { createContext, useContext, useEffect, useState } from "react";
import callFileService from "@/services/callFileService";

// CardForm fetches GET call_file/get_call_detail/{callId} once per open card and shares it
// with every tab through this context: { callId, detail, loading, error, refetch }.
export const CallDetailContext = createContext(null);

export const normalizeCallId = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

// The drawer's shared call detail, only when it belongs to `callId` (never another card's).
export const useSharedCallDetail = (callId) => {
  const shared = useContext(CallDetailContext);
  const id = normalizeCallId(callId);
  if (!shared || !id || shared.callId !== id) return null;
  return shared;
};

const IDLE = { detail: null, loading: false, error: "" };

// Call detail for `callId`: the drawer's shared copy when available, otherwise a local
// fetch (for components rendered outside CardForm). Never returns a different call's data.
export function useCallDetail(callId, { enabled = true } = {}) {
  const shared = useSharedCallDetail(callId);
  const id = normalizeCallId(callId);
  const fetchLocally = enabled && Boolean(id) && !shared;
  const [local, setLocal] = useState({ callId: "", ...IDLE });

  useEffect(() => {
    if (!fetchLocally) return undefined;
    let cancelled = false;
    setLocal({ callId: id, detail: null, loading: true, error: "" });
    callFileService
      .getCallDetail(id)
      .then(({ data }) => {
        if (!cancelled) setLocal({ callId: id, detail: data?.data ?? null, loading: false, error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setLocal({
            callId: id,
            detail: null,
            loading: false,
            error: error?.message || "Unable to load call details.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLocally, id]);

  if (!enabled || !id) return IDLE;
  if (shared) return { detail: shared.detail, loading: shared.loading, error: shared.error, refetch: shared.refetch };
  if (local.callId !== id) return { detail: null, loading: true, error: "" };
  return { detail: local.detail, loading: local.loading, error: local.error };
}
