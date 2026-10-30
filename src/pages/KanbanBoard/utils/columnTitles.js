const SUBMITTED_INVOICES_COLUMN_PATTERN = /^submitted\s+invoices$/i;

/* "Submitted Invoices" holds finished work: its batches start collapsed and have no header action, and
   its cards carry no checkbox. */
export const isSubmittedInvoicesColumnTitle = (title) =>
  SUBMITTED_INVOICES_COLUMN_PATTERN.test(String(title ?? "").trim());

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
    !isLntSubmittedToDa(workflow?.title, title)
  );
};

const LNT_WORKFLOW_PATTERN = /l\s*&\s*t(?!\w)|larsen/i;
const SUBMITTED_TO_DA_COLUMN_PATTERN = /^submitted\s+to\s+f?da$/i;

export const isLntWorkflow = (workflow) => LNT_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

/* The L&T "Submitted to DA" (Operations board: "Submitted to FDA") column, whose cards get the SCC signature check. */
export const isLntSubmittedToDa = (workflowTitle, columnTitle) =>
  LNT_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  SUBMITTED_TO_DA_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const MCDERMOTT_WORKFLOW = "MCDERMOTT";

export const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);

const ZAMIL_WORKFLOW = "ZAMIL";

export const isZamilWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(ZAMIL_WORKFLOW);

const UPLOADED_TO_PORTAL_COLUMN_PATTERN =
  /^((uploaded|invoice\s+submitted)\s+to\s+(the\s+)?portal|dispatch\s+the\s+hard\s+copies)$/i;

/* "Uploaded to Portal" / "Invoice Submitted to Portal" / BGP's "Dispatch the Hard Copies" take one dispatch
   proof for one ticked card. */
export const isUploadedToPortalColumnTitle = (title) =>
  UPLOADED_TO_PORTAL_COLUMN_PATTERN.test(String(title ?? "").trim());

const BGP_WORKFLOW_PATTERN = /bgp/i;
const DISPATCH_HARD_COPIES_COLUMN_PATTERN = /^dispatch\s+the\s+hard\s+copies$/i;

/* BGP's "Dispatch the Hard Copies" keeps multi-select: one dispatch proof is attached to every ticked card. */
export const isMultiCardDispatchProofColumn = (workflow, columnTitle) =>
  BGP_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) &&
  DISPATCH_HARD_COPIES_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const POSH_WORKFLOW_PATTERN = /posh/i;
const POSH_ONE_CARD_COLUMN_PATTERN = /^(ar\s+invoices?\s+issued|po\s+received)$/i;

const SUBSEA_WORKFLOW_PATTERN = /subsea/i;
const SUBSEA_ONE_CARD_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;

const ZAMIL_ONE_CARD_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;

export const isSubseaWorkflow = (workflow) => SUBSEA_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

const DEFAULT_DA_ONE_CARD_COLUMN_PATTERN = /^(ar\s+invoices?\s+issued|ready\s+for\s+submission)$/i;

const DA_DEFAULT_WORKFLOW_PATTERN = /default.*\bda\b|\bda\b.*default/i;

export const isDaDefaultWorkflow = (workflow) => DA_DEFAULT_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

/* POSH DA requests the PO and sends the invoice one card at a time, so only one card in
   "AR Invoices Issued" or "PO Received" can stay ticked. The POs are uploaded in bulk, so
   "Requested/ Awaiting for PO" takes several. Subsea 7 DA sends the invoice one card at a time
   from "AR Invoices Issued", and so does Zamil Crew DA. The Default DA workflow checks the invoice of one
   card at a time from "AR Invoice Issued", and submits one card at a time from "Ready for Submission". */
export const isPoshOneCardColumn = (workflow, columnTitle) => {
  const title = String(columnTitle ?? "").trim();
  return (
    (POSH_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) && POSH_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isSubseaWorkflow(workflow) && SUBSEA_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isZamilWorkflow(workflow) && ZAMIL_ONE_CARD_COLUMN_PATTERN.test(title)) ||
    (isDaDefaultWorkflow(workflow) && DEFAULT_DA_ONE_CARD_COLUMN_PATTERN.test(title))
  );
};
