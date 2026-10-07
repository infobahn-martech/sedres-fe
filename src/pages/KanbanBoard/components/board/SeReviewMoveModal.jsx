import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiEye, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import useBatchMoveStore from "../../../../shared/store/batchMoveStore";
import { notify } from "../../../../components/Toaster";
import { getUploadedFileUrl, viewUploadedFile } from "../../../../shared/utils/viewUploadedFile";
import "../../../../design/scss/blockers-modal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";

const SE_DOCUMENT_KEY_PATTERN = /doc|excel|sheet/i;
const SE_EMAIL_KEY_PATTERN = /email|mail/i;

// Opened from an "Awaiting SE" batch's "Review and Move" action once its SE upload is done.
// Lists the batch's approved sales orders, fetched from da/se_approval_lines on open. Confirm moves
// the approved cards to "SE Received" and returns the rest of the batch to Backlog.
// Built on the common CustomModal with the Blockers modal look (blockers-modal-* classes).
const SeReviewMoveModal = ({ onConfirmed }) => {
  const show = useBatchMoveStore((state) => state.showSeReviewMoveModal);
  const selectedBatch = useBatchMoveStore((state) => state.selectedSeReviewBatch);
  const onClose = useBatchMoveStore((state) => state.closeSeReviewMoveModal);
  const seReview = useBatchMoveStore((state) => state.seReviewByBatchId[selectedBatch?.batchId]);
  const seTickedByCardId = useBatchMoveStore((state) => state.seTickedByCardId);
  const isLoading = useBatchMoveStore((state) => state.isSeReviewLoading);
  const fetchSeReview = useBatchMoveStore((state) => state.fetchSeReview);
  const isConfirming = useBatchMoveStore((state) => state.isConfirmingSeReview);
  const confirmSeReview = useBatchMoveStore((state) => state.confirmSeReview);

  useEffect(() => {
    if (!show || selectedBatch?.batchId == null) return;
    fetchSeReview(selectedBatch.batchId).then((errorMessage) => {
      if (errorMessage) notify(errorMessage, "error");
    });
  }, [show, selectedBatch?.batchId, fetchSeReview]);

  const approvedSalesOrders = useMemo(
    () =>
      (seReview?.cards ?? [])
        .filter((card) => seTickedByCardId[String(card?.card_id)])
        .flatMap((card) =>
          (card?.sales_orders ?? [])
            .filter((salesOrder) => salesOrder?.approved)
            .map((salesOrder) => ({
              ...salesOrder,
              seDocumentUrl: getUploadedFileUrl(SE_DOCUMENT_KEY_PATTERN, salesOrder, card, seReview),
              seEmailUrl: getUploadedFileUrl(SE_EMAIL_KEY_PATTERN, salesOrder, card, seReview),
            }))
        ),
    [seReview, seTickedByCardId]
  );

  const handleConfirm = async () => {
    if (isConfirming) return;
    const { errorMessage, result } = await confirmSeReview(
      selectedBatch?.batchId,
      (selectedBatch?.cards ?? []).map((card) => card.id)
    );
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const movedCount = result?.moved_to_se_received?.length ?? 0;
    const returnedCount = result?.returned_to_backlog?.length ?? 0;
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to SE Received, ${returnedCount} returned to Backlog`,
      "success"
    );
    onClose();
    onConfirmed?.();
  };

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Review and Move</h5>
        <p className="blockers-modal-subtitle">Approved sales orders for this batch</p>
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

  const renderViewButton = (label, url, kind) => (
    <button
      type="button"
      className="se-review-move-view-btn"
      onClick={() => viewUploadedFile(url, kind)}
      disabled={!url}
      title={url ? `View the ${label} in a new tab` : `No ${label} uploaded`}
    >
      <FiEye size={14} />
      {label}
    </button>
  );

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Batch:</span>
          <span className="se-review-move-batch__title" title={selectedBatch?.title}>
            {seReview?.batch_number || selectedBatch?.title || "-"}
          </span>
          <span className="se-review-move-batch__count">
            {approvedSalesOrders.length} approved {approvedSalesOrders.length === 1 ? "SO" : "SOs"}
          </span>
        </div>
      </div>

      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
          <table className="blockers-table">
            <thead>
              <tr>
                <th>SO</th>
                <th>WO</th>
                <th>Project Split</th>
                <th>SE Nos</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !approvedSalesOrders.length ? (
                <tr>
                  <td colSpan={5} className="se-review-move-empty">
                    Loading...
                  </td>
                </tr>
              ) : approvedSalesOrders.length ? (
                approvedSalesOrders.map((salesOrder) => (
                  <tr key={salesOrder.sales_order_id ?? salesOrder.sales_order_no}>
                    <td>
                      <span className="blockers-label-text">{salesOrder.sales_order_no || "-"}</span>
                    </td>
                    <td>{salesOrder.wo_number || "-"}</td>
                    <td>{salesOrder.project_split || "-"}</td>
                    <td>
                      {salesOrder.se_numbers?.length ? (
                        <span className="blockers-boards-cell">
                          {salesOrder.se_numbers.map((seNumber) => (
                            <span key={seNumber} className="blockers-board-badge">
                              {seNumber}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span className="se-review-move-files">
                        {renderViewButton("SE Doc", salesOrder.seDocumentUrl)}
                        {renderViewButton("Email", salesOrder.seEmailUrl, "email")}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="se-review-move-empty">
                    No approved sales orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </>
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
        disabled={isConfirming || isLoading || !approvedSalesOrders.length}
      >
        <FiCheck className="me-2" />
        {isConfirming ? "Confirming..." : "Confirm"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal se-review-move-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SeReviewMoveModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default SeReviewMoveModal;
