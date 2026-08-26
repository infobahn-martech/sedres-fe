import Gateway from "../gateway/gateway";

/**
 * @param {string|number} callId
 */
const getSoItemsByCall = (callId) =>
  Gateway.get(`sales_order/get_so_items_by_call/${encodeURIComponent(String(callId))}`);

/**
 * @param {Array<number>} soItemIds
 */
const generateWorkOrder = (soItemIds) =>
  Gateway.post("sales_order/generate_work_order", { so_item_ids: soItemIds });

/**
 * @param {string|number} woId
 */
const getWorkOrder = (woId) =>
  Gateway.get(`sales_order/get_work_order/${encodeURIComponent(String(woId))}`);

/**
 * @param {string|number} woId
 */
const getWorkOrderPdf = (woId) =>
  Gateway.get(`sales_order/get_work_order_pdf/${encodeURIComponent(String(woId))}`);

/**
 * @param {object} payload
 * @param {Array<number>} payload.so_item_ids
 * @param {string|number} [payload.vendor_id]
 * @param {string} [payload.vendor_ref_no]
 * @param {string} [payload.contact_person]
 * @param {string} [payload.branch]
 * @param {string} [payload.currency]
 * @param {string} [payload.delivery_date]
 * @param {string} [payload.document_date]
 * @param {number} [payload.discount_percentage]
 * @param {number} [payload.rounding]
 * @param {string} [payload.remarks]
 */
const generatePO = (payload) => Gateway.post("sales_order/generate_po", payload);

/**
 * @param {object} payload
 * @param {string|number} payload.purchase_order_id
 * @param {string} [payload.contact_person]
 * @param {string} [payload.due_date]
 * @param {string} [payload.document_date]
 * @param {string} [payload.buyer]
 * @param {string} [payload.owner]
 * @param {number} [payload.discount_percentage]
 * @param {number} [payload.rounding]
 * @param {string} [payload.remarks]
 */
const generateGRN = (payload) => Gateway.post("sales_order/generate_grn", payload);

/**
 * @param {FormData} formData - purchase_order_id, invoice_number, invoice_amount, invoice_date, file
 */
const uploadInvoice = (formData) => Gateway.post("sales_order/upload_invoice", formData);

/**
 * @param {string|number} portId
 */
const getItemCodes = (portId) =>
  Gateway.get(`sales_order/get_item_codes/${encodeURIComponent(String(portId))}`);

/**
 * @param {string|number} tariffId
 * @param {string|number} entityId
 */
const getItemDetails = (tariffId, entityId) =>
  Gateway.get("sales_order/get_item_details", { params: { tariff_id: tariffId, entity_id: entityId } });

/**
 * @param {object} payload
 * @param {string|number} payload.call_id
 * @param {string|number} payload.tariff_id
 * @param {number} payload.quantity
 * @param {string} [payload.type_PO]
 * @param {string} [payload.supporting_docu]
 * @param {string|number} [payload.vendor_id]
 * @param {number} [payload.discount]
 */
const saveSalesOrderItem = (payload) => Gateway.post("sales_order/save_sales_order_item", payload);

/**
 * @param {object} payload
 * @param {string|number} payload.so_item_id
 * @param {number} payload.quantity
 * @param {number} payload.discount_percentage
 * @param {number} payload.tax_percentage
 * @param {string|number} [payload.vendor_id]
 */
const updateSalesOrderItemAmount = (payload) => Gateway.post("sales_order/update_sales_order_item_amount", payload);

/**
 * @param {FormData} formData - so_item_id, documents[] (one or more files)
 */
const addSoItemDocument = (formData) => Gateway.post("sales_order/add_so_item_document", formData);

/**
 * @param {object} payload
 * @param {number} payload.subtotal
 * @param {number} payload.discount_percentage
 * @param {number} payload.rounding - 1 to enable rounding, 0 to disable
 */
const calculateTotals = (payload) => Gateway.post("sales_order/calculate_totals", payload);

/**
 * @param {Array<number>} soItemIds
 */
const getPO = (soItemIds) => Gateway.post("sales_order/get_po", { so_item_ids: soItemIds });

/**
 * @param {object} payload
 * @param {string|number} payload.sales_order_id
 * @param {string} [payload.delivery_date]
 * @param {string} [payload.document_date]
 * @param {number} [payload.discount_percentage]
 * @param {number} [payload.total_discount]
 * @param {object} [payload.fields] - other editable SO fields, e.g. { po_number, project_name }
 */
const updateSalesOrder = (payload) => Gateway.post("sales_order/update_sales_order", payload);

export default {
  getSoItemsByCall,
  generateWorkOrder,
  getWorkOrder,
  getWorkOrderPdf,
  generatePO,
  generateGRN,
  uploadInvoice,
  getItemCodes,
  getItemDetails,
  saveSalesOrderItem,
  addSoItemDocument,
  calculateTotals,
  getPO,
  updateSalesOrderItemAmount,
  updateSalesOrder,
};
