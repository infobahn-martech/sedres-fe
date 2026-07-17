import { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import CardTabListLoading from "../../../../../../../components/CardTabListLoading";
import MaterialTablePagination from "./MaterialTablePagination";
import useMaterialSummaryReducer from "../../../../../../../store/MaterialSummaryReducer";
import "../../../../../../../design/scss/material-summary.scss";

const SUMMARY_LIMIT = 10;

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

const StatusBadge = ({ status }) => {
  if (!status) return <span>—</span>;
  const slug = status.toLowerCase().replace(/[\s_]+/g, "-");
  const label = status.replace(/[\s_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`ms-status-badge ms-status-${slug}`}>{label}</span>;
};

StatusBadge.propTypes = {
  status: PropTypes.string,
};

const ItemsTable = ({ items }) => {
  if (!items?.length) {
    return <p className="material-summary-empty-note">No items available.</p>;
  }
  return (
    <table className="table material-summary-items-table">
      <thead>
        <tr>
          <th>PO No</th>
          <th>Quantity</th>
          <th>Package Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={item.inbound_item_id ?? item.landing_note_item_id ?? item.dispatch_note_item_id ?? idx}>
            <td>{item.po_no || "—"}</td>
            <td>{item.quantity ?? "—"}</td>
            <td>{item.package_type || "—"}</td>
            <td>{item.description || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

ItemsTable.propTypes = {
  items: PropTypes.array,
};

const STEP_ICONS = {
  inbound: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 8L12 4L20 8V17L12 21L4 17V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 4V21M4 8L12 12L20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  landing: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  dispatch: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7H14V16H3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 10H18L21 13V16H14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="7" cy="18.5" r="1.6" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="18.5" r="1.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

const CheckIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Per-row journey: Inbound Order -> Landing Note -> Dispatch Note.
// "current" marks the immediate next stage to happen; "pending" marks a
// stage that can't start until the one before it exists.
const buildChainSteps = (kind, row, landingNotes, dispatchNotes) => {
  if (kind === "inbound") {
    const landing = landingNotes.find((l) => String(l.inbound_id) === String(row.inbound_id));
    const dispatch = landing
      ? dispatchNotes.find((d) => String(d.landing_note_id) === String(landing.landing_note_id))
      : null;
    return [
      { key: "inbound", label: "Inbound Order", sublabel: row.inbound_no || "—", status: "done" },
      {
        key: "landing",
        label: "Landing Note",
        sublabel: landing?.landing_note_no || "Not yet created",
        status: landing ? "done" : "current",
      },
      {
        key: "dispatch",
        label: "Dispatch Note",
        sublabel: dispatch?.dispatch_note_no || "Not yet created",
        status: dispatch ? "done" : landing ? "current" : "pending",
      },
    ];
  }

  if (kind === "landing") {
    const dispatch = dispatchNotes.find((d) => String(d.landing_note_id) === String(row.landing_note_id));
    return [
      { key: "inbound", label: "Inbound Order", sublabel: row.inbound_no || "—", status: "done" },
      { key: "landing", label: "Landing Note", sublabel: row.landing_note_no || "—", status: "done" },
      {
        key: "dispatch",
        label: "Dispatch Note",
        sublabel: dispatch?.dispatch_note_no || "Not yet created",
        status: dispatch ? "done" : "current",
      },
    ];
  }

  return [
    { key: "inbound", label: "Inbound Order", sublabel: row.inbound_no || "—", status: "done" },
    { key: "landing", label: "Landing Note", sublabel: row.landing_note_no || "—", status: "done" },
    { key: "dispatch", label: "Dispatch Note", sublabel: row.dispatch_note_no || "—", status: "done" },
  ];
};

const ProcessStepper = ({ steps }) => (
  <div className="ms-stepper">
    {steps.map((step, idx) => (
      <div key={step.key} className={`ms-stepper-step ms-stepper-step--${step.status}`}>
        <div className="ms-stepper-node">
          <span className="ms-stepper-icon">{STEP_ICONS[step.key]}</span>
          {step.status === "done" && (
            <span className="ms-stepper-check">
              <CheckIcon />
            </span>
          )}
        </div>
        <div className="ms-stepper-text">
          <span className="ms-stepper-label">{step.label}</span>
          <span className="ms-stepper-sublabel">{step.sublabel}</span>
        </div>
        {idx < steps.length - 1 && (
          <span className={`ms-stepper-connector${step.status === "done" ? " is-done" : ""}`} />
        )}
      </div>
    ))}
  </div>
);

ProcessStepper.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sublabel: PropTypes.string,
      status: PropTypes.oneOf(["done", "current", "pending"]).isRequired,
    })
  ).isRequired,
};

const DocumentsList = ({ documents }) => {
  if (!documents?.length) return null;
  return (
    <div className="material-summary-documents">
      {documents.map((doc, idx) => (
        <a
          key={doc.material_document_id ?? idx}
          href={doc.file_url}
          target="_blank"
          rel="noreferrer"
          className="material-summary-document-card"
        >
          {isImageFile(doc.file_name) ? (
            <img src={doc.file_url} alt={doc.file_name} className="material-summary-document-thumbnail" />
          ) : (
            <div className="material-summary-document-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <span className="material-summary-document-name">{doc.file_name}</span>
        </a>
      ))}
    </div>
  );
};

DocumentsList.propTypes = {
  documents: PropTypes.array,
};

const SummarySection = ({ title, columns, rows, rowKey, isLoading, cardColor, page, total, onPageChange, expandedIds, onToggleExpand, renderExpanded }) => (
  <div className="material-summary-section">
    <div className="material-list-header">
      <h3 className="material-list-title">
        <span className="material-list-title-bar"></span>
        {title}
        <span className="ms-section-count">{total}</span>
      </h3>
    </div>
    <div className="table-wrapper table-responsive material-table-container note-table-container">
      <div className="note-table-scroll">
        {isLoading ? (
          <CardTabListLoading message={`Loading ${title.toLowerCase()}...`} cardColor={cardColor} />
        ) : (
          <table className="table table-striped material-table ms-summary-table note-table">
            <thead className="note-thead">
              <tr>
                <th width="44" className="custom-table-expand-header" aria-label="Expand row" />
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => {
                  const id = rowKey(row);
                  const isExpanded = expandedIds.has(id);
                  return (
                    <Fragment key={id}>
                      <tr className="order-history-row">
                        <td className="custom-table-expand-cell">
                          <button
                            type="button"
                            className="order-history-expand-toggle"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Collapse row" : "Expand row"}
                            onClick={() => onToggleExpand(id)}
                          >
                            <span className={`custom-table-expand-chevron${isExpanded ? " is-open" : ""}`} />
                          </button>
                        </td>
                        {columns.map((col) => (
                          <td key={col.key}>
                            <div className="material-table-cell">{col.render ? col.render(row) : (row[col.key] ?? "—")}</div>
                          </td>
                        ))}
                      </tr>
                      {isExpanded && (
                        <tr className="custom-table-expanded-row">
                          <td colSpan={columns.length + 1} className="p-0">
                            <div className="custom-table-expanded-inner">
                              {renderExpanded(row)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="note-empty-td">
                    No {title.toLowerCase()} available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
    <div className="ms-pagination-wrap">
      <MaterialTablePagination page={page} total={total} limit={SUMMARY_LIMIT} onPageChange={onPageChange} />
    </div>
  </div>
);

SummarySection.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
  rowKey: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  cardColor: PropTypes.string,
  page: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  expandedIds: PropTypes.instanceOf(Set).isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  renderExpanded: PropTypes.func.isRequired,
};

const MaterialSummaryContent = ({ formValues, cardColor }) => {
  const { inbounds, landingNotes, dispatchNotes, summaryPagination, isLoadingSummary, getMaterialSummaryByCall } =
    useMaterialSummaryReducer((state) => state);

  const [page, setPage] = useState(1);
  const [expandedInboundIds, setExpandedInboundIds] = useState(() => new Set());
  const [expandedLandingIds, setExpandedLandingIds] = useState(() => new Set());
  const [expandedDispatchIds, setExpandedDispatchIds] = useState(() => new Set());

  const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);

  useEffect(() => {
    if (!callId) return;
    getMaterialSummaryByCall({ call_id: callId, page, limit: SUMMARY_LIMIT });
  }, [callId, page, getMaterialSummaryByCall]);

  const toggleExpand = (setExpandedIds) => (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="cardform-left-full material-management-content-wrapper material-summary-wrapper" style={{ "--card-color": cardColor }}>
      <SummarySection
        title="Inbound Orders"
        cardColor={cardColor}
        isLoading={isLoadingSummary}
        rows={inbounds}
        rowKey={(row) => row.inbound_id}
        page={page}
        total={summaryPagination?.inbounds?.total ?? 0}
        onPageChange={setPage}
        expandedIds={expandedInboundIds}
        onToggleExpand={toggleExpand(setExpandedInboundIds)}
        columns={[
          { key: "inbound_no", label: "Inbound Order No" },
          { key: "inbound_date", label: "Date", render: (row) => formatDate(row.inbound_date) },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
        ]}
        renderExpanded={(row) => (
          <>
            <ProcessStepper steps={buildChainSteps("inbound", row, landingNotes, dispatchNotes)} />
            <ItemsTable items={row.items} />
          </>
        )}
      />

      <SummarySection
        title="Landing Notes"
        cardColor={cardColor}
        isLoading={isLoadingSummary}
        rows={landingNotes}
        rowKey={(row) => row.landing_note_id}
        page={page}
        total={summaryPagination?.landing_notes?.total ?? 0}
        onPageChange={setPage}
        expandedIds={expandedLandingIds}
        onToggleExpand={toggleExpand(setExpandedLandingIds)}
        columns={[
          { key: "landing_note_no", label: "Landing Note No" },
          { key: "landing_date", label: "Date", render: (row) => formatDate(row.landing_date) },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "inbound_no", label: "Inbound Order No" },
        ]}
        renderExpanded={(row) => (
          <>
            <ProcessStepper steps={buildChainSteps("landing", row, landingNotes, dispatchNotes)} />
            <ItemsTable items={row.items} />
            <DocumentsList documents={row.documents} />
          </>
        )}
      />

      <SummarySection
        title="Dispatch Notes"
        cardColor={cardColor}
        isLoading={isLoadingSummary}
        rows={dispatchNotes}
        rowKey={(row) => row.dispatch_note_id}
        page={page}
        total={summaryPagination?.dispatch_notes?.total ?? 0}
        onPageChange={setPage}
        expandedIds={expandedDispatchIds}
        onToggleExpand={toggleExpand(setExpandedDispatchIds)}
        columns={[
          { key: "dispatch_note_no", label: "Dispatch Note No" },
          { key: "dispatch_date", label: "Date", render: (row) => formatDate(row.dispatch_date) },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "delivery_location", label: "Delivery Location" },
          { key: "delivered_to", label: "Delivered To" },
          { key: "landing_note_no", label: "Landing Note No" },
        ]}
        renderExpanded={(row) => (
          <>
            <ProcessStepper steps={buildChainSteps("dispatch", row, landingNotes, dispatchNotes)} />
            <ItemsTable items={row.items} />
            <DocumentsList documents={row.documents} />
          </>
        )}
      />
    </div>
  );
};

MaterialSummaryContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func,
  cardColor: PropTypes.string,
};

export default MaterialSummaryContent;
