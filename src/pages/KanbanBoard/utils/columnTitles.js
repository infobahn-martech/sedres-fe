const SUBMITTED_INVOICES_COLUMN_PATTERN = /^submitted\s+invoices$/i;

/* "Submitted Invoices" holds finished work: its batches start collapsed and have no header action, and
   its cards carry no checkbox. */
export const isSubmittedInvoicesColumnTitle = (title) =>
  SUBMITTED_INVOICES_COLUMN_PATTERN.test(String(title ?? "").trim());

const ARCHIVE_COLUMN_PATTERN = /archive/i;
const SRF_SOURCE_COLUMN_PATTERN = /^submitted\s+to\s+da$/i;

/* The last working column of a flow (the one right before "Ready to Archive") holds finished cards, so
   its cards carry no checkbox. "Submitted to DA" keeps its ticks because they drive Upload SRF. */
export const isColumnBeforeArchive = (workflow, colKey) => {
  const order = workflow?.columnOrder ?? [];
  const index = order.indexOf(colKey);
  if (index === -1 || index === order.length - 1) return false;
  const title = String(workflow.columns[colKey]?.title ?? "").trim();
  const nextTitle = String(workflow.columns[order[index + 1]]?.title ?? "");
  return (
    ARCHIVE_COLUMN_PATTERN.test(nextTitle) &&
    !ARCHIVE_COLUMN_PATTERN.test(title) &&
    !SRF_SOURCE_COLUMN_PATTERN.test(title)
  );
};

const MCDERMOTT_WORKFLOW = "MCDERMOTT";

export const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);
