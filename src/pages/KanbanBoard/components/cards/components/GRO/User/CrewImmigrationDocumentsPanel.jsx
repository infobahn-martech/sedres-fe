import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FiSearch, FiX, FiCheckCircle } from "react-icons/fi";
import InwardClearanceView from "./InwardClearanceView";
import { formatGroDocumentDisplayName, getGroDocumentVerifyStatus } from "./groCardUtils";

const VERIFIED_STATUS = 2;

/**
 * Documents tab of the Crew Immigration card, in the same brand-band layout as the crew list,
 * so switching between Documents and Crew Immigration keeps the card's frame still.
 */
export default function CrewImmigrationDocumentsPanel({ navigation = null, documents, isGroLoading, ...listProps }) {
  const [search, setSearch] = useState("");
  const safeDocuments = useMemo(() => (Array.isArray(documents) ? documents : []), [documents]);

  const term = search.trim().toLowerCase();
  const visibleDocuments = useMemo(
    () =>
      term
        ? safeDocuments.filter((doc) =>
            formatGroDocumentDisplayName(doc?.document_name ?? "").toLowerCase().includes(term)
          )
        : safeDocuments,
    [safeDocuments, term]
  );

  const verifiedCount = useMemo(
    () => safeDocuments.filter((doc) => getGroDocumentVerifyStatus(doc) === VERIFIED_STATUS).length,
    [safeDocuments]
  );
  const total = safeDocuments.length;
  const allVerified = total > 0 && verifiedCount === total;

  return (
    <div className="gro-crew-immigration-panel gro-crew-imm-panel gro-crew-imm-panel--docs">
      <div className="gro-crew-immigration-toolbar gro-crew-imm-toolbar">
        <div className="gro-crew-imm-toolbar-group">
          {navigation ? (
            <>
              {navigation}
              <span className="gro-crew-imm-toolbar-divider" aria-hidden />
            </>
          ) : null}
          {isGroLoading ? (
            <span className="gro-skeleton gro-skel-on-brand gro-skel-pill" aria-hidden="true" />
          ) : (
            <span
              className={`gro-crew-imm-band-stat${allVerified ? " gro-crew-imm-band-stat--done" : ""}`}
              aria-live="polite"
            >
              <FiCheckCircle aria-hidden />
              {`${verifiedCount} of ${total} verified`}
            </span>
          )}
        </div>

        <div className="gro-crew-imm-toolbar-group gro-crew-imm-toolbar-group--end">
          <label className="gro-crew-imm-search">
            <FiSearch aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              aria-label="Search documents"
            />
            {search ? (
              <button
                type="button"
                className="gro-crew-imm-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <FiX />
              </button>
            ) : null}
          </label>
        </div>
      </div>

      <div className="gro-crew-imm-body gro-crew-imm-docs-body">
        {term && !isGroLoading && visibleDocuments.length === 0 ? (
          <p className="gro-crew-imm-empty">{`No documents match “${search.trim()}”.`}</p>
        ) : (
          <InwardClearanceView documents={visibleDocuments} isGroLoading={isGroLoading} {...listProps} />
        )}
      </div>
    </div>
  );
}

CrewImmigrationDocumentsPanel.propTypes = {
  navigation: PropTypes.node,
  documents: PropTypes.array.isRequired,
  isGroLoading: PropTypes.bool.isRequired,
  isSubmittingAction: PropTypes.bool,
  showDocumentVerifyActions: PropTypes.bool,
  onApproveClick: PropTypes.func.isRequired,
  onRejectClick: PropTypes.func.isRequired,
  onDocumentDownload: PropTypes.func.isRequired,
};
