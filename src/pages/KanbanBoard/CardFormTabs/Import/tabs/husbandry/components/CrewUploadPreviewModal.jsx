import PropTypes from "prop-types";
import CustomModal from "../../../../../../../components/CustomModal";

// Read-only preview of the crew rows belonging to one uploaded movement-type
// batch (Sign On or Sign Off) — opened from that batch's preview card on the
// Crew Management dashboard. Rows are pre-filtered by the caller so this
// component only ever renders crew for the single movement type it's given.
const CrewUploadPreviewModal = ({ show, movementTypeLabel, crewRows, cardColor, onClose }) => (
  <CustomModal
    show={show}
    closeModal={onClose}
    createModal
    className="modal fade crew-upload-preview-modal"
    dialgName="modal-dialog modal-dialog-centered modal-lg crew-upload-preview-modal-dialog"
    bodyClassname="crew-upload-preview-modal__body"
    header={
      <div className="crew-upload-preview-modal__header" style={{ "--card-color": cardColor }}>
        <div className="crew-upload-preview-modal__header-main">
          <h5 className="crew-upload-preview-modal__title">{movementTypeLabel} Crew Preview</h5>
          <span className="crew-upload-preview-modal__count">
            {crewRows.length} crew member{crewRows.length === 1 ? "" : "s"}
          </span>
        </div>
        <button type="button" className="crew-upload-preview-modal__close-btn" onClick={onClose} aria-label="Close">
          <span>&times;</span>
        </button>
      </div>
    }
    body={
      crewRows.length > 0 ? (
        <div className="crew-table-wrapper">
          <div className="table-wrapper table-responsive crew-table-container crew-table-scroll">
            <table className="table table-striped crew-table crew-upload-preview-table">
              <thead>
                <tr>
                  <th><span className="crew-th">Crew Name</span></th>
                  <th><span className="crew-th">Nationality</span></th>
                  <th><span className="crew-th">Rank</span></th>
                  <th><span className="crew-th">Movement Type</span></th>
                </tr>
              </thead>
              <tbody>
                {crewRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="crew-table-cell crew-name-cell" title={row.crewName}>
                        {row.crewName}
                      </div>
                    </td>
                    <td>
                      <div className="crew-table-cell" title={row.nationality}>{row.nationality}</div>
                    </td>
                    <td>
                      <div className="crew-table-cell" title={row.rank}>{row.rank}</div>
                    </td>
                    <td>
                      <span className="crew-movement-pill" title={row.movementType}>{row.movementType}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="crew-upload-preview-modal__empty">No crew found for this movement type.</p>
      )
    }
  />
);

CrewUploadPreviewModal.propTypes = {
  show: PropTypes.bool.isRequired,
  movementTypeLabel: PropTypes.string,
  crewRows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      crewName: PropTypes.string,
      nationality: PropTypes.string,
      rank: PropTypes.string,
      movementType: PropTypes.string,
    })
  ),
  cardColor: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

CrewUploadPreviewModal.defaultProps = {
  movementTypeLabel: "",
  crewRows: [],
  cardColor: undefined,
};

export default CrewUploadPreviewModal;
