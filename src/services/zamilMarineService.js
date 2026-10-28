import Gateway from '../gateway/gateway';

/** @param {{ so_item_id: string|number }} payload
 * @returns {Promise<{ data: { status: 'success', so_item_id: number, item_status: string } }>}
 * Toggles a sales line item between "Completed" and "Verified". */
const verifySalesLineItem = (payload) => Gateway.post('/da/da_verify_sales_line_item', payload);

/** @param {{ so_item_id: string|number }} payload
 * @returns {Promise<{ data: { status: 'success', so_item_id: number, item_status: 'Cancelled' } }>} */
const deleteSalesLineItem = (payload) => Gateway.post('/da/da_delete_sales_line_item', payload);

/** @returns {Promise<{ data: { status: 'success', data: { recipient: string, cc: string,
 *   stage_document_id?: number, document_url?: string } } }>}
 * Email draft for the "Send For PR" action. */
const getActionEmailDraft = (callId) => Gateway.get(`/da/da_action_email_draft/${callId}`);

/** @param {FormData} formData - call_id, to, cc, subject, body, stage_document_id?, attachments[]?,
 * multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', message: string, email_log_id: number }
 *   | { status: 'error' | false, message: string } }>} */
const sendActionEmail = (formData) =>
  Gateway.post('/da/da_send_action_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {FormData} formData - call_id, proof (signed SO, required), approval_email, plus the PR document,
 * multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', stage_document_id: number, uploaded: object, documents: object,
 *   moved_to_da: Array } | { status: 'error', message: string } }>}
 * Stores the signed SO, the PR and the approval email; the backend moves the card to the DA board once they are in. */
const uploadSoApprovalProof = (formData) =>
  Gateway.post('/da/da_upload_so_approval_proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  verifySalesLineItem,
  deleteSalesLineItem,
  getActionEmailDraft,
  sendActionEmail,
  uploadSoApprovalProof,
};
