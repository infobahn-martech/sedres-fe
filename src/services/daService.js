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
/** Moves several cards to the next column: { cards: [{ call_id, card_id }] }. */
const advanceStageCards = (payload) => Gateway.post('/da/advance_stage', payload);
/** @param {{ call_id: string|number, status_id: string|number }} payload */
const updateStatus = (payload) => Gateway.post('/da/update_status', payload);
/** @param {{ so_item_id: string|number }} payload */
const deleteSalesLineItem = (payload) => Gateway.post('/da/da_delete_sales_line_item', payload);
/** @param {{ so_item_id: string|number }} payload */
const verifySalesLineItem = (payload) => Gateway.post('/da/da_verify_sales_line_item', payload);
/** @param {FormData} formData - call_id, to, cc, subject, body, stage_document_id?,
 * attachments[]? — cc comes from getActionEmailDraft's `cc` and is editable in the modal. Backend only
 * reads multipart form fields for this route, rejects a JSON body as missing all of them. */
const sendActionEmail = (formData) =>
  Gateway.post('/da/da_send_action_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @returns {Promise<{ data: { status: string, data: { recipient: string, cc?: string, stage_document_id?: string|number, document_url?: string } } }>}
 * stage_document_id (when present) is a document the backend already holds for this stage —
 * confirmed via a live response 2026-09-15; feed it back into sendActionEmail's FormData.
 * document_url (added to the response 2026-09-15) is that same document's file URL — lets the
 * pre-loaded attachment actually be opened/previewed instead of only shown by name. */
const getActionEmailDraft = (callId) => Gateway.get(`/da/da_action_email_draft/${callId}`);
/** @param {FormData} formData - call_id + invoice file(s), multipart/form-data */
const uploadInvoice = (formData) =>
  Gateway.post('/da/da_upload_invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @param {FormData} formData - call_id, proof (required; `srt` instead for Subsea 7), approval_email, scc (required for L&T only), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', stage_document_id: number, uploaded: object, documents: object, moved_to_da: Array } | { status: 'error', message: string } }>}
 * Stores the client's approved SO (and approval email) once the decision has been recorded as approved. */
const uploadSoApprovalProof = (formData) =>
  Gateway.post('/da/da_upload_so_approval_proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @param {{ call_id: string|number, decision: 1|0 }} payload - decision: 1 = approved, 0 = rejected */
const recordClientDecision = (payload) => Gateway.post('/da/da_record_client_decision', payload);
/** @returns {Promise<{ data: { status: string, data?: { button_state: 'send'|'awaiting_approval'|'approved', last_email_sent_date: string|null, last_decision: string|null, last_decision_date: string|null, approval_proof_uploaded?: boolean, approved_by?: string|null, approved_date?: string|null, srt_flow?: boolean }, message?: string } }>}
 * Authoritative Sales Order operator/supervisor workflow button state — replaces the old
 * local justApproved/justRejected/isSoApprovalEmailPendingDecision heuristics in
 * SalesOrderList.jsx. `status: "error"` (e.g. "Call not found") on failure. */
const getActionState = (callId) => Gateway.get(`/da/action_state/${callId}`);
/** @param {{ cards: Array<{ call_id: number, card_id: number }> }} payload
 * @returns {Promise<{ data: { status: true, batch_id: number, batch_number: string }
 *   | { status: false|'error', message: string } }>}
 * The backend issues batch_number itself. Fails when the calls span more than one category (Crewing/Port Call). */
const createHubBatch = (payload) => Gateway.post('/da/create_hub_batch', payload);
/** @param {string|number} batchId
 * @param {Array<string|number>} [callIds] - calls of the batch's cards, sent as call_ids=110,111
 * @returns {Promise<{ data: { status: 'success', data: { batch_id: number, batch_number: string, category: string,
 *   recipient: string, cc: string, subject: string, body: string, call_ids: number[], stage_document_id: number,
 *   document_url: string } } | { status: 'error', message: string } }>}
 * Prefilled "Sent for SE creation" email for a hub batch. Errors with "Batch not found" for an unknown batch_id. */
const getSeCreationEmailDraft = (batchId, callIds = []) =>
  Gateway.get(`/da/se_creation_email_draft/${batchId}`, {
    params: callIds.length ? { call_ids: callIds.join(",") } : undefined,
  });
/** @returns {Promise<{ data: { status: 'success', data: Array<{ batch_id: number, batch_number: string,
 *   category: string, card_ids: number[] }> } | { status: 'error', message: string } }>}
 * Every hub batch created so far, with the cards grouped under it. */
const getBatches = () => Gateway.get('/da/batches');
/** @param {FormData} formData - batch_id, se_document (SE excel sheet, required on the first upload),
 * se_approval_email (.msg/.eml), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', stage_document_id: number, document_url: string }
 *   | { status: 'error', message: string } }>}
 * Errors if the SE Creation email has not been sent for the batch yet. */
const uploadSeApproval = (formData) =>
  Gateway.post('/da/upload_se_approval', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @param {FormData} formData - batch_id, to, subject, body, cc?, stage_document_id?, call_ids? (ticked
 * cards, sent as call_ids=43,55), attachments[]?, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', message: string, email_log_id: number, batch_id: number,
 *   call_ids: number[] } | { status: 'error', message: string } }>} */
