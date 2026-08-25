import { create } from "zustand";

// Local-only fallback for api/da/status_timeline's reached_date: api/da/update_status
// doesn't yet persist this on the backend (confirmed via testing — the field is sent but
// comes back null on refetch), so this remembers the client's own completion timestamp
// per call + status until the backend does. Cleared on full page reload by design; once
// the backend starts returning reached_date, that value takes priority over this fallback.
export const useDaLocalReachedDates = create((set, get) => ({
  reachedDates: {},
  setReachedDate: (callId, statusName, reachedDate) =>
    set((state) => ({
      reachedDates: { ...state.reachedDates, [`${callId}:${statusName}`]: reachedDate },
    })),
  getReachedDate: (callId, statusName) => get().reachedDates[`${callId}:${statusName}`] ?? null,
}));

// Local-only fallback for DA Operations fields that have no matching api/da/save_operation_tab
// field: Launch Hire's "3rd Party Launch hire" and "Road Transport", Invoice's "SRT / PO /
// WBS", Sales Order's "SRN No. (L & T)", and Operation Details' "Billing Entity" (see DA.jsx's
// updateField/billingEntityOverride). Typed values are remembered here per call id instead of
// vanishing the next time the card is opened. Same in-memory-only pattern as
// useDaLocalReachedDates above — cleared on full page reload by design; once the backend gains
// a real field for these, that value takes priority over this fallback.
export const useDaLocalLaunchHire = create((set, get) => ({
  overrides: {},
  setLaunchHireOverride: (callId, key, value) =>
    set((state) => ({
      overrides: { ...state.overrides, [callId]: { ...state.overrides[callId], [key]: value } },
    })),
  getLaunchHireOverride: (callId, key) => get().overrides[callId]?.[key] ?? null,
}));

// Local-only fallback for Sales Order line-item verification: da/da_verify_sales_line_item
// persists the toggle server-side, but the list endpoint that re-fetches items on reload
// (sales_order/get_so_items_by_call) has no status/item_status field on its items at all, so
// there's currently nothing for the FE to read the verified state back from. This remembers
// the client's own toggle per call + so_item_id in the meantime. Same in-memory-only pattern
// as useDaLocalReachedDates above — cleared on full page reload by design; once the backend
// starts returning a status field on each item, that value takes priority over this fallback.
export const useDaLocalVerifiedItems = create((set, get) => ({
  verifiedItemIds: {},
  setItemVerified: (callId, soItemId, isVerified) =>
    set((state) => {
      const current = new Set(state.verifiedItemIds[callId] || []);
      if (isVerified) {
        current.add(soItemId);
      } else {
        current.delete(soItemId);
      }
      return { verifiedItemIds: { ...state.verifiedItemIds, [callId]: current } };
    }),
  isItemVerified: (callId, soItemId) => get().verifiedItemIds[callId]?.has(soItemId) ?? false,
}));
