import Gateway from '../gateway/gateway';

/** @param {FormData} formData - call_ids, card_ids (ticked "Convert to AR Invoice" cards, comma separated),
 * invoices[] (invoice PDFs, max 20 per request), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { received_files: string[], max_files_per_request: number,
 *   not_placed_files: string[], cards: { call_id: number, card_id: number, ready: boolean,
 *   sales_orders: { sales_order_id: number, sales_order_no: string, invoice: object|null }[] }[] } }
 *   | { status: 'error', message: string } }>}
 * Bulk AR invoice upload: the backend matches each PDF to a card's sales order. */
const uploadArInvoices = (formData) =>
  Gateway.post('/da/upload_ar_invoices', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

/** @param {{ workflow_id: number, page: number, per_page: number }} params
 * @returns {Promise<{ data: { status: 'success', data: { cards: { call_id: number, card_id: number, ready: boolean,
 *   sales_orders: { sales_order_id: number, sales_order_no: string, wo_number: string, se_numbers: string[],
 *   invoice: object|null }[] }[], pagination: { total_pages: number } } }
 *   | { status: 'error', message: string } }>}
 * AR invoice review of the workflow's cards, paged: which sales orders have an invoice placed on them. */
const getArInvoiceReview = (params) => Gateway.get('/da/ar_invoice_review', { params });

/** @param {{ cards: { call_id: number, card_id: number, sales_orders: { sales_order_no: string, invoice_id: number,
 *   invoice_no?: string, non_taxable_amount?: number, taxable_amount?: number, vat_amount?: number }[] }[] }} payload
 * Confirms the reviewed AR invoices (ticked cards only); the backend moves the confirmed cards to the next column. */
const confirmArInvoices = (payload) => Gateway.post('/da/confirm_ar_invoices', payload);

/** @param {number|string} callId
 * @param {number|string} cardId
 * @returns {Promise<{ data: { status: 'success', data: { call_id: number, card_id: number, to: string, cc: string,
 *   subject: string, body: string, stage_document_id: number, document_name: string, document_url: string } }
 *   | { status: 'error', message: string } }>}
 * Prefilled final invoice email for one "AR Invoice Issued" card; document_url is the invoice PDF. */
const getFinalInvoiceEmailDraft = (callId, cardId) =>
  Gateway.get('/da/final_invoice_email_draft', { params: { call_id: callId, card_id: cardId } });

/** @param {FormData} formData - call_id, card_id, stage_document_id, to, cc, subject, body, attachments[]?,
 *   multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved: { call_id: number, card_id: number,
 *   column_id: number, column_name: string }, dispatch_proof: { stage_document_id: number, name: string,
 *   url: string } } } | { status: 'error', message: string } }>}
 * Sends the final invoice email; the card moves to "Invoice dispatched". */
const sendFinalInvoiceEmail = (formData) =>
  Gateway.post('/da/send_final_invoice_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  uploadArInvoices,
  getArInvoiceReview,
  confirmArInvoices,
  getFinalInvoiceEmailDraft,
  sendFinalInvoiceEmail,
};
