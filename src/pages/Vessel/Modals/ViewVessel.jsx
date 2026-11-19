import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import moment from "moment";
import "../../../design/scss/pages/vessel/modals/ViewVessel.scss";

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return null;
}

export function ViewVesselModal({ showModal, closeModal }) {
  if (!showModal) return null;

  const billing = pick(showModal, "billing_entity", "billingEntity");
  const vesselType = pick(showModal, "vessel_type", "vesselType");
  const vesselName = pick(showModal, "vessel_name", "vesselName");
  const vesselUid = pick(showModal, "vessel_unique_id", "vesselUniqueId");
  const imo = pick(showModal, "imo_number", "imoNumber");
  const flagState = pick(showModal, "flag_state", "flagState");
  const grossTonnage = pick(showModal, "gross_tonnage", "grossTonnage");
  const callSign = pick(showModal, "call_sign", "callSign");
  const yearBuilt = pick(showModal, "year_built", "yearBuilt");
  const classSociety = pick(showModal, "class_society", "classSociety");
  const pnIClub = pick(showModal, "p_i_club", "pnIClub");
  const loa = pick(showModal, "loa", "lengthOverall");
  const beam = pick(showModal, "beam");
  const draft = pick(showModal, "draft");
  const mwpDocument = pick(showModal, "mwp_document", "mwpDocument");
  const mwpExpiry = pick(showModal, "mwp_expiry_date", "mwpExpiryDate");
  const status = pick(showModal, "status");
  const daysToExpiry = pick(showModal, "days_to_expiry", "daysToExpiry");

  const formatDate = (v) => {
    if (v == null || v === "") return "—";
    const m = moment(v);
    return m.isValid() ? m.format("DD/MM/YYYY") : String(v);
  };

  const renderHeader = () => (
    <>
      <h1 className="modal-title">View Vessel</h1>
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
        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Billing Entity</div>
            <div className="view-value">{billing ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Vessel Name</div>
            <div className="view-value">{vesselName ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Vessel Unique ID</div>
            <div className="view-value">{vesselUid ?? "—"}</div>
          </div>
        </div>

        <div className="view-row">
          <div className="view-item">
            <div className="view-label">IMO Number</div>
            <div className="view-value">{imo ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Vessel Type</div>
            <div className="view-value">{vesselType ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Status</div>
            <div className="view-value">{status ?? "—"}</div>
          </div>
        </div>

        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Flag State</div>
            <div className="view-value">{flagState ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Gross Tonnage</div>
            <div className="view-value">{grossTonnage ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Year Built</div>
            <div className="view-value">{yearBuilt ?? "—"}</div>
          </div>
        </div>

        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Call Sign</div>
            <div className="view-value">{callSign ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Class Society</div>
            <div className="view-value">{classSociety ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">P&I Club</div>
            <div className="view-value">{pnIClub ?? "—"}</div>
          </div>
        </div>

        <div className="view-row">
          <div className="view-item">
            <div className="view-label">Length Overall (LOA)</div>
            <div className="view-value">{loa ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Beam</div>
            <div className="view-value">{beam ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Draft</div>
            <div className="view-value">{draft ?? "—"}</div>
          </div>
        </div>

        <div className="view-row">
          <div className="view-item">
            <div className="view-label">MWP document</div>
            <div className="view-value">{mwpDocument ?? "—"}</div>
          </div>
          <div className="view-item">
            <div className="view-label">MWP expiry date</div>
            <div className="view-value">{formatDate(mwpExpiry)}</div>
          </div>
          <div className="view-item">
            <div className="view-label">Days to expiry</div>
            <div className="view-value">
              {daysToExpiry != null && daysToExpiry !== "" ? daysToExpiry : "—"}
            </div>
          </div>
        </div>

        {showModal.createdAt && (
          <div className="view-row">
            <div className="view-item">
              <div className="view-label">Created At</div>
              <div className="view-value">
                {moment(showModal.createdAt).format("DD/MM/YYYY hh:mm a")}
              </div>
            </div>
          </div>
        )}
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
