import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiCheckCircle, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import useBatchMoveStore from "../../../../shared/store/batchMoveStore";
import { notify } from "../../../../components/Toaster";
import "../../../../design/scss/pages/kanban-board/seApprovalUploadModal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";

// Opened from an "Awaiting SE" batch's "Review and Move" action once its SE upload is done.
// Lists the batch's approved sales orders, fetched from da/se_approval_lines on open. Confirm moves
// the approved cards to "SE Received" and returns the rest of the batch to Backlog.
const SeReviewMoveModal = ({ onConfirmed }) => {
  const show = useBatchMoveStore((state) => state.showSeReviewMoveModal);
  const selectedBatch = useBatchMoveStore((state) => state.selectedSeReviewBatch);
  const onClose = useBatchMoveStore((state) => state.closeSeReviewMoveModal);
  const seReview = useBatchMoveStore((state) => state.seReviewByBatchId[selectedBatch?.batchId]);
  const seUntickedByCardId = useBatchMoveStore((state) => state.seUntickedByCardId);
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
        .filter((card) => !seUntickedByCardId[String(card?.card_id)])
        .flatMap((card) => (card?.sales_orders ?? []).filter((salesOrder) => salesOrder?.approved)),
    [seReview, seUntickedByCardId]
  );

  const handleConfirm = async () => {
    if (isConfirming) return;
    const { errorMessage, result } = await confirmSeReview(selectedBatch?.batchId);
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
    <div className="se-approval-header">
      <span className="se-approval-header__icon">
        <FiCheckCircle />
      </span>
      <div className="se-approval-header__text">
        <h5 className="se-approval-header__title">Review and Move</h5>
        <p className="se-approval-header__subtitle">Approved sales orders for this batch</p>
      </div>
      <button type="button" className="se-approval-header__close" onClick={onClose} disabled={isConfirming} aria-label="Close">
        <FiX />
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body se-approval-body">
      <div className="se-approval-batch">
        <FiLayers className="se-approval-batch__icon" />
        <span className="se-approval-batch__caption">Batch:</span>
        <span className="se-approval-batch__title" title={selectedBatch?.title}>
          {seReview?.batch_number || selectedBatch?.title || "-"}
        </span>
        <span className="se-approval-batch__count">
          {approvedSalesOrders.length} approved {approvedSalesOrders.length === 1 ? "SO" : "SOs"}
        </span>
      </div>

      <div className="se-review-table">
        <table className="se-review-table__grid">
          <thead>
            <tr>
              <th>SO</th>
              <th>WO</th>
              <th>Project Split</th>
              <th>SE Nos</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !approvedSalesOrders.length ? (
              <tr>
                <td colSpan={4} className="se-review-table__empty">
                  Loading...
                </td>
              </tr>
            ) : approvedSalesOrders.length ? (
              approvedSalesOrders.map((salesOrder) => (
                <tr key={salesOrder.sales_order_id ?? salesOrder.sales_order_no}>
                  <td>{salesOrder.sales_order_no || "-"}</td>
                  <td>{salesOrder.wo_number || "-"}</td>
                  <td>{salesOrder.project_split || "-"}</td>
                  <td>{salesOrder.se_numbers?.length ? salesOrder.se_numbers.join(", ") : "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="se-review-table__empty">
                  No approved sales orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-approval-footer">
      <button type="button" className="se-approval-footer__cancel" onClick={onClose} disabled={isConfirming}>
        Close
      </button>
      <button
        type="button"
        className="se-approval-footer__upload"
        onClick={handleConfirm}
        disabled={isConfirming || isLoading || !approvedSalesOrders.length}
      >
        <FiCheck />
        {isConfirming ? "Confirming..." : "Confirm"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="se-approval-modal-root se-review-move-modal-root"
      dialgName="se-approval-dialog"
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
