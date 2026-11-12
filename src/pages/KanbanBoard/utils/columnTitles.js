const SUBMITTED_INVOICES_COLUMN_PATTERN = /^submitted\s+invoices$/i;

/* "Submitted Invoices" holds finished work: its batches start collapsed and have no header action, and
   its cards carry no checkbox. */
export const isSubmittedInvoicesColumnTitle = (title) =>
  SUBMITTED_INVOICES_COLUMN_PATTERN.test(String(title ?? "").trim());

const LAMPRELL_UAE_WORKFLOW_PATTERN = /lamprell\s*uae/i;
const PO_RECEIVED_SUBMITTED_TO_DA_COLUMN_PATTERN = /^po\W*rec(ei|ie)ved(\W+submitted\W*to\W*da)?$/i;

/* Lamprell UAE Operations "PO Received / Submitted to DA": its cards are ticked for "Upload PO" even though
   the backend does not flag them with da_board. */
export const isLamprellUaePoReceivedColumn = (workflowTitle, columnTitle) =>
  LAMPRELL_UAE_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  PO_RECEIVED_SUBMITTED_TO_DA_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const LAMPRELL_ALGIHAZ_WORKFLOW_PATTERN = /lamprell\s*al[\s-]?gihaz/i;
const TO_BE_SENT_FOR_SO_APPROVAL_COLUMN_PATTERN = /^to\s+be\s+sent\s+for\s+so\s+approval\b/i;
const AWAITING_SO_COLUMN_PATTERN = /^awaiting\s+(for\s+)?so\b/i;

export const isLamprellAlgihazWorkflowTitle = (workflowTitle) =>
  LAMPRELL_ALGIHAZ_WORKFLOW_PATTERN.test(String(workflowTitle ?? ""));

/* Lamprell Algihaz batches: "Send SO" on "To be sent for SO Approval" (the live title may carry the
   category, e.g. "... Port Call"), "Upload approved SOs" on "Awaiting SO". */
export const isLamprellAlgihazSendSoColumn = (workflowTitle, columnTitle) =>
  isLamprellAlgihazWorkflowTitle(workflowTitle) &&
  TO_BE_SENT_FOR_SO_APPROVAL_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

export const isLamprellAlgihazAwaitingSoColumn = (workflowTitle, columnTitle) =>
  isLamprellAlgihazWorkflowTitle(workflowTitle) &&
  AWAITING_SO_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const PO_RECEIVED_COLUMN_PATTERN = /^po\s+received$/i;

/* Lamprell Algihaz "PO Received": its cards are ticked for the bulk invoice upload even though the backend
   does not flag them with da_board. */
export const isLamprellAlgihazPoReceivedColumn = (workflowTitle, columnTitle) =>
  isLamprellAlgihazWorkflowTitle(workflowTitle) && PO_RECEIVED_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const AR_INVOICES_ISSUED_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;

/* Lamprell Algihaz "AR Invoice Issued": its cards are ticked for "Create documents" for the same reason. */
export const isLamprellAlgihazArInvoiceIssuedColumn = (workflowTitle, columnTitle) =>
  isLamprellAlgihazWorkflowTitle(workflowTitle) && AR_INVOICES_ISSUED_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const ARCHIVE_COLUMN_PATTERN = /archive/i;
const SRF_SOURCE_COLUMN_PATTERN = /^submitted\s+to\s+da$/i;
const SUBMIT_BY_EMAIL_COLUMN_PATTERN = /^submit\s+by\s+email$/i;

/* The last working column of a flow (the one right before "Ready to Archive") holds finished cards, so
   its cards carry no checkbox. "Submitted to DA" keeps its ticks because they drive Upload SRF, and BGP's
   "Submit by Email" because they drive Submit by Email. */
export const isColumnBeforeArchive = (workflow, colKey) => {
  const order = workflow?.columnOrder ?? [];
  const index = order.indexOf(colKey);
  if (index === -1 || index === order.length - 1) return false;
  const title = String(workflow.columns[colKey]?.title ?? "").trim();
  const nextTitle = String(workflow.columns[order[index + 1]]?.title ?? "");
  return (
    ARCHIVE_COLUMN_PATTERN.test(nextTitle) &&
    !ARCHIVE_COLUMN_PATTERN.test(title) &&
    !SRF_SOURCE_COLUMN_PATTERN.test(title) &&
    !SUBMIT_BY_EMAIL_COLUMN_PATTERN.test(title) &&
    !isLntSubmittedToDa(workflow?.title, title) &&
    !isLamprellUaePoReceivedColumn(workflow?.title, title) &&
    !isLamprellAlgihazPoReceivedColumn(workflow?.title, title) &&
    !isLamprellAlgihazArInvoiceIssuedColumn(workflow?.title, title)
  );
};

const LNT_WORKFLOW_PATTERN = /l\s*&\s*t(?!\w)|larsen/i;
const SUBMITTED_TO_DA_COLUMN_PATTERN = /^submitted\s+to\s+f?da$/i;

export const isLntWorkflow = (workflow) => LNT_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

const RECEIVED_FROM_OPS_COLUMN_PATTERN = /^received\s+from\s+ops$/i;

const DA_SUPERVISOR_WORKFLOW_PATTERN = /da\s+supervisor/i;

