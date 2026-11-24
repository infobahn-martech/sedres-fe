import { useEffect, useMemo, useState } from "react";
import { areAllSoItemsVerifiedForCall } from "../utils/soItemsVerification";

/* Reports, per call id, whether all its Marine and Husbandry line items are verified. Re-checked every
   time the set of call ids changes; a call is absent from the result until its check has finished. */
export default function useAllSoItemsVerified(callIds, enabled) {
  const [verifiedByCallId, setVerifiedByCallId] = useState({});
  const key = useMemo(() => [...new Set(callIds)].sort().join(","), [callIds]);

  useEffect(() => {
    if (!enabled || !key) {
      setVerifiedByCallId({});
      return undefined;
    }
    let cancelled = false;
    const ids = key.split(",");
    Promise.all(ids.map((id) => areAllSoItemsVerifiedForCall(id))).then((flags) => {
      if (cancelled) return;
      setVerifiedByCallId(Object.fromEntries(ids.map((id, i) => [id, flags[i]])));
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return verifiedByCallId;
}
