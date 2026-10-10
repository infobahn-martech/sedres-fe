const SUBMITTED_INVOICES_COLUMN_PATTERN = /^submitted\s+invoices$/i;

/* "Submitted Invoices" holds finished work: its batches start collapsed and have no header action, and
   its cards carry no checkbox. */
export const isSubmittedInvoicesColumnTitle = (title) =>
  SUBMITTED_INVOICES_COLUMN_PATTERN.test(String(title ?? "").trim());

const MCDERMOTT_WORKFLOW = "MCDERMOTT";

export const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);
