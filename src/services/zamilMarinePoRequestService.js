import Gateway from '../gateway/gateway';

/** @param {Array<string|number>} callIds
 * @param {Array<string|number>} cardIds - ticked cards, sent as call_ids=210,235&card_ids=325,350
 * @returns {Promise<{ data: { status: 'success', data: { call_ids: number[], cards: { call_id: number, card_id: number }[],
 *   to: string, cc: string, subject: string, body: string, stage_document_id: number, document_url: string } }
 *   | { status: 'error', message: string } }>}
 * Prefilled "Request for PO" email for the ticked Zamil Marine cards (no batches). */
const getPoRequestDraft = (callIds, cardIds) =>
  Gateway.get('/da/po_request_draft', {
    params: { call_ids: callIds.join(','), card_ids: cardIds.join(',') },
  });

/** @param {FormData} formData - stage_document_id, to, cc, subject, body, call_ids, card_ids (ticked cards, comma
 * separated), attachments[]?, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_requested_po: { call_id: number, card_id: number }[] } }
 *   | { status: 'error', message: string } }>}
 * Sends the PO request email; the ticked cards move to the next column. */
const sendPoRequest = (formData) =>
  Gateway.post('/da/send_po_request', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  getPoRequestDraft,
  sendPoRequest,
};