/* The DA Supervisor "Received from Ops" column: the cards of its L&T swimlane are ticked for the bulk SAP invoice upload and review. */
export const isLntReceivedFromOps = (workflowTitle, columnTitle) =>
  DA_SUPERVISOR_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  RECEIVED_FROM_OPS_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

/* L&T is a swimlane of the DA Supervisor workflow, not a workflow of its own. */
export const isLntSwimlaneTitle = (laneTitle) => LNT_WORKFLOW_PATTERN.test(String(laneTitle ?? ""));

/* The L&T "Submitted to DA" (Operations board: "Submitted to FDA") column, whose cards get the SCC signature check. */
export const isLntSubmittedToDa = (workflowTitle, columnTitle) =>
  LNT_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  SUBMITTED_TO_DA_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const INVOICE_ISSUED_COLUMN_PATTERN = /^invoice\s+issued$/i;

/* The L&T DA "Invoice Issued" column: "Download portal files" downloads the ticked cards' portal files as a zip
   and the backend moves the cards to the next column. */
export const isLntInvoiceIssued = (workflowTitle, columnTitle) =>
  LNT_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  INVOICE_ISSUED_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const MCDERMOTT_WORKFLOW = "MCDERMOTT";

export const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);

const ZAMIL_WORKFLOW = "ZAMIL";

export const isZamilWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(ZAMIL_WORKFLOW);

const UPLOADED_TO_PORTAL_COLUMN_PATTERN =
  /^((uploaded|invoice\s+submitted)\s+to\s+(the\s+)?portal|dispatch\s+the\s+hard\s+copies|consolidated\s+invoice\s+uploaded\s+to\s+i-?portal)$/i;

/* "Uploaded to Portal" / "Invoice Submitted to Portal" / BGP's "Dispatch the Hard Copies" take one dispatch
   proof for one ticked card. */
export const isUploadedToPortalColumnTitle = (title) =>
  UPLOADED_TO_PORTAL_COLUMN_PATTERN.test(String(title ?? "").trim());

const HARD_COPIES_DISPATCH_WORKFLOW_PATTERN = /bgp|lamprell\s*saudi/i;
const DISPATCH_HARD_COPIES_COLUMN_PATTERN = /^dispatch\s+the\s+hard\s+copies$/i;

const CONSOLIDATED_INVOICE_UPLOADED_COLUMN_PATTERN = /^consolidated\s+invoice\s+uploaded\s+to\s+i-?portal$/i;

/* Lamprell Algihaz "Consolidated Invoice Uploaded to I-Portal": one dispatch proof file is saved to every ticked card
   of the batch, with no review. */
export const isLamprellAlgihazDispatchProofColumn = (workflow, columnTitle) =>
  isLamprellAlgihazWorkflowTitle(workflow?.title) &&
  CONSOLIDATED_INVOICE_UPLOADED_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

/* BGP's and Lamprell Saudi's "Dispatch the Hard Copies" and Lamprell Algihaz's consolidated invoice column keep
   multi-select: one dispatch proof is attached to every ticked card. */
export const isMultiCardDispatchProofColumn = (workflow, columnTitle) =>
  (HARD_COPIES_DISPATCH_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) &&
    DISPATCH_HARD_COPIES_COLUMN_PATTERN.test(String(columnTitle ?? "").trim())) ||
  isLamprellAlgihazDispatchProofColumn(workflow, columnTitle);

const POSH_WORKFLOW_PATTERN = /posh/i;
const POSH_ONE_CARD_COLUMN_PATTERN = /^(ar\s+invoices?\s+issued|po\s+received)$/i;

const SUBSEA_WORKFLOW_PATTERN = /subsea/i;
const SUBSEA_ONE_CARD_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;

const ZAMIL_ONE_CARD_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;
const ZAMIL_MARINE_WORKFLOW_PATTERN = /zamil.*marine/i;

export const isSubseaWorkflow = (workflow) => SUBSEA_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

const DEFAULT_DA_ONE_CARD_COLUMN_PATTERN = /^(ar\s+invoices?\s+issued|ready\s+for\s+submission|submit\s+invoice)$/i;

const DA_DEFAULT_WORKFLOW_PATTERN = /default.*\bda\b|\bda\b.*default/i;

export const isDaDefaultWorkflow = (workflow) => DA_DEFAULT_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

/* POSH DA requests the PO and sends the invoice one card at a time, so only one card in
   "AR Invoices Issued" or "PO Received" can stay ticked. The POs are uploaded in bulk, so
   "Requested/ Awaiting for PO" takes several. Subsea 7 DA sends the invoice one card at a time
   from "AR Invoices Issued", and so does Zamil Marine DA (Zamil Crew DA takes several). The Default DA workflow checks the invoice of one
   card at a time from "AR Invoice Issued", and submits one card at a time from "Ready for Submission". */
export const isPoshOneCardColumn = (workflow, columnTitle) => {
  const title = String(columnTitle ?? "").trim();
  return (
    (POSH_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) && POSH_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isSubseaWorkflow(workflow) && SUBSEA_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isZamilWorkflow(workflow) &&
      ZAMIL_MARINE_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) &&
      ZAMIL_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isDaDefaultWorkflow(workflow) && DEFAULT_DA_ONE_CARD_COLUMN_PATTERN.test(title))
  );
};
