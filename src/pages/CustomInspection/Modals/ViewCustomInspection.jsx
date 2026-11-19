import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import moment from "moment";

export function ViewCustomInspectionModal({ showModal, closeModal }) {
  if (!showModal) return null;

  const renderHeader = () => (
    <>
      <h1 className="modal-title">View Custom Inspection</h1>
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
        {/* ROW 1 — Billing Entity + Vessel Name + Port Name */}
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Billing Entity</div>
            <div className="view-value">{showModal.billingEntity || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Vessel Name</div>
            <div className="view-value">{showModal.vesselName || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Port Name</div>
            <div className="view-value">{showModal.portName || "-"}</div>
          </div>
        </div>

        {/* ROW 2 — Type of Call + ATA + Status */}
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Type of Call</div>
            <div className="view-value">{showModal.typeOfCall || "-"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">ATA</div>
            <div className="view-value">
              {showModal.ata
                ? moment(showModal.ata).format('DD/MM/YYYY hh:mm a')
                : "-"}
            </div>
          </div>
          <div className="view-item">
            <div className="view-label">Status</div>
            <div className="view-value">
              <span className={`status-badge status-${showModal.status?.toLowerCase() || 'default'}`}>
                {showModal.status ? showModal.status.charAt(0).toUpperCase() + showModal.status.slice(1) : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Preview Information */}
        {/* <div className="view-row" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <div className="view-item" style={{ width: '100%' }}>
            <div className="view-label">Inspection Details</div>
            <div className="view-value" style={{ marginTop: '10px' }}>
              <p style={{ margin: '5px 0' }}>
                <strong>Inspection ID:</strong> {showModal._id || "N/A"}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Inspection Type:</strong> Custom Inspection
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Vessel:</strong> {showModal.vesselName || "N/A"}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Port:</strong> {showModal.portName || "N/A"}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Call Type:</strong> {showModal.typeOfCall || "N/A"}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Arrival Time:</strong>{" "}
                {showModal.ata
                  ? moment(showModal.ata).format('DD/MM/YYYY hh:mm a')
                  : "N/A"}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Current Status:</strong>{" "}
                <span className={`status-badge status-${showModal.status?.toLowerCase() || 'default'}`}>
                  {showModal.status ? showModal.status.charAt(0).toUpperCase() + showModal.status.slice(1) : "N/A"}
                </span>
              </p>
            </div>
          </div>
        </div> */}
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

