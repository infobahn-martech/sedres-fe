import Gateway from '../gateway/gateway';

/** @param {string|number} batchId
 * @param {Array<string|number>} [callIds] - calls of the ticked cards, sent as call_ids=61,63; left out for the whole batch
 * @returns {Promise<{ data: { status: 'success', data: { batch_id: number, batch_number: string,
 *   cards: { call_id: number, card_id: number }[], to: string, cc: string, subject: string, body: string,
 *   stage_document_id: number|null, folder_link: string,
 *   attachments: { stage_document_id: number|null, name: string, url: string }[] } }
 *   | { status: 'error', message: string } }>}
 * Prefilled "Send SO" approval request email for a Lamprell Algihaz batch in "To be sent for SO Approval". */
const getSoRequestDraft = (batchId, callIds = []) =>
  Gateway.get(`/da/po_request_draft/${batchId}`, {
    params: callIds.length ? { call_ids: callIds.join(',') } : undefined,
  });

/** @param {FormData} formData - batch_id, stage_document_id?, to, cc, subject, body, call_ids? (ticked cards, comma
 * separated), attachments[]?, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_requested_po: { call_id: number, card_id: number }[] } }
 *   | { status: 'error', message: string } }>}
 * Sends the SO approval request email; the batch's cards move to the next column. */
const sendSoRequest = (formData) =>
  Gateway.post('/da/send_po_request', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {FormData} formData - batch_id (whole batch) or call_ids + card_ids (ticked cards, comma separated),
 * approved_sos[] (the approved SO files), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { received_files: string[],
 *   moved: { call_id: number, card_id: number, sales_order_no: string, file_name: string, column_id: number,
 *   column_name: string }[], not_placed_files: { file_name: string, reason: string }[],
 *   still_waiting: { call_id: number, card_id: number, sales_orders: string[] }[] } }
 *   | { status: 'error', message: string } }>}
 * Uploads the client-approved SOs; every card whose sales orders are all covered moves to the next column. */
const uploadApprovedSos = (formData) =>
  Gateway.post('/da/upload_approved_so', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  getSoRequestDraft,
  sendSoRequest,
  uploadApprovedSos,
};
