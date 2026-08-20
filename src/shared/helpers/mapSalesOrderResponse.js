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
      soProjectName: "",
      soStatus: "",
      soPoNo: "",
      salesOrderId: "",
      srtNumber: "",
      billingEntity: "",
      lineItemTotal: 0,
      soOwner: "",
      soSubtotal: "",
      soTotalDiscount: "",
      soDiscountPercentage: "",
      soTotalTax: "",
      soGrandTotal: "",
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

  const items = Array.isArray(apiData.items) ? apiData.items : [];

  const taxCodeFromApi = (item) => {
    const t = item.tax_percentage;
    if (t == null || String(t).trim() === "") return "15%";
    const s = String(t).trim().replace(/%$/, "");
    return /^\d+(\.\d+)?$/.test(s) ? `${s}%` : "15%";
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
    status: item.status || "",
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
    soProjectName: apiData.project_name != null ? String(apiData.project_name) : "",
    soStatus: apiData.so_status != null ? String(apiData.so_status).trim() : "",
    soPoNo: apiData.po_number != null ? String(apiData.po_number) : "",
    salesOrderId: apiData.sales_order_id != null ? String(apiData.sales_order_id) : "",
    srtNumber: apiData.srt_number != null ? String(apiData.srt_number) : "",
    billingEntity: soCustomerName,
    lineItemTotal,
    // SO owner & totals (do not use `owner` — that key is the card owner user id in CardForm)
    soOwner: apiData.owner != null ? String(apiData.owner).trim() : "",
    soSubtotal: asNumString(apiData.subtotal),
    soTotalDiscount: asNumString(apiData.total_discount),
    soDiscountPercentage: apiData.discount_percentage != null ? String(apiData.discount_percentage).trim() : "",
    soTotalTax: asNumString(apiData.total_tax),
    soGrandTotal: asNumString(apiData.grand_total),
    salesOrderList,
  };
}
