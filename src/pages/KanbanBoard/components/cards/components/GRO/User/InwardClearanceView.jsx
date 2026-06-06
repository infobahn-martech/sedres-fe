import PropTypes from "prop-types";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import CustomModal from "../../../../../../../components/CustomModal";
import "../../../../../../../design/scss/modal-designs.scss";
import "../../../../../../../design/scss/prospect-modal.scss";
import { formatGroDocumentDisplayName } from "./groCardUtils";
import {
  TaskDocumentFilePreview,
  TaskDocumentItem,
  TaskDocumentList,
  TaskDocumentUploadPanel,
  GroDocumentFilePreview,
} from "../../shared/TaskDocuments";

export { GroDocumentFilePreview, TaskDocumentFilePreview };

/** @deprecated Use TaskDocumentUploadPanel — kept for GROCardView imports */
export function InwardClearanceToolbar(props) {
  return (
    <TaskDocumentUploadPanel
      anchorRef={props.inwardAnchorRef}
      fileInputRef={props.inwardFileInputRef}
      showMainFileUpload={props.showMainFileUpload}
      isOpen={props.showInwardClearance}
      onToggle={props.onToggleInwardPopover}
      actionLabel={props.inwardActionLabel}
      panelTitle={props.inwardPopoverTitle}
      file={props.inwardFile}
      onFileChange={props.onInwardFileChange}
      pickerParts={props.inwardPickerParts}
      onDateTimeChange={props.onInwardDateTimeChange}
      timeObjectFields={props.timeObjectFields}
      timeObjectsLoading={props.timeObjectsLoading}
      extraStageFieldsContent={props.extraStageFieldsContent}
      onCancel={props.onInwardCancel}
      onSubmit={props.onInwardSubmit}
      isSaving={props.isSavingInward}
      isDisabled={props.isGroLoadingDisabled}
    />
  );
}

InwardClearanceToolbar.propTypes = {
  inwardAnchorRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  inwardFileInputRef: PropTypes.shape({ current: PropTypes.any }),
  showMainFileUpload: PropTypes.bool,
  showInwardClearance: PropTypes.bool.isRequired,
  onToggleInwardPopover: PropTypes.func.isRequired,
  inwardActionLabel: PropTypes.string,
  inwardPopoverTitle: PropTypes.string,
  inwardFile: PropTypes.any,
  onInwardFileChange: PropTypes.func,
  inwardPickerParts: PropTypes.shape({
    date: PropTypes.string,
    time: PropTypes.string,
  }),
  onInwardDateTimeChange: PropTypes.func,
  timeObjectFields: PropTypes.array,
  timeObjectsLoading: PropTypes.bool,
  extraStageFieldsContent: PropTypes.node,
  onInwardCancel: PropTypes.func.isRequired,
  onInwardSubmit: PropTypes.func.isRequired,
  isSavingInward: PropTypes.bool.isRequired,
  isGroLoadingDisabled: PropTypes.bool.isRequired,
};

const GRO_DOC_MODAL_CLASS = "modal change-pass fade employee-modal logout-modal gro-doc-action-modal";

/** Approve / reject confirmation modals (logout-style layout). */
export function DocumentActionConfirmModal({
  isOpen,
  confirmAction,
  documentName,
  confirmRemarks,
  isSubmitting,
  onRemarksChange,
  onCancel,
  onConfirm,
}) {
  if (!confirmAction) return null;

  const isApprove = confirmAction === "approve";
  const displayName = formatGroDocumentDisplayName(documentName ?? "");
  const rejectRemarksValid = String(confirmRemarks ?? "").trim().length > 0;

  const confirmSpinner = (
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );

  const footerButtons = (confirmLabel, confirmClassName, confirmDisabled = false) => (
    <div className="two-btn logout-btn gro-doc-action-modal__footer">
      <button type="button" className="btn-common close" disabled={isSubmitting} onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className={`save btn-common ${confirmClassName}`}
        disabled={isSubmitting || confirmDisabled}
        onClick={onConfirm}
      >
        {isSubmitting ? confirmSpinner : confirmLabel}
      </button>
    </div>
  );

  if (isApprove) {
    return (
      <CustomModal
        createModal
        className={GRO_DOC_MODAL_CLASS}
        show={isOpen}
        closeModal={onCancel}
        body={
          <div className="modal-body">
            <div className="profile-img gro-doc-action-modal__icon-wrap">
              <FiCheckCircle size={60} style={{ color: "#047857" }} aria-hidden />
            </div>
            <div className="popup-title">Are you sure you want to approve this document?</div>
            {footerButtons("Approve", "gro-doc-confirm-approve-btn")}
          </div>
        }
      />
    );
  }

  return (
    <CustomModal
      createModal
      className={GRO_DOC_MODAL_CLASS}
      show={isOpen}
      closeModal={onCancel}
      body={
        <div className="modal-body">
          <div className="profile-img gro-doc-action-modal__icon-wrap">
            <FiXCircle size={60} style={{ color: "#dc2626" }} aria-hidden />
          </div>
          <div className="popup-title">Are you sure you want to reject this document?</div>
          <div className="gro-doc-action-modal__details">
            <div className="gro-doc-action-modal__detail-row">
              <label className="gro-doc-action-modal__detail-label" htmlFor="gro-doc-reject-remarks">
                Remarks
              </label>
              <textarea
                id="gro-doc-reject-remarks"
                className="gro-doc-action-modal__textarea"
                placeholder="Enter remarks"
                value={confirmRemarks}
                disabled={isSubmitting}
                onChange={onRemarksChange}
                rows={4}
              />
            </div>
          </div>
          {footerButtons("Reject", "gro-doc-confirm-reject-btn", !rejectRemarksValid)}
        </div>
      }
    />
  );
}

DocumentActionConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  confirmAction: PropTypes.oneOf(["approve", "reject"]),
  documentName: PropTypes.string,
  confirmRemarks: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  onRemarksChange: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

/** Documents list — verify / reject / download. */
function InwardClearanceView({
  documents,
  isGroLoading,
  isSubmittingAction,
  showDocumentVerifyActions = false,
  onApproveClick,
  onRejectClick,
  onDocumentDownload,
}) {
  return (
    <TaskDocumentList isLoading={isGroLoading}>
      {documents.map((doc) => (
        <TaskDocumentItem
          key={doc.__rowKey}
          doc={doc}
          showVerifyActions={showDocumentVerifyActions}
          isSubmittingAction={isSubmittingAction}
          onApproveClick={onApproveClick}
          onRejectClick={onRejectClick}
          onDocumentDownload={onDocumentDownload}
        />
      ))}
    </TaskDocumentList>
  );
}

InwardClearanceView.propTypes = {
  documents: PropTypes.array.isRequired,
  isGroLoading: PropTypes.bool.isRequired,
  isSubmittingAction: PropTypes.bool,
  showDocumentVerifyActions: PropTypes.bool,
  onApproveClick: PropTypes.func.isRequired,
  onRejectClick: PropTypes.func.isRequired,
  onDocumentDownload: PropTypes.func.isRequired,
};

export default InwardClearanceView;