const sendSeCreationEmail = (formData) =>
  Gateway.post('/da/send_se_creation_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
/** @param {string|number} batchId
 * @returns {Promise<{ data: { status: 'success', data: { batch_id: number, batch_number: string,
 *   cards: Array<{ call_id: number, card_id: number, approved: boolean, sales_orders: Array<{
 *   sales_order_id: number, sales_order_no: string, approved: boolean, wo_number: string|null,
 *   se_numbers: string[], project_split: string|null }> }> } } | { status: 'error', message: string } }>}
 * The batch's sales orders with their SE approval, WO, SE numbers and project split. */
const getSeApprovalLines = (batchId) => Gateway.get(`/da/se_approval_lines/${batchId}`);
/** @param {{ batch_id: number, cards: Array<{ call_id: number, card_id: number, sales_orders: Array<{
 *   sales_order_no: string, wo_number: string|null, se_numbers: string[], project_split: string|null }> }> }} payload
 *   - the batch's SE-approved cards only.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_se_received: Array<{ call_id: number,
 *   card_id: number }>, returned_to_backlog: Array<{ call_id: number, card_id: number }> } }
 *   | { status: 'error', message: string } }>}
 * Moves the sent cards to "SE Received"; the batch's other cards go back to Backlog. */
const confirmSeApproval = (payload) => Gateway.post('/da/confirm_se_approval', payload);
/** @param {{ cards: Array<{ call_id: number, card_id: number }> }} payload - the ticked "AR Invoices Issued" cards.
 * @returns {Promise<{ data: { status: 'success', data: { submission_id: number,
 *   moved_to_consolidated: Array<{ call_id: number, card_id: number, invoice_no: string }>, invoice_count: number,
 *   merged_page_count: number, merged_url: string } } | { status: 'error', message: string } }>}
 * Merges the cards' confirmed AR invoices into one PDF and moves the cards on to the consolidated column. Fails
 * when an invoice is missing, the cards are not in "AR Invoices Issued", or the invoices are in different currencies. */
const mergeArInvoices = (payload) => Gateway.post('/da/merge_ar_invoices', payload);
/** @param {{ call_ids: number[], card_ids: number[] }} params - the ticked cards, sent comma separated.
 * @returns {Promise<{ data: { status: 'success', data: { cards: Array<{ call_id: number, card_id: number,
 *   invoices: Array<{ sales_order_no: string, invoice_no: string, pdf: { name: string, url: string },
 *   xml: { name: string, url: string } }> }>, file_count: number, zip: { name: string, url: string } } }
 *   | { status: 'error', message: string } }>}
 * The cards' invoice PDF and XML portal files, bundled into one zip. */
const getPortalFiles = ({ call_ids: callIds, card_ids: cardIds }) =>
  Gateway.get('/da/portal_files', {
    params: { call_ids: callIds.join(','), card_ids: cardIds.join(',') },
  });
/** @param {FormData} formData - call_ids, card_ids (ticked "Uploaded to Portal" cards, comma separated), proofs[]
 *   (max 20 per request), multipart/form-data
 * @returns {Promise<{ data: { status: 'success', data: { received_files: string[], max_files_per_request: number,
 *   not_placed_files: string[], cards: Array<{ call_id: number, card_id: number, invoice_nos: string[], ready: boolean,
 *   proof: { document_id: number, name: string, url: string } | null }> } }
 *   | { status: 'error', message: string } }>}
 * Bulk dispatch proof upload: the backend matches each proof to a card by its invoice number. */
const uploadDispatchProof = (formData) =>
  Gateway.post('/da/upload_dispatch_proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
/** @param {{ cards: Array<{ call_id: number, card_id: number }> }} payload - the reviewed, ticked cards.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_dispatched: Array<{ call_id: number,
 *   card_id: number }> } } | { status: 'error', message: string } }>}
 * Confirms the reviewed dispatch proofs; the cards move to "Dispatch Proof Uploaded". */
const confirmDispatchProofs = (payload) => Gateway.post('/da/confirm_dispatch_proofs', payload);
/** @param {{ cards: Array<{ call_id: number, card_id: number }> }} payload - the ticked "Consolidated" cards.
 * @returns {Promise<{ data: { status: 'success', data: { submission_id: number, inv_no: string, zip_url: string } }
 *   | { status: 'error', message: string } }>}
 * Builds the cards' submission documents into one zip under the backend-generated consolidated invoice number
 * (inv_no); submission_id is what the final submission email is sent for. */
const createSubmissionDocuments = (payload) => Gateway.post('/da/create_submission_documents', payload);
/** @returns {Promise<{ data: { status: 'success', data: { to: string, cc: string, subject: string, body: string,
 *   attachments: Array<{ stage_document_id: number, name: string, url: string }>,
 *   merged_invoices: { sent_as: string, size_mb: number, url: string } } } | { status: 'error', message: string } }>}
 * Prefilled final submission email. Errors once the submission is stale: "Create the documents first" (the cards
 * were grouped differently since), "Submission N is already submitted", or the cards have left "Consolidated". */
const getSubmissionEmailDraft = (submissionId) => Gateway.get(`/da/submission_email_draft/${submissionId}`);
/** @param {FormData} formData - submission_id, to (comma separated), cc?, subject, body, signed_letter (1 file),
 *   approved_se_sheet[]?, approved_se_copies[]?, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_submitted: Array<{ call_id: number,
 *   card_id: number }> } } | { status: 'error', message: string } }>}
 * Sends the final submission email; the cards move to "Submitted Invoices". */
const sendSubmissionEmail = (formData) =>
  Gateway.post('/da/send_submission_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {FormData} formData - call_ids, card_ids (ticked SE Received cards, comma separated), invoices[]
 * (invoice PDFs, max 20 per request), multipart/form-data.
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

/** @param {{ page: number, per_page: number }} params
 * @returns {Promise<{ data: { status: 'success', data: { cards: { call_id: number, card_id: number, ready: boolean,
 *   sales_orders: { sales_order_id: number, sales_order_no: string, invoice: object|null }[] }[],
 *   pagination: { page: number, per_page: number, total_cards: number, total_pages: number } } }
 *   | { status: 'error', message: string } }>}
 * AR invoice review of every "SE Received" card, paged: which sales orders have an invoice placed on them. */
const getArInvoiceReview = (params) => Gateway.get('/da/ar_invoice_review', { params });

/** @param {{ cards: { call_id: number, card_id: number, sales_orders: { sales_order_no: string, invoice_id: number,
 *   invoice_no?: string, tax_details?: { tax_percent: number, net: number, tax: number, gross: number }[] }[] }[] }} payload
 * Confirms the reviewed AR invoices (ticked cards only, every sales order of each); the confirmed cards move to
 * "AR Invoices Issued". invoice_no and tax_details are optional overrides: left out, the values as read are used. */
const confirmArInvoices = (payload) => Gateway.post('/da/confirm_ar_invoices', payload);

/** @param {string|number} batchId
 * @param {Array<string|number>} [callIds] - calls of the ticked cards, sent as call_ids=110,111
 * @returns {Promise<{ data: { status: 'success', data: { batch_id: number, batch_number: string, call_ids: number[],
 *   cards: { call_id: number, card_id: number }[], to: string, cc: string, subject: string, body: string,
 *   stage_document_id: number, document_url: string } } | { status: 'error', message: string } }>}
 * Prefilled "Request PO" email for a McDermott batch in "Ready for PO Request"; document_url is the PO request sheet. */
const getPoRequestDraft = (batchId, callIds = []) =>
  Gateway.get(`/da/po_request_draft/${batchId}`, {
    params: callIds.length ? { call_ids: callIds.join(',') } : undefined,
  });

/** @param {Array<string|number>} callIds
 * @param {Array<string|number>} cardIds - ticked cards, sent as call_ids=210,235&card_ids=325,350
 * @returns {Promise<{ data: { status: 'success', data: { call_ids: number[], cards: { call_id: number, card_id: number }[],
 *   to: string, cc: string, subject: string, body: string, stage_document_id: number, document_url: string } }
 *   | { status: 'error', message: string } }>}
 * Prefilled "Request PO" email for ticked cards without a batch (POSH Saudi "AR Invoices Issued"). */
const getPoRequestDraftByCards = (callIds, cardIds) =>
  Gateway.get('/da/po_request_draft', {
    params: { call_ids: callIds.join(','), card_ids: cardIds.join(',') },
  });

/** @param {FormData} formData - batch_id (batches only), stage_document_id, to, cc, subject, body, call_ids? (ticked
 * cards, sent as call_ids=110,111), card_ids? (required with call_ids when there is no batch_id), attachments[]?,
 * multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_requested_po: { call_id: number, card_id: number }[] } }
 *   | { status: 'error', message: string } }>}
 * Sends the PO request email; the batch's cards move to "Requested PO". */
const sendPoRequest = (formData) =>
  Gateway.post('/da/send_po_request', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {FormData} formData - call_ids, card_ids (ticked Requested PO cards, comma separated), pos[]
 * (PO PDFs, max 20 per request), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { received_files: string[], max_files_per_request: number,
 *   not_placed_files: { file_name: string, reason: string }[], cards: { call_id: number, card_id: number, ready: boolean,
 *   sales_orders: { sales_order_id: number, sales_order_no: string, invoice_no: string, po: object|null }[] }[],
 *   pagination: { page: number, per_page: number, total_cards: number, total_pages: number } } }
 *   | { status: 'error', message: string } }>}
 * Bulk PO upload: the backend matches each PO PDF to a card's sales order by its invoice. */
const uploadPos = (formData) =>
  Gateway.post('/da/upload_pos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {FormData} formData - call_ids, card_ids (ticked Submitted to DA cards, comma separated), srf (one
 * SRF document for all of them), multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { file_name: string, file_url: string,
 *   cards: { call_id: number, card_id: number }[], moved_to_da: { call_id: number, card_id: number }[] } }
 *   | { status: 'error', message: string } }>} */
