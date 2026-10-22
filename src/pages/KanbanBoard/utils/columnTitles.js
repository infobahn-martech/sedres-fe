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
    !SUBMIT_BY_EMAIL_COLUMN_PATTERN.test(title)
  );
};

const LNT_WORKFLOW_PATTERN = /l\s*&\s*t(?!\w)|larsen/i;
const BACKLOG_COLUMN_PATTERN = /^backlog$/i;

export const isLntWorkflow = (workflow) => LNT_WORKFLOW_PATTERN.test(String(workflow?.title ?? ""));

/* The L&T DA "Backlog" column, whose cards get the SCC signature check. */
export const isLntBacklog = (workflowTitle, columnTitle) =>
  LNT_WORKFLOW_PATTERN.test(String(workflowTitle ?? "")) &&
  BACKLOG_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());

const MCDERMOTT_WORKFLOW = "MCDERMOTT";

export const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);

const UPLOADED_TO_PORTAL_COLUMN_PATTERN =
  /^((uploaded|invoice\s+submitted)\s+to\s+(the\s+)?portal|dispatch\s+the\s+hard\s+copies)$/i;

/* "Uploaded to Portal" / "Invoice Submitted to Portal" / BGP's "Dispatch the Hard Copies" take one dispatch
   proof for one ticked card. */
export const isUploadedToPortalColumnTitle = (title) =>
  UPLOADED_TO_PORTAL_COLUMN_PATTERN.test(String(title ?? "").trim());

const POSH_WORKFLOW_PATTERN = /posh/i;
const POSH_ONE_CARD_COLUMN_PATTERN = /^(ar\s+invoices?\s+issued|po\s+received)$/i;

/* POSH DA requests the PO and sends the invoice one card at a time, so only one card in
   "AR Invoices Issued" or "PO Received" can stay ticked. The POs are uploaded in bulk, so
   "Requested/ Awaiting for PO" takes several. */
export const isPoshOneCardColumn = (workflow, columnTitle) =>
  POSH_WORKFLOW_PATTERN.test(String(workflow?.title ?? "")) &&
  POSH_ONE_CARD_COLUMN_PATTERN.test(String(columnTitle ?? "").trim());
