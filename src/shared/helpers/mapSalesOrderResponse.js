// DA supervisor / coordinator come back as an array of user ids, or a comma-separated string.
const toIdArray = (raw) => {
  if (raw == null || raw === "") return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  return list.map((v) => String(v).trim()).filter(Boolean);
};

// da_team members may come back as a bare user id or as a user object.
const toUserId = (v) => {
  if (v == null || v === "") return "";
  if (typeof v === "object") return String(v.user_id ?? v.id ?? "").trim();
  return String(v).trim();
};

/**
 * Billing-entity-specific SO header fields (e.g. PO No, Project Name, SRN No). Labels, order,
 * type and required flag are all configured per billing entity on the backend.
 * @returns {{ fieldId: string, name: string, key: string, type: string, required: boolean, value: string }[]}
 */
export const mapBillingEntityFields = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .filter((f) => f && f.field_key)
    .map((f) => ({
      fieldId: String(f.field_id ?? f.field_key),
      name: String(f.field_name ?? f.field_key),
      key: String(f.field_key),
      type: String(f.field_type || "text").toLowerCase(),
      required: Number(f.is_required) === 1 || f.is_required === true,
      value: f.field_value != null ? String(f.field_value) : "",
      order: Number(f.sequence_order) || 0,
    }))
    .sort((a, b) => a.order - b.order);

/**
 * Maps GET sales_order/get_so_items_by_call/{call_id} `data` payload into the FE shape used by SalesOrderList.
 * @param {object} apiData - `response.data.data` from the API envelope
 * @returns {object} Fields merged into card form state
 */
