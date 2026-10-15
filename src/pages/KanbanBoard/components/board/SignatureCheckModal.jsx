import { useEffect } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import useSignatureCheckStore from "../../../../shared/store/signatureCheckStore";
import { notify } from "../../../../components/Toaster";
import "../../../../design/scss/blockers-modal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "../../../../design/scss/pages/kanban-board/signatureCheck.scss";

// Opened from the L&T Backlog "Check Signatures" action. One row per ticked card from
// da/signature_checks; a card without a signature can be ticked "Signed (checked by hand)". Move signed
// cards sends them to da/confirm_signature_check.
const SignatureCheckModal = ({ onConfirmed }) => {
  const show = useSignatureCheckStore((state) => state.showSignatureCheckModal);
  const selectedCards = useSignatureCheckStore((state) => state.selectedSignatureCheckCards);
  const rows = useSignatureCheckStore((state) => state.signatureCheckRows);
  const handSignedByCardId = useSignatureCheckStore((state) => state.handSignedByCardId);
  const isLoading = useSignatureCheckStore((state) => state.isSignatureCheckLoading);
  const isConfirming = useSignatureCheckStore((state) => state.isConfirmingSignatureCheck);
  const onClose = useSignatureCheckStore((state) => state.closeSignatureCheckModal);
  const fetchSignatureChecks = useSignatureCheckStore((state) => state.fetchSignatureChecks);
  const toggleHandSigned = useSignatureCheckStore((state) => state.toggleHandSigned);
  const confirmSignatureCheck = useSignatureCheckStore((state) => state.confirmSignatureCheck);

  useEffect(() => {
    if (!show) return;
    fetchSignatureChecks().then((errorMessage) => {
      if (errorMessage) notify(errorMessage, "error");
    });
  }, [show, selectedCards, fetchSignatureChecks]);

  const handleConfirm = async () => {
    if (isConfirming) return;
    const { errorMessage, result } = await confirmSignatureCheck();
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const movedCount = result?.moved_to_convert_ar_invoice?.length ?? 0;
    const notMoved = result?.not_moved ?? [];
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to Convert to AR Invoice` +
        (notMoved.length ? `, ${notMoved.length} not moved` : ""),
      movedCount ? "success" : "error"
    );
    onClose();
    onConfirmed?.();
  };

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Signature Check</h5>
        <p className="blockers-modal-subtitle">SCC signatures of the selected cards</p>
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

  const renderRow = (row) => {
    const isSigned = row.status === "signed";
    const isHandSigned = !isSigned && Boolean(handSignedByCardId[String(row.card_id)]);
    const isReady = isSigned || isHandSigned || Boolean(row.ready);
    const scc = row.documents?.scc;
    return (
      <tr key={row.card_id}>
        <td>
          <span className="signature-check-so">
            {(row.sales_orders ?? []).length
              ? row.sales_orders.map((salesOrderNo) => (
                  <span key={salesOrderNo} className="blockers-label-text">
                    {salesOrderNo}
                  </span>
                ))
              : "-"}
          </span>
        </td>
        <td>
          {scc?.url ? (
            <a className="signature-check-link" href={scc.url} target="_blank" rel="noopener noreferrer">
              {scc.name || "SCC"}
            </a>
          ) : (
            "-"
          )}
        </td>
        <td>
          <span className={`signature-check-state ${isSigned ? "signature-check-state--ok" : "signature-check-state--bad"}`}>
            {isSigned ? "✅ Signed" : "❌ No signature found"}
          </span>
        </td>
        <td>
          <span className={`signature-check-state ${isReady ? "signature-check-state--ok" : "signature-check-state--bad"}`}>
            {isReady ? "Ready to move" : "Signature missing"}
          </span>
        </td>
        <td>
          {!isSigned && (
            <label className="signature-check-hand">
              <input
                type="checkbox"
                checked={isHandSigned}
                onChange={() => toggleHandSigned(row.card_id)}
                disabled={isConfirming}
              />
              Signed (checked by hand)
            </label>
          )}
        </td>
      </tr>
    );
  };

  const renderBody = () => (
    <div className="blockers-table-section">
      <div className="blockers-table-wrapper">
        <table className="blockers-table">
          <thead>
            <tr>
              <th>SO</th>
              <th>SCC</th>
              <th>Signature</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && !rows.length ? (
              <tr>
                <td colSpan={5} className="signature-check-empty">
                  Loading...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map(renderRow)
            ) : (
              <tr>
                <td colSpan={5} className="signature-check-empty">
                  No signature checks found for the selected cards
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer signature-check-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isConfirming}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={isConfirming || isLoading || !rows.length}
      >
        <FiCheck className="me-2" />
        {isConfirming ? "Moving..." : "Move signed cards"}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal signature-check-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

SignatureCheckModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default SignatureCheckModal;
