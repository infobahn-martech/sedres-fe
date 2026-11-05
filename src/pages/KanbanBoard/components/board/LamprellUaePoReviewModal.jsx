import { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheck, FiLayers, FiUploadCloud, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useLamprellUaePoApprovalStore, { LAMPRELL_UAE_PO_COLUMNS } from "@/store/lamprellUaePoApprovalStore";
import { notify } from "@/components/Toaster";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "@/design/scss/pages/kanban-board/lamprellUaePoReviewModal.scss";

const COLUMNS = LAMPRELL_UAE_PO_COLUMNS;

const ENTRY_MODES = {
  AI: "ai",
  MANUAL: "manual",
};

const ENTRY_MODE_OPTIONS = [
  { value: ENTRY_MODES.MANUAL, label: "Enter manually" },
  { value: ENTRY_MODES.AI, label: "Upload with AI" },
];

const ACCEPTED_REPLY_EXTENSIONS = ["pdf", "eml", "msg", "jpg", "jpeg", "png"];
const ACCEPTED_REPLY_TYPES = ACCEPTED_REPLY_EXTENSIONS.map((extension) => `.${extension}`).join(",");

// Opened by a Lamprell UAE "Upload PO": one blank row per ticked card to fill by hand, or upload the client's
// reply to pre-fill one row per sales order. Every field is editable. Confirm sends the ticked cards to
// da/confirm_po_approval, with the uploaded reply's document_id when there is one.
const LamprellUaePoReviewModal = ({ onConfirmed }) => {
  const show = useLamprellUaePoApprovalStore((state) => state.showPoReviewModal);
  const reviewCards = useLamprellUaePoApprovalStore((state) => state.poReviewCards);
  const onClose = useLamprellUaePoApprovalStore((state) => state.closePoReviewModal);
  const isConfirming = useLamprellUaePoApprovalStore((state) => state.isPoConfirming);
  const confirmPo = useLamprellUaePoApprovalStore((state) => state.confirmPo);
  const uploadPo = useLamprellUaePoApprovalStore((state) => state.uploadPo);
  const isUploading = useLamprellUaePoApprovalStore((state) => state.isPoUploading);
  const documentName = useLamprellUaePoApprovalStore((state) => state.poReviewDocumentName);
  const isBusy = isConfirming || isUploading;
  const [isDragging, setIsDragging] = useState(false);
  const [entryMode, setEntryMode] = useState(ENTRY_MODES.MANUAL);
  const fileInputRef = useRef(null);

  const [cards, setCards] = useState([]);
  const [uncheckedCardIds, setUncheckedCardIds] = useState({});

  useEffect(() => {
    if (!show) return;
    setEntryMode(ENTRY_MODES.MANUAL);
    setCards(reviewCards);
    setUncheckedCardIds({});
  }, [show, reviewCards]);

  const isCardChecked = (card) => !uncheckedCardIds[card.card_id];
  const checkedCards = cards.filter(isCardChecked);
  const isAllChecked = cards.length > 0 && checkedCards.length === cards.length;
  const isSomeChecked = checkedCards.length > 0 && !isAllChecked;

  const toggleCard = (card) => setUncheckedCardIds((prev) => ({ ...prev, [card.card_id]: !prev[card.card_id] }));

  const toggleAllCards = () =>
    setUncheckedCardIds(isAllChecked ? Object.fromEntries(cards.map((card) => [card.card_id, true])) : {});

  const updateField = (cardId, rowIndex, name, value) =>
    setCards((prev) =>
      prev.map((card) =>
        card.card_id === cardId
          ? {
              ...card,
              sales_orders: card.sales_orders.map((salesOrder, index) =>
                index === rowIndex ? { ...salesOrder, [name]: value } : salesOrder
              ),
            }
          : card
      )
    );

  const uploadReply = async (file) => {
    if (!file || isBusy) return;
    if (!ACCEPTED_REPLY_EXTENSIONS.includes(file.name.split(".").pop().toLowerCase())) {
      notify("Unsupported file type. Use PDF, EML, MSG, JPG or PNG", "error");
      return;
    }
    const { ok, message } = await uploadPo(file);
    if (!ok) notify(message, "error");
  };

  const handleConfirm = async () => {
    if (isConfirming || !checkedCards.length) return;
    const payload = checkedCards.map((card) => ({
      call_id: card.call_id,
      card_id: card.card_id,
      sales_orders: card.sales_orders.map((salesOrder) =>
        Object.fromEntries(COLUMNS.map((column) => [column.name, String(salesOrder[column.name] ?? "").trim()]))
      ),
    }));
    const { ok, message, result } = await confirmPo(payload);
    if (!ok) {
      notify(message, "error");
      return;
    }
    const movedToDaCount = result?.moved_to_da?.length ?? 0;
    const movedCount = movedToDaCount || (result?.moved_to_po_received?.length ?? payload.length);
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to ${movedToDaCount ? "the DA board" : "PO Received"}`,
      "success"
    );
    onConfirmed?.(payload.map((card) => card.card_id));
  };

  const renderCardRows = (card) =>
    card.sales_orders.map((salesOrder, rowIndex) => (
      <tr key={`${card.card_id}:${rowIndex}`}>
        {rowIndex === 0 && (
          <td rowSpan={card.sales_orders.length} className="ar-invoice-review__card-cell">
            <input
              type="checkbox"
              className="form-check-input ar-invoice-review__checkbox"
              checked={isCardChecked(card)}
              onChange={() => toggleCard(card)}
              disabled={isBusy}
              aria-label={`Select card ${card.card_id}`}
            />
          </td>
        )}
        {COLUMNS.map((column) => (
          <td key={column.name}>
            <input
              type="text"
              className="form-control form-control-sm ar-invoice-review__input"
              value={salesOrder[column.name] ?? ""}
              onChange={(event) => updateField(card.card_id, rowIndex, column.name, event.target.value)}
              disabled={isBusy}
              aria-label={`${column.label} for card ${card.card_id}`}
            />
            {column.name === "srn_no" && salesOrder.srn_used_by?.used_on && (
              <div className="ar-invoice-review__missing">
                <FiAlertTriangle size={12} aria-hidden /> Already used on {salesOrder.srn_used_by.used_on}
              </div>
            )}
          </td>
        ))}
      </tr>
    ));

  const renderDropzone = () => (
      <div
        className={`lamprell-po-dropzone${isDragging ? " lamprell-po-dropzone--active" : ""}${
          isBusy ? " lamprell-po-dropzone--disabled" : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
          const file = event.dataTransfer?.files?.[0];
          if (!file) {
            notify("No file received. Save the file to your computer first, then drag it here", "error");
            return;
          }
          uploadReply(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="d-none"
          accept={ACCEPTED_REPLY_TYPES}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            uploadReply(file);
          }}
        />
        <FiUploadCloud size={22} aria-hidden />
        <span className="lamprell-po-dropzone__text">
          {isUploading ? "Reading the document..." : documentName || "Drag and drop the email screenshot here"}
        </span>
        <span className="lamprell-po-dropzone__hint">
          {documentName ? "PO, SRN and Qty were read into the table below. Edit if needed." : "AI reads PO, SRN and Qty into a table you can edit - click to browse - PDF, EML, MSG, JPG, PNG"}
        </span>
      </div>
  );

  const isAiMode = entryMode === ENTRY_MODES.AI;
  const showTable = !isAiMode || Boolean(documentName);

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Cards:</span>
          <span className="se-review-move-batch__title">{cards.length}</span>
          <span className="se-review-move-batch__count">{checkedCards.length} selected</span>
        </div>
      </div>

      <div className="lamprell-po-mode" role="group" aria-label="PO entry mode">
        {ENTRY_MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`lamprell-po-mode__btn${entryMode === option.value ? " is-active" : ""}`}
            onClick={() => setEntryMode(option.value)}
            disabled={isBusy}
            aria-pressed={entryMode === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isAiMode && renderDropzone()}

      {showTable && (
      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
          <table className="blockers-table ar-invoice-review__grid">
            <thead>
              <tr>
                <th className="ar-invoice-review__card-head">
                  <input
                    type="checkbox"
                    className="form-check-input ar-invoice-review__checkbox"
                    checked={isAllChecked}
                    ref={(element) => {
                      if (element) element.indeterminate = isSomeChecked;
                    }}
                    onChange={toggleAllCards}
                    disabled={!cards.length || isBusy}
                    aria-label="Select all cards"
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.name}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.length ? (
                cards.map((card) => <Fragment key={card.card_id}>{renderCardRows(card)}</Fragment>)
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="ar-invoice-review__empty">
                    No cards to review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </>
  );

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Upload PO</h5>
        <p className="blockers-modal-subtitle">
          Upload the client's reply or enter the PO details by hand, then confirm the ticked cards
        </p>
      </div>
      <button type="button" className="blockers-modal-close" onClick={onClose} disabled={isBusy} aria-label="Close">
        <FiX size={20} />
      </button>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isBusy}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={isBusy || !checkedCards.length}
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
      className="blockers-modal se-review-move-modal ar-invoice-review-modal lamprell-uae-po-review-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

LamprellUaePoReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default LamprellUaePoReviewModal;