const uploadSrf = (formData) =>
  Gateway.post('/da/upload_srf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {{ workflow_id: number, card_ids: string (ticked cards, comma separated), page: number, per_page: number }} params
 * @returns {Promise<{ data: { status: 'success', data: { cards: { call_id: number, card_id: number, ready: boolean,
 *   sales_orders: { sales_order_id: number, sales_order_no: string, invoice_no: string, po: object|null }[] }[],
 *   pagination: { page: number, per_page: number, total_cards: number, total_pages: number } } }
 *   | { status: 'error', message: string } }>}
 * PO review of every McDermott "Requested PO" card, paged: which sales orders have a PO placed on them. */
const getPoReview = (params) => Gateway.get('/da/po_review', { params });

/** @param {FormData} formData - call_ids, card_ids (ticked SCC Received cards, comma separated), signed_sos[], sccs[],
 * approval_email, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { received_files: string[], not_placed_files: string[],
 *   cards: { call_id: number, card_id: number, sales_orders: string[], ready: boolean }[] } }
 *   | { status: 'error', message: string } }>}
 * Bulk upload of the signed SOs, SCCs and approval email of the ticked cards. */
const uploadSccDocuments = (formData) =>
  Gateway.post('/da/upload_scc_documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {{ workflow_id: number, card_ids: string (ticked cards, comma separated) }} params
 * SCC review of the ticked cards: which signed SO, SCC and approval email are placed on each. */
const getSccDocumentReview = (params) => Gateway.get('/da/scc_document_review', { params });

/** @param {{ cards: { call_id: number, card_id: number }[] }} payload
 * Confirms the reviewed SCC documents (ticked cards only); the response lists the moved cards in moved_to_da. */
const confirmSccDocuments = (payload) => Gateway.post('/da/confirm_scc_documents', payload);

/** @param {{ cards: { call_id: number, card_id: number, sales_orders: { sales_order_id: number, sales_order_no: string, po_id: number }[] }[] }} payload
 * Confirms the reviewed POs (ticked cards only); the confirmed cards move to "PO Received". */
const confirmPos = (payload) => Gateway.post('/da/confirm_pos', payload);

/** @param {string|number} callId
 * @returns {Promise<{ data: { status: 'success', data: { call_id: number, card_id: number, to: string, cc: string,
 *   subject: string, body: string, stage_document_id: number, document_name: string, document_url: string,
 *   page_count: number, warnings: string[] } } | { status: 'error', message: string } }>}
 * Prefilled invoice email for one McDermott "PO Received" card; document_url is the invoice PDF. */
/** @param {{ cards: Array<{ call_id: number, card_id: number, sales_orders: Array<{ sales_order_no: string,
 * service_sheet_no: string }> }> }} payload - the service sheet number typed for each sales order.
 * Saves the service sheet numbers on the cards' sales orders. */
const saveServiceSheets = (payload) => Gateway.post('/da/save_service_sheets', payload);

const getInvoiceDispatchDraft = (callId) => Gateway.get(`/da/invoice_dispatch_draft/${callId}`);

/** @param {FormData} formData - call_id, card_id, stage_document_id, to, cc, subject, body, attachments[]?,
 *   multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_invoice_dispatched: { call_id: number,
 *   card_id: number }[] } } | { status: 'error', message: string } }>}
 * Sends the invoice email; the card moves to "Invoice Dispatched". */
const sendInvoiceDispatch = (formData) =>
  Gateway.post('/da/send_invoice_dispatch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

const getFinalInvoiceEmailDraft = (callId, cardId) =>
  Gateway.get('/da/final_invoice_email_draft', { params: { call_id: callId, card_id: cardId } });

/** @param {FormData} formData - call_id, card_id, stage_document_id, to, cc, subject, body, attachments[]?,
 *   multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved: { call_id: number, card_id: number,
 *   column_id: number, column_name: string }, dispatch_proof: { stage_document_id: number, name: string,
 *   url: string } } } }>}
 * Sends the final invoice email; the card moves to "Invoice dispatched". */
const sendFinalInvoiceEmail = (formData) =>
  Gateway.post('/da/send_final_invoice_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {number[]} callIds
 * @param {number[]} cardIds
 * @returns {Promise<{ data: { status: 'success', data: { cards: { call_id: number, card_id: number }[], to: string,
 *   cc: string, subject: string, body: string, attachments: { stage_document_id: number, name: string,
 *   url: string }[] } } | { status: 'error', message: string } }>}
 * Prefilled SCC approval email for the ticked L&T "SO sent for SCC" cards. */
const getSccApprovalEmailDraft = (callIds, cardIds) =>
  Gateway.get('/da/scc_approval_email_draft', {
    params: { call_ids: callIds.join(','), card_ids: cardIds.join(',') },
  });

/** @param {FormData} formData - call_ids, card_ids, to, cc, subject, body, attachments[]?, multipart/form-data.
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_scc_received: { call_id: number,
 *   card_id: number }[] } } | { status: 'error', message: string } }>}
 * Sends the SCC approval email; the cards move to "SCC received". */
const sendSccApprovalEmail = (formData) =>
  Gateway.post('/da/send_scc_approval_email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @param {number[]} callIds
 * @param {number[]} cardIds
 * @returns {Promise<{ data: { status: 'success', data: { call_ids: number[], cards: { call_id: number,
 *   card_id: number }[], invoices: { call_id: number, card_id: number, sales_order_no: string, invoice_no: string,
 *   vessel: string, service: string, amount: number, crpo_no: string }[], to: string, cc: string, subject: string,
 *   body: string, stage_document_id: number, document_name: string, document_url: string, attachment_type: string,
 *   size_mb: number, warnings: string[] } } | { status: 'error', message: string } }>}
 * Prefilled invoice submission email for the ticked BGP "Submit by Email" cards. */
const getInvoiceSubmissionDraft = (callIds, cardIds) =>
  Gateway.get('/da/invoice_submission_draft', {
    params: { call_ids: callIds.join(','), card_ids: cardIds.join(',') },
  });

/** @param {FormData} formData - call_ids, card_ids, stage_document_id, to, cc, subject, body, attachments[]?,
 *   multipart/form-data.
 * Sends the invoice submission email; the sent cards move on. */
const sendInvoiceSubmission = (formData) =>
  Gateway.post('/da/send_invoice_submission', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/** @typedef {{ call_id: number, card_id: number, sales_orders: string[], documents: { scc: { stage_document_id: number,
 *   name: string, url: string, signed: boolean } | null }, ready: boolean, status: 'signed'|'missing'|null,
 *   checked_date: string|null }} SignatureCheckCard */
/** @param {{ cards: Array<{ call_id: number, card_id: number }> }} payload - the L&T Backlog cards.
 * @returns {Promise<{ data: { status: 'success', data: { cards: SignatureCheckCard[] } }
 *   | { status: 'error', message: string } }>}
 * Checks the signature on each card's SCC and stores the result. */
const checkSignatures = (payload) => Gateway.post('/da/signature_check', payload);
/** @returns {Promise<{ data: { status: 'success', data: { cards: SignatureCheckCard[] } }
 *   | { status: 'error', message: string } }>}
 * The stored result of the latest signature check of every card. */
const getSignatureChecks = () => Gateway.get('/da/signature_checks');
/** @param {{ cards: Array<{ call_id: number, card_id: number, signed_by_hand?: boolean }> }} payload
 * @returns {Promise<{ data: { status: 'success', data: { moved_to_convert_ar_invoice: Array<{ call_id: number,
 *   card_id: number }>, not_moved: Array<{ call_id: number, card_id: number, reason: string }> } }
 *   | { status: 'error', message: string } }>}
 * Moves the signed cards (or those marked signed by hand) on to "Convert to AR Invoice". */
const confirmSignatureCheck = (payload) => Gateway.post('/da/confirm_signature_check', payload);

export default {
  checkSignatures,
  getSignatureChecks,
  confirmSignatureCheck,
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
  advanceStageCards,
  getStatusTimeline,
  updateStatus,
  deleteSalesLineItem,
  verifySalesLineItem,
  sendActionEmail,
  getActionEmailDraft,
  uploadInvoice,
  uploadSoApprovalProof,
  recordClientDecision,
  getActionState,
  createHubBatch,
  getBatches,
  getSeCreationEmailDraft,
  uploadSeApproval,
  sendSeCreationEmail,
  getSeApprovalLines,
  confirmSeApproval,
  uploadArInvoices,
  getArInvoiceReview,
  confirmArInvoices,
  mergeArInvoices,
  getPortalFiles,
  uploadDispatchProof,
  confirmDispatchProofs,
  createSubmissionDocuments,
  getSubmissionEmailDraft,
  sendSubmissionEmail,
  getPoRequestDraft,
  getPoRequestDraftByCards,
  sendPoRequest,
  uploadPos,
  uploadSrf,
  getPoReview,
  uploadSccDocuments,
  getSccDocumentReview,
  confirmSccDocuments,
  confirmPos,
  saveServiceSheets,
  getInvoiceDispatchDraft,
  sendInvoiceDispatch,
  getFinalInvoiceEmailDraft,
  sendFinalInvoiceEmail,
  getSccApprovalEmailDraft,
  sendSccApprovalEmail,
  getInvoiceSubmissionDraft,
  sendInvoiceSubmission,
};
