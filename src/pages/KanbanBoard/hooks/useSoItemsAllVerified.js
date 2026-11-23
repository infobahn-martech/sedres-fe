import { useEffect, useState } from "react";
import salesOrderService from "@/services/salesOrderService";
import useSoVerifyRefreshStore from "@/store/soVerifyRefreshStore";

/* so_type values accepted by sales_order/get_so_items_by_call; both must be fully verified. */
const SO_TYPES = ["Marine", "Husbandry"];
/* item_status values written by da/da_verify_sales_line_item and da/da_delete_sales_line_item. */
const VERIFIED_ITEM_STATUS = "verified";
const CANCELLED_ITEM_STATUS = "cancelled";

const itemStatusOf = (item) => String(item?.item_status ?? item?.status ?? "").trim().toLowerCase();

const fetchCallItems = async (callId) => {
  const responses = await Promise.all(SO_TYPES.map((soType) => salesOrderService.getSoItemsByCall(callId, soType)));
  return responses.flatMap(({ data }) => (Array.isArray(data?.data?.items) ? data.data.items : []));
};

/**
 * True once every active line item of every given call, in both Marine and Husbandry, is Verified.
 * False while loading, on a fetch error, or when the calls have no active line items at all.
 * @param {Array<string|number>} callIds
 */
export default function useSoItemsAllVerified(callIds) {
  const callIdsKey = [...new Set((callIds || []).map(String))].sort().join(",");
  const verifyRefreshToken = useSoVerifyRefreshStore((state) => state.verifyRefreshToken);
  const [allVerified, setAllVerified] = useState(false);

  useEffect(() => {
    setAllVerified(false);
    if (!callIdsKey) return undefined;
    let isCancelled = false;
    Promise.all(callIdsKey.split(",").map(fetchCallItems))
      .then((itemsPerCall) => {
        if (isCancelled) return;
        const activeItems = itemsPerCall.flat().filter((item) => itemStatusOf(item) !== CANCELLED_ITEM_STATUS);
        setAllVerified(activeItems.length > 0 && activeItems.every((item) => itemStatusOf(item) === VERIFIED_ITEM_STATUS));
      })
      .catch(() => {
        if (!isCancelled) setAllVerified(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [callIdsKey, verifyRefreshToken]);

  return allVerified;
}
