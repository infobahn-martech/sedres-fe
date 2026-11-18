import { useCallback, useState } from "react";
import DefaultLineItemsModal from "../../appointment/DefaultLineItemsModal";

const asArray = (value) => (Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []);

// Save responses come back as the axios response, its body, or the body's `data` depending on the
// service wrapper; find the level that carries a non-empty `sales_order`. No sales_order → the modal
// is not shown. `so_line_item` is optional (it adds so_item_id / sales order no. when present).
const hasValue = (value) => asArray(value).some((entry) => entry && Object.keys(entry).length > 0);
const findSalesOrderPayload = (response) =>
  [response, response?.data, response?.data?.data, response?.data?.data?.data].find(
    (level) => level && typeof level === "object" && hasValue(level.sales_order)
  ) || null;

/**
 * Line items from a service save: one per `data.sales_order` entry, with so_item_id / sales order no.
 * from the matching `data.so_line_item` when the response has one. Null when sales_order is empty.
 */
export const extractSavedLineItems = (response) => {
  const payload = findSalesOrderPayload(response);
  if (!payload) return null;
  const salesOrders = asArray(payload.sales_order).filter(Boolean);
  const soLines = asArray(payload.so_line_item);
  const items = salesOrders
    .map((line, index) => {
      const soLine = soLines.find((entry) => entry?.item_code === line?.item_code) ?? soLines[index] ?? {};
      const soItemId = soLine.so_item_id ?? line.so_item_id ?? null;
      return {
        so_item_id: soItemId,
        // Created by the save itself: never re-added on Confirm. If removed and the response had no
        // so_item_id, the modal finds the line on the call's sales order by item code to cancel it.
        fromSave: true,
        tariff_id: line.tariff_id ?? soLine.tariff_id,
        item_code: line.item_code ?? soLine.item_code ?? "",
        item_name: line.item_name ?? line.item_code ?? soLine.item_code ?? "",
        quantity: line.quantity ?? soLine.quantity ?? 1,
        unit_price: line.unit_price ?? 0,
        tax_percentage: line.tax_percentage ?? 0,
        total_price: line.total_price ?? 0,
      };
    })
    .filter((item) => item.item_code || item.item_name);
  if (items.length === 0) return null;
  return { items, salesOrderNo: soLines[0]?.sales_order_no ?? "" };
};

/**
 * After a service request is saved, shows the sales order line items it created (from the save
 * response) in the same modal as a new call: remove them, add more from the port's tariff, or skip.
 *
 *   const { showSavedLineItems, lineItemsModal } = useServiceLineItemsModal(callId);
 *   ... const response = await save(); showSavedLineItems(response);
 *   ... return (<>{form}{lineItemsModal}</>);
 */
export function useServiceLineItemsModal(callId, { onClosed } = {}) {
  const [saved, setSaved] = useState(null);

  /** Opens the modal when the response carries a sales order line; returns whether it opened. */
  const showSavedLineItems = useCallback(
    (response) => {
      if (!callId) return false;
      const lineItems = extractSavedLineItems(response);
      if (!lineItems) return false;
      setSaved(lineItems);
      return true;
    },
    [callId]
  );

  const handleDone = useCallback(() => {
    setSaved(null);
    onClosed?.();
  }, [onClosed]);

  const lineItemsModal = saved ? (
    <DefaultLineItemsModal
      callId={callId}
      initialItems={saved.items}
      title="Sales Order Line Items"
      subtitle={
        saved.salesOrderNo
          ? `${saved.salesOrderNo} · added for this request. Remove items or add more, then confirm.`
          : "Added for this request. Remove items or add more, then confirm."
      }
      onDone={handleDone}
    />
  ) : null;

  return { showSavedLineItems, lineItemsModal };
}

export default useServiceLineItemsModal;
