import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import moment from "moment";

export function ViewNotificationModal({ showModal, closeModal }) {
  if (!showModal) return null;

  const renderHeader = () => (
    <>
      <h1 className="modal-title">View Notification Details</h1>
      <button
        type="button"
        className="btn-close"
        aria-label="Close"
        onClick={closeModal}
      ></button>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="view-vessel-container">
        {/* ROW 1 — Date/Time + Notification Type + Status */}
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Date/Time</div>
            <div className="view-value">
              {showModal.dateTime
                ? moment(showModal.dateTime).format('DD/MM/YYYY hh:mm a')
                : "-"}
            </div>
          </div>
          <div className="view-item">
            <div className="view-label">Notification Type</div>
            <div className="view-value">{showModal.notificationType || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Status</div>
            <div className="view-value">
              <span className={`status-badge status-${showModal.status?.toLowerCase() || 'default'}`}>
                {showModal.status || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* ROW 2 — Title + Priority + Recipient */}
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Title</div>
            <div className="view-value">{showModal.title || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Priority</div>
            <div className="view-value">{showModal.priority || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Recipient</div>
            <div className="view-value">{showModal.recipient || "-"}</div>
          </div>
        </div>

        {/* ROW 3 — Module */}
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Module</div>
            <div className="view-value">{showModal.module || "-"}</div>
          </div>
        </div>

        {/* ROW 4 — Message */}
        <div className="view-row">
          <div className="view-item" style={{ width: '100%' }}>
            <div className="view-label">Message</div>
            <div className="view-value">{showModal.message || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <CustomModal
      dialgName="modal-dialog modal-dialog-centered"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      header={renderHeader()}
    />
  );
}

