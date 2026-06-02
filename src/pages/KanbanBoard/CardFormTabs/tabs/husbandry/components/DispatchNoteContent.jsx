import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import MaterialTablePagination from "./MaterialTablePagination";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import useDispatchNoteReducer from "../../../../../../store/DispatchNoteReducer";

const DISPATCH_LIMIT = 10;

const mapDispatchNoteForDisplay = (note) => {
  const items = Array.isArray(note?.items) ? note.items : [];
  return {
    ...note,
    id: note?.dispatch_note_id ?? note?.id,
    dispatchNoteNo: note?.dispatch_note_no ?? note?.dispatchNoteNo ?? String(note?.dispatch_note_id ?? note?.id ?? ""),
    date: note?.dispatch_date ?? note?.date ?? "",
    warehouseName: note?.warehouse_name ?? note?.warehouse ?? "",
    deliveryLocation: note?.delivery_location ?? note?.deliveryLocation ?? "",
    deliveredTo: note?.delivered_to ?? note?.deliveredTo ?? "",
    remarks: note?.remarks ?? "",
    itemsCount: items.length,
    items,
  };
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const DispatchNoteContent = ({ formValues, cardColor }) => {
  const {
    getAllDispatchNotes,
    deleteDispatchNote,
    dispatchNotes,
    dispatchTotal,
    isLoadingList,
    isLoadingDelete,
  } = useDispatchNoteReducer();

  const [notesList, setNotesList] = useState([]);
  const [viewingNote, setViewingNote] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [dispatchPage, setDispatchPage] = useState(1);

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, dispatchPage]);

  useEffect(() => {
    setNotesList(Array.isArray(dispatchNotes) ? dispatchNotes.map(mapDispatchNoteForDisplay) : []);
  }, [dispatchNotes]);

  // Close dropdown on outside click or scroll
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isDropdownButton = event.target.closest('.action-dropdown-wrapper');
      const isDropdownMenu = event.target.closest('[data-dropdown-menu]');
      if (!isDropdownButton && !isDropdownMenu) setOpenDropdownId(null);
    };
    const handleScroll = () => setOpenDropdownId(null);
    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openDropdownId]);

  const handleToggleDropdown = (noteId, e) => {
    e.stopPropagation();
    if (openDropdownId === noteId) {
      setOpenDropdownId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    dropdownButtonRefs.current[noteId] = e.currentTarget;
    setOpenDropdownId(noteId);
  };

  const handleCloseDropdown = () => setOpenDropdownId(null);

  const handleViewNote = (note) => {
    handleCloseDropdown();
    setViewingNote(note);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingNote(null);
  };

  const handleDelete = (note) => {
    handleCloseDropdown();
    const dispatchNoteId = note?.dispatch_note_id ?? note?.id;
    if (!dispatchNoteId) return;
    if (!window.confirm("Are you sure you want to delete this dispatch note?")) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    deleteDispatchNote({
      dispatchNoteId,
      cb: () => {
        if (callId) getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
      },
    });
  };

  const handlePrintNote = (note) => {
    handleCloseDropdown();
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - Dispatch Note ${note.dispatchNoteNo || ''}</title>
          <style>
            body { font-family: "Open Sans", sans-serif; padding: 20px; color: #333; }
            .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00368c; padding-bottom: 15px; }
            .print-header h1 { color: #00368c; margin: 0; font-size: 24px; }
            .print-section { margin-bottom: 25px; }
            .print-section-title { font-size: 18px; font-weight: bold; color: #00368c; margin-bottom: 15px; border-bottom: 1px solid #e2e2ea; padding-bottom: 8px; }
            .print-row { display: flex; margin-bottom: 12px; }
            .print-label { font-weight: 600; width: 200px; color: #666; }
            .print-value { flex: 1; color: #1a1a1a; }
            .print-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e2ea; text-align: center; color: #666; font-size: 12px; }
            @media print { body { margin: 0; padding: 15px; } }
          </style>
        </head>
        <body>
          <div class="print-header"><h1>Dispatch Note Details</h1></div>
          <div class="print-section">
            <div class="print-section-title">Note Information</div>
            <div class="print-row"><div class="print-label">Dispatch Note No:</div><div class="print-value">${note.dispatchNoteNo || "-"}</div></div>
            <div class="print-row"><div class="print-label">Dispatch Date:</div><div class="print-value">${formatDate(note.date) || "-"}</div></div>
            <div class="print-row"><div class="print-label">Warehouse:</div><div class="print-value">${note.warehouseName || "-"}</div></div>
            <div class="print-row"><div class="print-label">Delivery Location:</div><div class="print-value">${note.deliveryLocation || "-"}</div></div>
            <div class="print-row"><div class="print-label">Delivered To:</div><div class="print-value">${note.deliveredTo || "-"}</div></div>
            <div class="print-row"><div class="print-label">Remarks:</div><div class="print-value">${note.remarks || "-"}</div></div>
          </div>
          <div class="print-footer"><p>Printed on ${new Date().toLocaleString()}</p></div>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const renderViewBody = () => {
    if (!viewingNote) return null;
    return (
      <div className="modal-body">
        <div className="view-vessel-container" style={{ padding: "20px" }}>
          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Dispatch Note No</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.dispatchNoteNo || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Dispatch Date</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{formatDate(viewingNote.date) || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Warehouse</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.warehouseName || "-"}</div>
            </div>
          </div>
          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Delivery Location</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.deliveryLocation || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Delivered To</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.deliveredTo || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Items</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.itemsCount || 0}</div>
            </div>
          </div>
          {viewingNote.remarks && (
            <div className="view-row" style={{ marginBottom: "20px" }}>
              <div className="view-item" style={{ width: "100%" }}>
                <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Remarks</div>
                <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.remarks}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleCloseViewModal}
        style={{ padding: "10px 20px", backgroundColor: "#f5f5f5", color: "#333", border: "1px solid #e2e2ea", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}
      >
        Close
      </button>
      {viewingNote && (
        <button
          type="button"
          onClick={() => handlePrintNote(viewingNote)}
          style={{ padding: "10px 20px", backgroundColor: "#00368c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}
        >
          Print
        </button>
      )}
    </div>
  );

  return (
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Dispatch Note
        </h3>
      </div>
      <div className="table-wrapper table-responsive material-table-container" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 330px)", minHeight: 0 }}>
          <table className="table table-striped material-table sub-note-table" style={{ "--card-color": "#e2e6ff", tableLayout: "fixed" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#fff" }}>
              <tr>
                <th>Dispatch Note No</th>
                <th>Dispatch Date</th>
                <th>Warehouse</th>
                <th>Delivery Location</th>
                <th>Delivered To</th>
                <th>Remarks</th>
                <th style={{ paddingLeft: "28px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                    Loading...
                  </td>
                </tr>
              ) : notesList.length > 0 ? (
                notesList.map((note) => (
                  <tr key={note.id}>
                    <td><div className="material-table-cell">{note.dispatchNoteNo || "-"}</div></td>
                    <td><div className="material-table-cell">{formatDate(note.date)}</div></td>
                    <td><div className="material-table-cell">{note.warehouseName || "-"}</div></td>
                    <td>
                      <div className="material-table-cell">
                        {note.deliveryLocation && note.deliveryLocation.length > 15 ? (
                          <>
                            <Tooltip id={`dloc-${note.id}`} place="right" content={note.deliveryLocation} className="material-table-tooltip" />
                            <span data-tooltip-id={`dloc-${note.id}`} style={{ cursor: "help" }}>
                              {note.deliveryLocation.substring(0, 15)}...
                            </span>
                          </>
                        ) : (
                          <span>{note.deliveryLocation || "-"}</span>
                        )}
                      </div>
                    </td>
                    <td><div className="material-table-cell">{note.deliveredTo || "-"}</div></td>
                    <td>
                      <div className="material-table-cell">
                        {note.remarks && note.remarks.length > 13 ? (
                          <>
                            <Tooltip id={`remarks-${note.id}`} place="right" content={note.remarks} className="material-table-tooltip" />
                            <span data-tooltip-id={`remarks-${note.id}`} style={{ cursor: "help" }}>
                              {note.remarks.substring(0, 13)}...
                            </span>
                          </>
                        ) : (
                          <span>{note.remarks || "-"}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ position: "relative", overflow: "visible" }}>
                      <div className="material-table-cell" style={{ position: "relative", overflow: "visible", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                        <Tooltip id={`view-dispatch-${note.id}`} place="left" content="View" />
                        <button
                          type="button"
                          onClick={() => handleViewNote(note)}
                          data-tooltip-id={`view-dispatch-${note.id}`}
                          style={{ padding: "6px 8px", backgroundColor: "transparent", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#00368c", transition: "background-color 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <img src={eyeIcon} alt="view" style={{ width: "18px", height: "18px" }} />
                        </button>
                        <Tooltip id={`print-dispatch-${note.id}`} place="left" content="Print" />
                        <button
                          type="button"
                          onClick={() => handlePrintNote(note)}
                          data-tooltip-id={`print-dispatch-${note.id}`}
                          style={{ padding: "6px 8px", backgroundColor: "transparent", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#00368c", transition: "background-color 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9V2H18V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 18H4C2.89543 18 2 17.1046 2 16V11C2 9.89543 2.89543 9 4 9H20C21.1046 9 22 9.89543 22 11V16C22 17.1046 21.1046 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18 14H6V22H18V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === note.id ? 9999 : "auto" }}>
                          <Tooltip id={`more-dispatch-${note.id}`} place="right" content="More actions" />
                          <button
                            type="button"
                            onClick={(e) => handleToggleDropdown(note.id, e)}
                            data-tooltip-id={`more-dispatch-${note.id}`}
                            style={{ padding: "6px 8px", backgroundColor: "transparent", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#00368c" }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                            </svg>
                          </button>
                          {openDropdownId === note.id && createPortal(
                            <div
                              data-dropdown-menu
                              style={{ position: "fixed", top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px`, backgroundColor: "white", border: "1px solid #e2e2ea", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)", zIndex: 99999, minWidth: "180px", padding: "4px 0" }}
                            >
                              <button
                                type="button"
                                onClick={() => handleDelete(note)}
                                disabled={isLoadingDelete}
                                style={{ width: "100%", padding: "10px 16px", backgroundColor: "transparent", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#dc3545", transition: "background-color 0.2s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f5f5f5"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                              >
                                <img src={deleteIcon} alt="delete" style={{ width: "16px", height: "16px" }} />
                                <span>Delete</span>
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "#888", fontSize: "14px" }}>
                    No dispatch notes found. Dispatch notes are created by converting Landing Notes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <MaterialTablePagination
          page={dispatchPage}
          total={dispatchTotal}
          limit={DISPATCH_LIMIT}
          onPageChange={setDispatchPage}
        />
      </div>

      <CustomModal
        className="material-management-modal"
        show={showViewModal}
        closeModal={handleCloseViewModal}
        header={<h1 className="modal-title">View Dispatch Note Details</h1>}
        body={renderViewBody()}
        footer={renderViewFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />
    </div>
  );
};

DispatchNoteContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func,
  cardColor: PropTypes.string,
};

export default DispatchNoteContent;