export function mapSalesOrderResponse(apiData) {
  if (!apiData || typeof apiData !== "object") {
    return {
      soCustomerCode: "",
      soCustomerName: "",
      soContactPerson: "",
      email: "",
      soBpCurrency: "",
      soEuroRate: "",
      soPort: "",
      branch: "",
      soSoNo: "",
      soPostingDate: "",
      soDeliveryDate: "",
      soDocumentDate: "",
      soShipName: "",
      soStatus: "",
      salesOrderId: "",
      billingEntity: "",
      lineItemTotal: 0,
      soOwner: "",
      soDaSupervisorIds: [],
      soDaCoordinatorIds: [],
      soBillingEntityFields: [],
      soDaCardId: "",
      soSubtotal: "",
      soTotalDiscount: "",
      soDiscountPercentage: "",
      soTotalTax: "",
      soGrandTotal: "",
      soRoundingEnabled: false,
      soRoundingRate: "",
      soRemarks: "",
      salesOrderList: [],
    };
  }

  /** Returns yyyy-mm-dd or "" for <input type="date" />; treats 0000-00-00 as empty. */
  const normalizeDate = (d) => {
    if (d == null || d === "") return "";
    const s = String(d).trim();
    const head = s.length >= 10 ? s.slice(0, 10) : s;
    if (head === "0000-00-00") return "";
    return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : "";
  };

  /** An item's own status. The API has used both spellings for it — `item_status` is what
   *  da/da_verify_sales_line_item and da/da_delete_sales_line_item return, `status` is what
   *  the list has been read from here — so accept either rather than silently mapping "". */
  const itemStatusOf = (item) => String(item?.item_status ?? item?.status ?? "").trim();

  // da/da_delete_sales_line_item soft-deletes on the backend (item_status → "Cancelled")
  // rather than removing the row from this endpoint's response — confirmed via testing that
  // this endpoint reliably sends a status per item, so filtering it out here is enough on its
  // own (no client-side fallback needed for deleted items).
  const items = Array.isArray(apiData.items)
    ? apiData.items.filter((item) => itemStatusOf(item).toLowerCase() !== "cancelled")
    : [];

  const taxCodeFromApi = (item) => {
    const t = item.tax_percentage;
    if (t == null || String(t).trim() === "") return "15%";
    const s = String(t).trim().replace(/%$/, "");
    return /^\d+(\.\d+)?$/.test(s) ? `${s}%` : "15%";
  };

  /** Maps one entry of an item's `documents` array (document_id, file_name, uploaded_by, uploaded_at, file_url). */
  const mapDocument = (doc) => {
    const rawName = doc?.file_name != null ? String(doc.file_name) : "";
    const baseName = rawName.split("/").pop() || rawName;
    const ext = (baseName.split(".").pop() || "").toUpperCase();
    const rawId = Number(doc?.document_id);
    return {
      id: Number.isFinite(rawId) && rawId > 0 ? rawId : baseName,
      name: baseName,
      type: ext || "FILE",
      url: doc?.file_url || "",
      uploadedBy: doc?.uploaded_by ?? null,
      uploadedAt: doc?.uploaded_at || "",
    };
  };

  const salesOrderList = items.map((item, idx) => {
    const rawId = Number(item.so_item_id);
    const id = Number.isFinite(rawId) && rawId > 0 ? rawId : idx + 1;
    return {
    id,
    itemNo: item.item_code || "",
    itemDescription: item.item_name || "",
    qty: Number(item.quantity) || 0,
    unitPrice: Number(item.unit_price) || 0,
    totalAmount: Number(item.total_price) || 0,
    discount: item.discount_percentage != null && String(item.discount_percentage).trim() !== "" ? Number(item.discount_percentage) : 0,
    taxCode: taxCodeFromApi(item),
    typeOfPo: "",
    supplierCode: "",
    supplierName: "",
    callFile: null,
    poStatus: "Draft",
    is_third_party: item.is_third_party,
    woStatus: Number(item.wo_status) || 0,
    workOrder: item.work_order?.wo_number || "",
    woId: item.work_order?.wo_id != null ? String(item.work_order.wo_id) : null,
    poNo: item.purchase_order?.po_number || item.po_number || "",
    poId: (() => {
      const raw =
        item.purchase_order?.po_id ??
        item.purchase_order?.purchase_order_id ??
        item.purchase_order_id ??
        item.po_id ??
        null;
      return raw != null ? String(raw) : null;
    })(),
    status: itemStatusOf(item),
    documents: Array.isArray(item.documents) ? item.documents.map(mapDocument) : [],
  };
  });

  const lineItemTotal = salesOrderList.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);

  const str = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");

  const soCustomerName =
    str(apiData.customer_name) ||
    (apiData.billing_entity != null ? String(apiData.billing_entity).trim() : "");
  const soContactPerson =
    str(apiData.contact_person) ||
    (apiData.service_requestor_name != null ? String(apiData.service_requestor_name).trim() : "");
  const email =
    str(apiData.contact_email) ||
    (apiData.service_requestor_email != null ? String(apiData.service_requestor_email).trim() : "");
  const soShipName =
    str(apiData.ship_name) ||
    (apiData.vessel_name != null ? String(apiData.vessel_name).trim() : "");

  const asNumString = (v) =>
    v != null && String(v).trim() !== "" && !Number.isNaN(Number(String(v).trim())) ? String(Number(String(v).trim())) : "";

  return {
    soCustomerCode: apiData.customer_code != null ? String(apiData.customer_code) : "",
    soCustomerName,
    soContactPerson,
    email,
    soBpCurrency: apiData.currency != null ? String(apiData.currency) : "",
    soEuroRate: apiData.conversion_rate != null && String(apiData.conversion_rate).trim() !== "" ? String(apiData.conversion_rate) : "",
    soPort: apiData.port != null ? String(apiData.port) : "",
    branch: apiData.branch != null ? String(apiData.branch) : "",
    soSoNo: apiData.sales_order_no != null ? String(apiData.sales_order_no) : "",
    soPostingDate: normalizeDate(apiData.sales_order_date),
    soDeliveryDate: normalizeDate(apiData.delivery_date),
    soDocumentDate: normalizeDate(apiData.document_date),
    soShipName,
    soStatus: apiData.so_status != null ? String(apiData.so_status).trim() : "",
    salesOrderId: apiData.sales_order_id != null ? String(apiData.sales_order_id) : "",
    billingEntity: soCustomerName,
    lineItemTotal,
    // SO owner & totals (do not use `owner` — that key is the card owner user id in CardForm)
    soOwner: apiData.owner != null ? String(apiData.owner).trim() : "",
    soDaSupervisorIds: apiData.da_team
      ? [toUserId(apiData.da_team.supervisor)].filter(Boolean)
      : toIdArray(apiData.da_supervisor_ids),
    soDaCoordinatorIds: apiData.da_team
      ? (Array.isArray(apiData.da_team.coordinators) ? apiData.da_team.coordinators : []).map(toUserId).filter(Boolean)
      : toIdArray(apiData.da_coordinator_ids),
    soBillingEntityFields: mapBillingEntityFields(apiData.billing_entity_fields),
    // card_id that da/assign_da_team expects for this sales order's card.
    soDaCardId: apiData.da_team?.card_id != null ? String(apiData.da_team.card_id) : "",
    soSubtotal: asNumString(apiData.subtotal),
    soTotalDiscount: asNumString(apiData.total_discount),
    soDiscountPercentage: apiData.discount_percentage != null ? String(apiData.discount_percentage).trim() : "",
    soTotalTax: asNumString(apiData.total_tax),
    soGrandTotal: asNumString(apiData.grand_total),
    // rounding is the 1/0 toggle; rounding_rate the adjustment the backend applied (may be "").
    soRoundingEnabled: (Number(apiData.rounding) || 0) !== 0,
    soRoundingRate: asNumString(apiData.rounding_rate),
    soRemarks: apiData.remarks != null ? String(apiData.remarks) : "",
    salesOrderList,
  };
}
