import salesOrderService from "@/services/salesOrderService";

export const SO_TYPE_OPTIONS = ["Marine", "Husbandry"];
export const VERIFIED_ITEM_STATUS = "Verified";
const CANCELLED_ITEM_STATUS = "cancelled";

const itemStatusOf = (item) => String(item?.item_status ?? item?.status ?? "").trim().toLowerCase();

/* Resolves true only when every live (non-cancelled) line item of the call is Verified in BOTH sales
   order types (Marine and Husbandry), and at least one item exists. A type whose items cannot be
   loaded counts as not verified. */
export const areAllSoItemsVerifiedForCall = async (callId) => {
  if (!callId) return false;
  const results = await Promise.all(
    SO_TYPE_OPTIONS.map((soType) =>
      salesOrderService
        .getSoItemsByCall(callId, soType)
        .then((response) => {
          const body = response?.data;
          if (body?.status !== "success" || !body?.data) return null;
          const items = Array.isArray(body.data.items) ? body.data.items : [];
          return items.filter((item) => itemStatusOf(item) !== CANCELLED_ITEM_STATUS);
        })
        .catch(() => null)
    )
  );
  if (results.some((items) => items === null)) return false;
  const allItems = results.flat();
  return (
    allItems.length > 0 &&
    allItems.every((item) => itemStatusOf(item) === VERIFIED_ITEM_STATUS.toLowerCase())
  );
};
