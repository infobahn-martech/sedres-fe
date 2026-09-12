import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import salesOrderService from "../../../../services/salesOrderService";
import { mapSalesOrderResponse } from "../../../../shared/helpers/mapSalesOrderResponse";
import { notify } from "../../../../components/Toaster";
import CustomModal from "../../../../components/CustomModal";
import GeneratePOModal from "../../CardFormTabs/Import/tabs/salesOrder/GeneratePOModal";
import "../../../../design/scss/salesOrder.scss";
import "../../../../design/scss/pages/kanban-board/salesOrderPoModal.scss";

/**
 * Board-level modal: lists every selected card's Sales Order (one row per card) and lets
 * the user generate a PO for any eligible row via the existing GeneratePOModal. Rows are
 * independent — generating a PO for one card never touches another card's Sales Order.
 */
export default function SalesOrderPoModal({ show, cards = [], onClose, onGenerated }) {
  const [rowState, setRowState] = useState({});
  const [activeCardId, setActiveCardId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showGeneratePOModal, setShowGeneratePOModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const cardIdsKey = cards.map((c) => c.id).join(",");

  const loadCard = (card) => {
    const callId = card?.callId || "";
    if (!callId) {
      setRowState((prev) => ({
        ...prev,
        [card.id]: { loading: false, error: "No call identifier available for this card.", mapped: null },
      }));
      return;
    }
    setRowState((prev) => ({ ...prev, [card.id]: { loading: true, error: null, mapped: prev[card.id]?.mapped ?? null } }));
    salesOrderService
      .getSoItemsByCall(callId)
      .then((response) => {
        const body = response?.data;
        if (body?.status !== "success" || !body?.data) {
          setRowState((prev) => ({
            ...prev,
            [card.id]: {
              loading: false,
              error: typeof body?.message === "string" ? body.message : "Failed to load sales order.",
              mapped: null,
            },
          }));
          return;
        }
        setRowState((prev) => ({
          ...prev,
          [card.id]: { loading: false, error: null, mapped: mapSalesOrderResponse(body.data) },
        }));
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? "Failed to load sales order.";
        setRowState((prev) => ({ ...prev, [card.id]: { loading: false, error: msg, mapped: null } }));
      });
  };

  useEffect(() => {
    if (!show) return;
    cards.forEach((card) => loadCard(card));
    // Re-run only when the visible card set changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, cardIdsKey]);

  useEffect(() => {
    if (!show) {
      setActiveCardId(null);
      setShowConfirm(false);
      setShowGeneratePOModal(false);
      setSubmitError(null);
    }
  }, [show]);

  const activeMapped = activeCardId ? rowState[activeCardId]?.mapped : null;
  const activeEligibleItems = useMemo(
    () => (activeMapped?.salesOrderList || []).filter((item) => !item.poId),
    [activeMapped]
  );

  const handleRowGenerateClick = (cardId) => {
    setActiveCardId(cardId);
    setShowConfirm(true);
  };

  const handleGeneratePO = (payload) => {
    if (isSubmitting || !activeCardId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    salesOrderService
      .generatePO({
        so_item_ids: activeEligibleItems.map((item) => item.id),
        vendor_id: payload.vendorId || undefined,
        vendor_ref_no: payload.vendorRefNo || undefined,
        contact_person: activeMapped?.soContactPerson || undefined,
        branch: activeMapped?.branch || undefined,
        currency: activeMapped?.soBpCurrency || undefined,
        delivery_date: payload.deliveryDate || undefined,
        document_date: payload.documentDate || undefined,
        discount_percentage: payload.discountPercentage,
        rounding: payload.rounding,
        remarks: payload.remarks || undefined,
      })
      .then((response) => {
        const body = response?.data;
        if (body?.status !== "success") {
          throw new Error(typeof body?.message === "string" ? body.message : "Failed to generate purchase order.");
        }
        notify("Purchase order generated successfully.", "success");
        setShowGeneratePOModal(false);
        const generatedCard = cards.find((c) => c.id === activeCardId);
        if (generatedCard) loadCard(generatedCard);
        onGenerated?.();
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? "Failed to generate purchase order.";
        setSubmitError(msg);
        notify(msg, "error");
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <>
      {show && (
        <div className="board-so-modal-backdrop" onClick={() => !isSubmitting && onClose()}>
          <div className="board-so-modal" onClick={(e) => e.stopPropagation()}>
            <div className="board-so-modal-header">
              <h3>Sales Orders &amp; Documents</h3>
              <button type="button" className="board-so-modal-close" onClick={onClose} disabled={isSubmitting}>
                ×
              </button>
            </div>

            <div className="board-so-modal-body">
              <div className="board-so-table-wrapper">
                <table className="board-so-table">
                  <thead>
                    <tr>
                      <th>Sales Order No.</th>
                      <th>Document Date</th>
                      <th style={{ width: 160 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => {
                      const row = rowState[card.id];
                      if (!row || row.loading) {
                        return (
                          <tr key={card.id}>
                            <td colSpan={3} className="board-so-modal-status">
                              Loading sales order...
                            </td>
                          </tr>
                        );
                      }
                      if (row.error) {
                        return (
                          <tr key={card.id}>
                            <td colSpan={3} className="board-so-modal-status board-so-modal-error">
                              {row.error}
                            </td>
                          </tr>
                        );
                      }
                      const mapped = row.mapped;
                      if (!mapped?.soSoNo) {
                        return (
                          <tr key={card.id}>
                            <td colSpan={3} className="board-so-modal-status">
                              No sales order found for this call.
                            </td>
                          </tr>
                        );
                      }
                      const eligibleItems = (mapped.salesOrderList || []).filter((item) => !item.poId);
                      const isPoGenerated = (mapped.salesOrderList?.length || 0) > 0 && eligibleItems.length === 0;
                      const documentCount = (mapped.salesOrderList || []).reduce(
                        (sum, item) => sum + (item.documents?.length || 0),
                        0
                      );
                      return (
                        <tr key={card.id}>
                          <td>
                            <span className="board-so-so-number">{mapped.soSoNo}</span>
                            {isPoGenerated && (
                              <span className="board-so-pill board-so-pill--generated">PO Generated</span>
                            )}
                          </td>
                          <td>
                            {mapped.soDocumentDate || "—"}
                            {documentCount > 0 && (
                              <span className="board-so-doc-count">
                                {documentCount} document{documentCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="board-so-btn board-so-btn-generate board-so-btn-row"
                              disabled={isPoGenerated || eligibleItems.length === 0}
                              onClick={() => handleRowGenerateClick(card.id)}
                            >
                              {isPoGenerated ? "PO Generated" : "Generate PO"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="board-so-modal-footer">
              <button type="button" className="board-so-btn board-so-btn-cancel" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomModal
        show={showConfirm}
        closeModal={() => setShowConfirm(false)}
        createModal
        header={<h5 className="m-0">Confirm Generate PO</h5>}
        body={<p className="mb-0">This will generate a purchase order for this sales order. Continue?</p>}
        footer={
          <div className="d-flex justify-content-end gap-2 p-3 pt-0">
            <button type="button" className="board-so-btn board-so-btn-cancel" onClick={() => setShowConfirm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="board-so-btn board-so-btn-generate"
              onClick={() => {
                setShowConfirm(false);
                setShowGeneratePOModal(true);
              }}
            >
              Confirm
            </button>
          </div>
        }
      />

      <GeneratePOModal
        show={showGeneratePOModal}
        onClose={() => !isSubmitting && setShowGeneratePOModal(false)}
        onGenerate={handleGeneratePO}
        isSubmitting={isSubmitting}
        error={submitError}
        selectedItems={activeEligibleItems.map((item) => item.id)}
        salesOrderList={activeMapped?.salesOrderList || []}
        soNumber={activeMapped?.soSoNo}
        status={activeMapped?.soStatus}
        postingDate={activeMapped?.soPostingDate}
        deliveryDate={activeMapped?.soDeliveryDate}
        documentDate={activeMapped?.soDocumentDate}
        branch={activeMapped?.branch}
        contactPerson={activeMapped?.soContactPerson}
        localCurrency={activeMapped?.soBpCurrency}
        owner={activeMapped?.soOwner}
        initialDiscountPercentage={activeMapped?.soDiscountPercentage || 0}
      />
    </>
  );
}

SalesOrderPoModal.propTypes = {
  show: PropTypes.bool.isRequired,
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      callId: PropTypes.string,
    })
  ),
  onClose: PropTypes.func.isRequired,
  onGenerated: PropTypes.func,
};
