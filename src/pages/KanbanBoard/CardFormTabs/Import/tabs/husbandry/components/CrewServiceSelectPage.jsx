import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const PAGE_SIZE = 10;

// Read-only doc status icon — green preview icon when available, blank cell
// when missing. Same visual language as the Crew Summary table.
const DocStatusIcon = ({ available, label }) => {
  if (!available) {
    return <div className="crew-table-cell crew-table-cell--doc-action" aria-hidden="true" />;
  }
  return (
    <div className="crew-table-cell crew-table-cell--doc-action">
      <div className="crew-doc-cell__inner">
        <span
          className="crew-doc-btn crew-doc-btn--preview"
          aria-label={`${label} available`}
          title={`${label} available`}
        >
          <svg className="crew-doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "#00AA00" }} />
            <circle cx="12" cy="12" r="3" strokeWidth="2" style={{ stroke: "#00AA00" }} />
          </svg>
        </span>
      </div>
    </div>
  );
};

DocStatusIcon.propTypes = {
  available: PropTypes.bool,
  label: PropTypes.string.isRequired,
};

// "Select Crew" step opened from a Crew Management service card — a full
// page (not a modal) so it fits the dashboard's existing page-swap flow:
// dashboard -> select crew (this
// page) -> submit -> straight to the service's request/form (or a
// confirmation, for services without one yet). Selection state lives in
// the parent (selectedCrewIds); crewRows is the real, unfiltered call/vessel
// crew list (crew/get_crew_list, fetched and row-shaped in
// CrewManagementDashboard) passed down as-is. The table is paginated for
// display only; selection tracks crew ids, not page position, so it
// survives paging.
const CrewServiceSelectPage = ({
  service,
  crewRows = [],
  selectedCrewIds = [],
  onChangeSelected,
  cardColor,
  onBack,
  onSubmit,
}) => {
  const [page, setPage] = useState(1);
  const [signOnCount, setSignOnCount] = useState("");
  const [signOffCount, setSignOffCount] = useState("");

  useEffect(() => {
    setPage(1);
    setSignOnCount("");
    setSignOffCount("");
  }, [service?.tabName]);

  if (!service) return null;

  const isCrewChange = service.tabName === "crewChange";
  const hasCrew = crewRows.length > 0;
  const canSubmit = hasCrew && selectedCrewIds.length > 0;
  const totalPages = Math.max(1, Math.ceil(crewRows.length / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const pagedRows = crewRows.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);
  const pageIds = pagedRows.map((row) => row.id);
  const isPageFullySelected = pageIds.length > 0 && pageIds.every((id) => selectedCrewIds.includes(id));

  // Header checkbox selects/clears only the crew shown on the current page —
  // total selection count (all pages) is shown in the footer.
  const togglePage = () => {
    onChangeSelected(
      isPageFullySelected
        ? selectedCrewIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedCrewIds, ...pageIds])]
    );
  };

  const toggleOne = (id) => {
    onChangeSelected(
      selectedCrewIds.includes(id)
        ? selectedCrewIds.filter((existing) => existing !== id)
        : [...selectedCrewIds, id]
    );
  };

  return (
    <div className="husbandry-service-selection" style={{ "--card-color": cardColor }}>
      <div className="husbandry-service-selection-content crew-select-page-content">
        <div className="crew-listing-header">
          <div>
            <h2 className="crew-listing-title crew-listing-title--with-back">
              <button
                type="button"
                className="crew-listing-back-arrow"
                onClick={onBack}
                aria-label="Back to Crew Management"
                style={{ "--card-color": cardColor }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              Select Crew
            </h2>
            <p className="crew-listing-subtitle">Choose the crew members to assign to {service.label}.</p>
          </div>
          <div className="crew-select-page-header-actions">
            <span className="crew-service-select-modal__service-badge">{service.label}</span>
            <button
              type="button"
              className="crew-service-select-modal__submit-btn"
              onClick={() => onSubmit({ signOnCount, signOffCount })}
              disabled={!canSubmit}
            >
              Submit
            </button>
          </div>
        </div>

        {hasCrew ? (
          <>
            {isCrewChange && (
              <div className="crew-select-signcount-row">
                <label className="crew-select-signcount-field">
                  <span className="crew-select-signcount-label">No. of Sign On</span>
                  <input
                    type="number"
                    min="0"
                    className="crew-select-signcount-input"
                    value={signOnCount}
                    onChange={(e) => setSignOnCount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="crew-select-signcount-field">
                  <span className="crew-select-signcount-label">No. of Sign Off</span>
                  <input
                    type="number"
                    min="0"
                    className="crew-select-signcount-input"
                    value={signOffCount}
                    onChange={(e) => setSignOffCount(e.target.value)}
                    placeholder="0"
                  />
                </label>
              </div>
            )}
            <div className="crew-table-wrapper crew-select-page-table">
              <div className="table-wrapper table-responsive crew-table-container crew-table-scroll">
                <table
                  className="table table-striped crew-table crew-list-table"
                  style={{ "--card-color": cardColor, tableLayout: "fixed", width: "100%" }}
                >
                  <thead>
                    <tr>
                      <th className="crew-checkbox-cell-header">
                        <input
                          type="checkbox"
                          className="crew-list-checkbox crew-list-checkbox--header"
                          checked={isPageFullySelected}
                          onChange={togglePage}
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th><span className="crew-th">Crew name</span></th>
                      <th><span className="crew-th">Nationality</span></th>
                      <th><span className="crew-th">Rank</span></th>
                      <th><span className="crew-th">Movement type</span></th>
                      <th><span className="crew-th">Passport / Iqama</span></th>
                      <th><span className="crew-th">Visa</span></th>
                      <th><span className="crew-th">CG Pass</span></th>
                      <th><span className="crew-th">Zawil Pass</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => {
                      const isSelected = selectedCrewIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={isSelected ? "crew-row-selected" : ""}
                          onClick={() => toggleOne(row.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <td className="crew-checkbox-cell">
                            <input
                              type="checkbox"
                              className="crew-list-checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(row.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${row.crewName}`}
                            />
                          </td>
                          <td>
                            <div className="crew-table-cell crew-name-cell" title={row.crewName}>
                              <span className="crew-name-info">
                                <span className="crew-name-text">{row.crewName}</span>
                              </span>
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
                          <td><DocStatusIcon available={row.passport || row.iqama} label="Passport / Iqama" /></td>
                          <td><DocStatusIcon available={row.visa} label="Visa" /></td>
                          <td><DocStatusIcon available={row.cgPass} label="CG Pass" /></td>
                          <td><DocStatusIcon available={row.zawilPass} label="Zawil Pass" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="crew-select-pagination">
              <button
                type="button"
                className="crew-select-pagination__btn"
                aria-label="Previous page"
                disabled={effectivePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <FiChevronLeft size={16} />
              </button>
              <span className="crew-select-pagination__info">
                Page {effectivePage} of {totalPages}
              </span>
              <button
                type="button"
                className="crew-select-pagination__btn"
                aria-label="Next page"
                disabled={effectivePage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <p className="crew-service-select-modal__empty">
            No crew available yet. Upload a crew list first.
          </p>
        )}
      </div>
    </div>
  );
};

CrewServiceSelectPage.propTypes = {
  service: PropTypes.shape({
    tabName: PropTypes.string,
    label: PropTypes.string,
  }),
  crewRows: PropTypes.array,
  selectedCrewIds: PropTypes.array,
  onChangeSelected: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default CrewServiceSelectPage;
