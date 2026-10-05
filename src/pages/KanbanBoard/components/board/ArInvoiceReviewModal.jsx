import { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import useArInvoiceReviewStore from "../../../../shared/store/arInvoiceReviewStore";
import { notify } from "../../../../components/Toaster";
import MaterialTablePagination from "../../CardFormTabs/Import/tabs/husbandry/components/MaterialTablePagination";
import "../../../../design/scss/blockers-modal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "../../../../design/scss/pages/kanban-board/arInvoiceReviewModal.scss";

/*
 * Review table columns, in display order. `editable` fields are read from the sales order's invoice
 * and sent to da/confirm_ar_invoices only when the user changed them; the rest are read-only.
 * New backend fields only need a line here.
 */
const COLUMNS = [
  { name: "invoice_no", label: "Invoice No", editable: "text" },
  {
    name: "se_numbers",
    label: "SE",
    getValue: (salesOrder) =>
      (salesOrder.se_numbers ?? salesOrder.invoice?.se_numbers ?? []).join(", "),
  },
  { name: "sales_order_no", label: "SO", getValue: (salesOrder) => salesOrder.sales_order_no },
];

/* McDermott "Issue AR Invoice" review: SO, then Invoice No. */
const MCDERMOTT_COLUMN_ORDER = ["sales_order_no", "invoice_no"];
const MCDERMOTT_COLUMNS = MCDERMOTT_COLUMN_ORDER.map((name) =>
  COLUMNS.find((column) => column.name === name)
);
/* The invoice's tax details: one line per tax rate, each on its own row under the sales order
   (0% first), laid out like the invoice's own block. Every cell is editable.
   Hidden for now on request: restore the fields below, the SAR header rows and the tax-line split in
   renderCardRows to bring them back. With no fields, tax_details is never sent. */
const TAX_FIELDS = [
  // { name: "tax_percent", label: "Tax %" },
  // { name: "net", label: "Net" },
  // { name: "tax", label: "Tax" },
  // { name: "gross", label: "Gross" },
];

/* Invoice-style amount, e.g. 14,067.97; anything non-numeric is shown as typed. */
const formatAmount = (value) =>
  value === "" || Number.isNaN(Number(value))
    ? value
    : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Cards per page in the review table, matching da/ar_invoice_review's page size. */
const REVIEW_PAGE_SIZE = 20;

const getSalesOrderKey = (card, salesOrder) =>
  `${card.card_id}:${salesOrder.sales_order_id ?? salesOrder.sales_order_no}`;

/* Tax lines as read, 0% first. */
const getTaxLines = (salesOrder) =>
  [...(salesOrder.invoice?.tax_details ?? salesOrder.tax_details ?? [])].sort(
    (a, b) => Number(a?.tax_percent ?? 0) - Number(b?.tax_percent ?? 0)
  );

// Opened after an "SE Received" bulk invoice upload. One editable row per sales order with the
// invoice placed on it and its tax details alongside, refreshed from da/ar_invoice_review on open. Confirm
// sends the ticked cards to da/confirm_ar_invoices, which moves them to "AR Invoices Issued"
// (McDermott "Issue AR Invoice": back to Backlog).
const ArInvoiceReviewModal = ({ onConfirmed }) => {
  const show = useArInvoiceReviewStore((state) => state.showArInvoiceReviewModal);
  const cards = useArInvoiceReviewStore((state) => state.selectedArInvoiceReviewCards);
  const isLoading = useArInvoiceReviewStore((state) => state.isArInvoiceReviewLoading);
  const onClose = useArInvoiceReviewStore((state) => state.closeArInvoiceReviewModal);
  const fetchArInvoiceReview = useArInvoiceReviewStore((state) => state.fetchArInvoiceReview);
  const isConfirming = useArInvoiceReviewStore((state) => state.isConfirmingArInvoices);
  const confirmArInvoices = useArInvoiceReviewStore((state) => state.confirmArInvoices);
  const workflowId = useArInvoiceReviewStore((state) => state.selectedArInvoiceReviewWorkflowId);

  /* A workflow id means the McDermott review; SAIPEM's has none. */
  const isMcDermottReview = workflowId != null;
  const columns = isMcDermottReview ? MCDERMOTT_COLUMNS : COLUMNS;
  const editableColumns = columns.filter((column) => column.editable);
  /* The card tick comes before the configured columns, the tax columns after them. */
  const columnCount = columns.length + TAX_FIELDS.length + 1;

  /* Cards with every invoice placed start ticked; only the user's own unticks are tracked so a
     review refresh keeps them. */
  const [uncheckedCardIds, setUncheckedCardIds] = useState({});
  /* { [salesOrderKey]: { [field]: typedValue } } — only fields the user has touched. */
  const [editsByKey, setEditsByKey] = useState({});
  /* { [salesOrderKey]: { [lineIndex]: { [taxField]: typedValue } } } — only touched tax cells. */
  const [taxEditsByKey, setTaxEditsByKey] = useState({});
  /* The tax cell being typed in shows its raw number; every other cell shows the invoice format. */
  const [focusedTaxCell, setFocusedTaxCell] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!show) return;
    setUncheckedCardIds({});
    setEditsByKey({});
    setTaxEditsByKey({});
    setCurrentPage(1);
    fetchArInvoiceReview().then((errorMessage) => {
      if (errorMessage) notify(errorMessage, "error");
    });
  }, [show, fetchArInvoiceReview]);

  const isCardChecked = (card) => Boolean(card.ready) && !uncheckedCardIds[card.card_id];

  const toggleCard = (card) =>
    setUncheckedCardIds((prev) => ({ ...prev, [card.card_id]: !prev[card.card_id] }));

  const getFieldValue = (card, salesOrder, field) =>
    editsByKey[getSalesOrderKey(card, salesOrder)]?.[field] ?? salesOrder.invoice?.[field] ?? "";

  const setFieldValue = (key, field, value) =>
    setEditsByKey((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const getTaxValue = (key, lines, index, field) =>
    taxEditsByKey[key]?.[index]?.[field] ?? lines[index]?.[field] ?? "";

  const setTaxValue = (key, index, field, value) =>
    setTaxEditsByKey((prev) => ({
      ...prev,
      [key]: { ...prev[key], [index]: { ...prev[key]?.[index], [field]: value } },
    }));

  const checkedCards = cards.filter(isCardChecked);

  /* Ticks, edits and Confirm cover every page; only the rows shown are paged. */
  const totalPages = Math.max(1, Math.ceil(cards.length / REVIEW_PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageCards = cards.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE);

  /* Header tick: selects / clears every card that can be confirmed, for large uploads. */
  const readyCards = cards.filter((card) => card.ready);
  const isAllChecked = readyCards.length > 0 && checkedCards.length === readyCards.length;
  const isSomeChecked = checkedCards.length > 0 && !isAllChecked;

  const toggleAllCards = () =>
    setUncheckedCardIds(
      isAllChecked ? Object.fromEntries(readyCards.map((card) => [card.card_id, true])) : {}
    );

  /* Editable fields are sent only when the user changed them; the backend keeps the values as
     read otherwise. An emptied field is kept as "" so it fails validation below. */
  const getEditedFields = (card, salesOrder) => {
    const key = getSalesOrderKey(card, salesOrder);
    const edits = editsByKey[key] ?? {};
    const changed = {};
    editableColumns.forEach(({ name }) => {
      if (edits[name] == null) return;
      const value = String(edits[name]).trim();
      if (value !== String(salesOrder.invoice?.[name] ?? "")) changed[name] = value;
    });

    /* Tax details go as the whole edited list once any cell differs from what was read. */
    const lines = getTaxLines(salesOrder);
    const taxEdits = taxEditsByKey[key] ?? {};
    let isTaxChanged = false;
    const taxDetails = lines.map((line, index) =>
      Object.fromEntries(
        TAX_FIELDS.map(({ name }) => {
          const edited = taxEdits[index]?.[name];
          if (edited == null) return [name, line[name]];
          const raw = String(edited).trim();
          const amount = raw === "" ? "" : Number(raw);
          if (amount !== Number(line[name])) isTaxChanged = true;
          return [name, amount];
        })
      )
    );
    if (isTaxChanged) changed.tax_details = taxDetails;
    return changed;
  };

  const confirmPayload = checkedCards.map((card) => ({
    call_id: card.call_id,
    card_id: card.card_id,
    sales_orders: (card.sales_orders ?? []).map((salesOrder) => ({
      sales_order_no: salesOrder.sales_order_no,
      invoice_id: salesOrder.invoice?.invoice_id ?? null,
      ...getEditedFields(card, salesOrder),
    })),
  }));

  const handleConfirm = async () => {
    if (isConfirming || !confirmPayload.length) return;
    const salesOrders = confirmPayload.flatMap((card) => card.sales_orders);
    if (salesOrders.some((salesOrder) => salesOrder.invoice_no === "")) {
      notify("Invoice number cannot be empty", "error");
      return;
    }
    if (
      salesOrders.some((salesOrder) =>
        (salesOrder.tax_details ?? []).some((line) =>
          TAX_FIELDS.some(({ name }) => {
            const amount = line[name];
            return amount === "" || Number.isNaN(amount) || amount < 0;
          })
        )
      )
    ) {
      notify("Tax details must be valid numbers of 0 or more", "error");
      return;
    }
    const { errorMessage, result } = await confirmArInvoices(confirmPayload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    /* McDermott: confirmed cards go back to Backlog; cards still missing invoices stay put. */
    const movedCount =
      (isMcDermottReview ? result?.moved_to_backlog : result?.moved_to_ar_invoices_issued)
        ?.length ?? confirmPayload.length;
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to ${
        isMcDermottReview ? "Backlog" : "AR Invoices Issued"
      }`,
      "success"
    );
    onClose();
    onConfirmed?.();
  };

  const renderCell = (card, salesOrder, column) => {
    if (!column.editable) return column.getValue(salesOrder) || "-";
    if (!salesOrder.invoice) {
      return column.name === "invoice_no" ? (
        <span className="ar-invoice-review__missing">Not uploaded</span>
      ) : (
        "-"
      );
    }
    return (
      <input
        type="text"
        className="form-control form-control-sm ar-invoice-review__input"
        value={getFieldValue(card, salesOrder, column.name)}
        onChange={(e) =>
          setFieldValue(getSalesOrderKey(card, salesOrder), column.name, e.target.value)
        }
        disabled={isConfirming}
        title="Click to edit"
        aria-label={`${column.label} for ${salesOrder.sales_order_no}`}
      />
    );
  };

  const renderTaxInput = (card, salesOrder, lines, index, field) => {
    const key = getSalesOrderKey(card, salesOrder);
    const cellId = `${key}:${index}:${field.name}`;
    const value = getTaxValue(key, lines, index, field.name);
    return (
      <input
        type="text"
        inputMode="decimal"
        className="form-control form-control-sm ar-invoice-review__tax-input"
        value={focusedTaxCell === cellId ? value : formatAmount(value)}
        onFocus={() => setFocusedTaxCell(cellId)}
        onBlur={() => setFocusedTaxCell("")}
        onChange={(e) => setTaxValue(key, index, field.name, e.target.value)}
        disabled={isConfirming}
        aria-label={`${field.label} for ${salesOrder.sales_order_no}, line ${index + 1}`}
      />
    );
  };

  /* A sales order takes one row per tax line (one row when it has none); its Invoice No / SE / SO
     cells span those rows, and the card's tick cell spans all of the card's rows. */
  const renderCardRows = (card) => {
    const salesOrders = card.sales_orders?.length ? card.sales_orders : [null];
    const rows = salesOrders.flatMap((salesOrder) => {
      /* Tax details hidden for now: one row per sales order. */
      const lines = [];
      // const lines = salesOrder?.invoice ? getTaxLines(salesOrder) : [];
      return lines.length
        ? lines.map((_, lineIndex) => ({ salesOrder, lines, lineIndex }))
        : [{ salesOrder, lines, lineIndex: 0 }];
    });

    return rows.map(({ salesOrder, lines, lineIndex }, rowIndex) => {
      const lineCount = Math.max(lines.length, 1);
      const rowKey = salesOrder
        ? `${getSalesOrderKey(card, salesOrder)}:${lineIndex}`
        : `${card.card_id}:empty`;
      return (
        <tr
          key={rowKey}
          className={
            lineIndex < lineCount - 1 ? "ar-invoice-review__row--has-next-line" : undefined
          }
        >
          {rowIndex === 0 && (
            <td rowSpan={rows.length} className="ar-invoice-review__card-cell">
              <input
                type="checkbox"
                className="form-check-input ar-invoice-review__checkbox"
                checked={isCardChecked(card)}
                onChange={() => toggleCard(card)}
                disabled={!card.ready || isConfirming}
                title={
                  card.ready
                    ? undefined
                    : "All sales orders need an invoice before this card can be confirmed"
                }
                aria-label={`Select card ${card.card_id}`}
              />
            </td>
          )}
          {!salesOrder && (
            <td colSpan={columnCount - 1} className="ar-invoice-review__empty">
              No sales orders
            </td>
          )}
          {salesOrder &&
            lineIndex === 0 &&
            columns.map((column) => (
              <td key={column.name} rowSpan={lineCount}>
                {renderCell(card, salesOrder, column)}
              </td>
            ))}
          {salesOrder &&
            TAX_FIELDS.map((field) => (
              <td key={field.name} className="ar-invoice-review__tax-cell">
                {lines.length ? renderTaxInput(card, salesOrder, lines, lineIndex, field) : "-"}
              </td>
            ))}
        </tr>
      );
    });
  };

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Cards:</span>
          <span className="se-review-move-batch__title">{cards.length}</span>
          <span className="se-review-move-batch__count">
            {checkedCards.length} selected
            {isLoading ? " (refreshing...)" : ""}
          </span>
        </div>
      </div>

      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
        <table className="blockers-table ar-invoice-review__grid">
          <thead>
            <tr>
              <th rowSpan={2} className="ar-invoice-review__card-head">
                <input
                  type="checkbox"
                  className="form-check-input ar-invoice-review__checkbox"
                  checked={isAllChecked}
                  ref={(element) => {
                    if (element) element.indeterminate = isSomeChecked;
                  }}
                  onChange={toggleAllCards}
                  disabled={!readyCards.length || isConfirming}
                  aria-label="Select all cards"
                />
              </th>
              {columns.map((column) => (
                <th key={column.name} rowSpan={2}>
                  {column.label}
                </th>
              ))}
              {/* Tax details hidden for now.
              <th colSpan={TAX_FIELDS.length} className="ar-invoice-review__tax-group">
                SAR
              </th> */}
            </tr>
            {/* Tax details hidden for now.
            <tr>
              {TAX_FIELDS.map(({ name, label }) => (
                <th key={name} className="ar-invoice-review__tax-head">
                  {label}
                </th>
              ))}
            </tr> */}
          </thead>
          <tbody>
            {cards.length ? (
              pageCards.map((card) => (
                <Fragment key={card.card_id ?? card.call_id}>{renderCardRows(card)}</Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={columnCount} className="ar-invoice-review__empty">
                  {isLoading ? "Loading..." : "No cards to review"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <div className="ar-invoice-review__pagination">
          <MaterialTablePagination
            page={page}
            total={cards.length}
            limit={REVIEW_PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Invoice Review</h5>
        <p className="blockers-modal-subtitle">Check the invoices, then confirm the ticked cards</p>
      </div>
      <button
        type="button"
        className="blockers-modal-close"
        onClick={onClose}
        disabled={isConfirming}
        aria-label="Close"
      >
        <FiX size={20} />
      </button>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isConfirming}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={isConfirming || isLoading || !checkedCards.length}
      >
        <FiCheck className="me-2" />
        {isConfirming ? "Confirming..." : `Confirm (${checkedCards.length})`}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal se-review-move-modal ar-invoice-review-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

ArInvoiceReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default ArInvoiceReviewModal;
