import Gateway from '../gateway/gateway';

/** @param {FormData} formData - call_ids, card_ids (ticked cards, comma separated), po_approval[] (the PO
 * documents), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { document: { document_id: number, name: string, url: string },
 *   cards: { call_id: number, card_id: number, ready: boolean, sales_orders: { sales_order_no: string,
 *   services: string, amount: number, po_number: string, srn_no: string, received_qty: string,
 *   srn_used_by: string|null }[] }[] } } | { status: 'error', message: string } }>}
 * Uploads the PO approval for the ticked Zamil Marine cards. */
const uploadPoApproval = (formData) =>
  Gateway.post('/da/upload_po_approval', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  uploadPoApproval,
};
