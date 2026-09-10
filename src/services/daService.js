import Gateway from '../gateway/gateway';

const getDaDetails = (callId) => Gateway.get(`/da/da_details/${callId}`);
const saveDaDetails = (callId, payload) => Gateway.post(`/da/save_da_details/${callId}`, payload);
const saveOperationTab = (callId, formData) => Gateway.post(`/da/save_operation_tab/${callId}`, formData);
const getRequiredDocuments = (callId) => Gateway.get(`/da/required_documents/${callId}`);
const saveDocumentsTab = (callId, formData) => Gateway.post(`/da/save_documents_tab/${callId}`, formData);
const deleteDocument = (documentId) => Gateway.post('/da/delete_document', { document_id: documentId });
const downloadSectionZip = (callId, documentName) =>
  Gateway.get(`/da/download_section_zip/${callId}`, {
    params: { document_name: documentName },
    responseType: 'blob',
  });
const getTimeObjects = (callId) => Gateway.get(`/da/time_objects/${callId}`);
const getCardStage = (callId) => Gateway.get(`/da/card/${callId}`);
const getStatusTimeline = (callId) => Gateway.get(`/da/status_timeline/${callId}`);
/** @param {{ call_id: string|number, column_id: string|number }} payload */
const advanceStage = (payload) => Gateway.post('/da/advance_stage', payload);
/** @param {{ call_id: string|number, status_id: string|number }} payload */
const updateStatus = (payload) => Gateway.post('/da/update_status', payload);
/** @param {{ so_item_id: string|number }} payload */
const deleteSalesLineItem = (payload) => Gateway.post('/da/da_delete_sales_line_item', payload);
/** @param {{ so_item_id: string|number }} payload */
const verifySalesLineItem = (payload) => Gateway.post('/da/da_verify_sales_line_item', payload);
/** @param {FormData} formData - call_id, to, subject, body, stage_document_id? — backend only
 * reads multipart form fields for this route, rejects a JSON body as missing all of them. */
const sendActionEmail = (formData) =>
  Gateway.post('/da/da_send_action_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @returns {Promise<{ data: { status: string, data: { recipient: string } } }>} */
const getActionEmailDraft = (callId) => Gateway.get(`/da/da_action_email_draft/${callId}`);
/** @param {FormData} formData - call_id + invoice file(s), multipart/form-data */
const uploadInvoice = (formData) =>
  Gateway.post('/da/da_upload_invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @param {{ call_id: string|number, decision: 1|0 }} payload - decision: 1 = approved, 0 = rejected */
const recordClientDecision = (payload) => Gateway.post('/da/da_record_client_decision', payload);
/** @returns {Promise<{ data: { status: string, data?: { button_state: 'send'|'awaiting_approval'|'approved', last_email_sent_date: string|null, last_decision: string|null, last_decision_date: string|null }, message?: string } }>}
 * Authoritative Sales Order operator/supervisor workflow button state — replaces the old
 * local justApproved/justRejected/isSoApprovalEmailPendingDecision heuristics in
 * SalesOrderList.jsx. `status: "error"` (e.g. "Call not found") on failure. */
const getActionState = (callId) => Gateway.get(`/da/action_state/${callId}`);

export default {
  getDaDetails,
  saveDaDetails,
  saveOperationTab,
  getRequiredDocuments,
  saveDocumentsTab,
  deleteDocument,
  downloadSectionZip,
  getTimeObjects,
  getCardStage,
  advanceStage,
  getStatusTimeline,
  updateStatus,
  deleteSalesLineItem,
  verifySalesLineItem,
  sendActionEmail,
  getActionEmailDraft,
  uploadInvoice,
  recordClientDecision,
  getActionState,
};
