import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

// Local-only fallback for Sales Order line-item deletion: da/da_delete_sales_line_item
// soft-deletes on the backend (item_status → "Cancelled") rather than removing the row, and
// sales_order/get_so_items_by_call sends no status/item_status field on its items at all (same
// gap useDaLocalVerifiedItems above works around), so a deleted item still comes back in the
// list on the next fetch with nothing to distinguish it. This remembers which so_item_ids were
// deleted client-side per call so they can be filtered out of every subsequent load.
// Unlike the in-memory-only stores above, this one is persisted (zustand's own `persist`
// middleware, not a raw localStorage call in a component) — a deleted row confirmed by the
// backend should stay gone even across a real browser refresh, not just a close/reopen of the
// card. Sets aren't JSON-serializable on their own, hence the replacer/reviver below. Cleared
// on logout (see AuthReducer.js) same as the other DA local-only stores; once the backend stops
// returning cancelled items (or exposes a status field), this fallback becomes unnecessary.
export const useDaLocalDeletedItems = create(
  persist(
    (set, get) => ({
      deletedItemIds: {},
      markItemDeleted: (callId, soItemId) =>
        set((state) => {
          const current = new Set(state.deletedItemIds[callId] || []);
          current.add(soItemId);
          return { deletedItemIds: { ...state.deletedItemIds, [callId]: current } };
        }),
      isItemDeleted: (callId, soItemId) => get().deletedItemIds[callId]?.has(soItemId) ?? false,
    }),
    {
      name: "da-local-deleted-items",
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => (value instanceof Set ? { __set: Array.from(value) } : value),
        reviver: (_key, value) =>
          value && typeof value === "object" && Array.isArray(value.__set) ? new Set(value.__set) : value,
      }),
    }
  )
);
