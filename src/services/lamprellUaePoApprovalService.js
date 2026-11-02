import Gateway from '../gateway/gateway';

/** @param {FormData} formData - call_ids, card_ids (ticked cards, comma separated), po_approval[] (the client's
 * reply: PDF, EML, MSG, JPG or PNG), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { document: { document_id: number, name: string, url: string },
 *   cards: { call_id: number, card_id: number, ready: boolean, sales_orders: { sales_order_no: string,
 *   services: string, amount: number, po_number: string, srn_no: string, received_qty: string,
 *   srn_used_by: object|null }[] }[] } } | { status: 'error', message: string } }>}
 * Uploads the client's PO reply for the ticked Lamprell UAE cards; the response pre-fills the PO review. */
const uploadPoApproval = (formData) =>
  Gateway.post('/da/upload_po_approval', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {{ document_id?: number, cards: { call_id: number, card_id: number, sales_orders: { sales_order_no: string,
 *   po_number: string, srn_no: string, received_qty: string }[] }[] }} payload - document_id is omitted when the
 *   review was filled by hand.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_po_received: { call_id: number, card_id: number }[],
 *   moved_to_da: { call_id: number, card_id: number }[], sales_orders: object[], po_approval: object } }
 *   | { status: 'error', message: string } }>}
 * Saves the reviewed PO details; the confirmed cards move on. */
const confirmPoApproval = (payload) => Gateway.post('/da/confirm_po_approval', payload);

export default {
  uploadPoApproval,
  confirmPoApproval,
};
