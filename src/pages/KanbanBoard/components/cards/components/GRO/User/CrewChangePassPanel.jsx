import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { FiUpload, FiUploadCloud } from "react-icons/fi";
import { notify } from "../../../../../../../components/Toaster";
import crewService from "../../../../../../../services/crewService";
import groService from "../../../../../../../services/groService";
import { getPassRequests, extractPassRequestsFromEnvelope } from "../../../../../../../services/cgAndZwailpassService";
import { groApiErrorMessage } from "./groCardUtils";
import {
  crewChangeRowFields,
  flattenPassRequestCrew,
  getCrewChangeCrewId,
  normalizeCrewChangeListResponse,
} from "./crewChangePassUtils";
import CrewChangeCgPassGenerateView from "./CrewChangeCgPassGenerateView";

const PAGE_SIZE = 10;

/** Crew Change stage: crew roster + CG Pass (templated or AI-read) / Zawil Pass (AI-read) upload flows. */
export default function CrewChangePassPanel({ callId, portId }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState(() => new Set());
  const [view, setView] = useState("roster");
  const [activeTab, setActiveTab] = useState("crewChange");

  const [passRequestsCg, setPassRequestsCg] = useState([]);
  const [passRequestsZawil, setPassRequestsZawil] = useState([]);
  const [passRequestsLoading, setPassRequestsLoading] = useState(false);
  const [passPage, setPassPage] = useState(1);

  const [showZawilBulkModal, setShowZawilBulkModal] = useState(false);
  const [zawilBulkFiles, setZawilBulkFiles] = useState([]);
  const [zawilBulkSubmitting, setZawilBulkSubmitting] = useState(false);
  const zawilBulkFileInputRef = useRef(null);

  // CG Pass single-row upload — no popover, just pick a file and it uploads immediately (AI-read).
  const [cgSingleUploadCrewId, setCgSingleUploadCrewId] = useState(null);
  const cgSingleUploadCrewRef = useRef(null);
  const cgSingleFileInputRef = useRef(null);

  // Zawil Pass single-row upload — no popover, just pick a file and it uploads immediately.
  const [zawilSingleUploadCrewId, setZawilSingleUploadCrewId] = useState(null);
  const zawilSingleUploadCrewRef = useRef(null);
  const zawilSingleFileInputRef = useRef(null);

  const fetchCrewList = useCallback(
    (page) => {
      if (callId == null || callId === "") return;
      setLoading(true);
      crewService
        .getCrewList({ call_id: callId, page, limit: PAGE_SIZE })
        .then((res) => {
          const { rows: nextRows, pagination: nextPagination } = normalizeCrewChangeListResponse(res);
          setRows(nextRows);
          setPagination(nextPagination);
        })
        .catch(() => {
          setRows([]);
        })
        .finally(() => setLoading(false));
    },
    [callId]
  );

  useEffect(() => {
    fetchCrewList(1);
  }, [fetchCrewList]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const refreshPassRequests = useCallback(() => {
    if (callId == null || callId === "") {
      setPassRequestsCg([]);
      setPassRequestsZawil([]);
      return;
    }
    setPassRequestsLoading(true);
    getPassRequests(callId)
      .then((res) => {
        const { cg, zawil } = extractPassRequestsFromEnvelope(res);
        setPassRequestsCg(flattenPassRequestCrew(cg));
        setPassRequestsZawil(flattenPassRequestCrew(zawil));
      })
      .catch(() => {
        setPassRequestsCg([]);
        setPassRequestsZawil([]);
      })
      .finally(() => setPassRequestsLoading(false));
  }, [callId]);

  useEffect(() => {
    refreshPassRequests();
  }, [refreshPassRequests]);

  // Selection is page/list scoped — clear it when the visible list changes.
  useEffect(() => {
    setPassPage(1);
    setSelectedCrewIds(new Set());
  }, [activeTab]);

  const isPassTab = activeTab === "cg" || activeTab === "zawil";
  const activePassList = activeTab === "cg" ? passRequestsCg : activeTab === "zawil" ? passRequestsZawil : [];
  const passTotalPages = Math.max(1, Math.ceil(activePassList.length / PAGE_SIZE));
  const passPageRows = activePassList.slice((passPage - 1) * PAGE_SIZE, passPage * PAGE_SIZE);

  const displayRows = isPassTab ? passPageRows : rows;
  const displayLoading = isPassTab ? passRequestsLoading : loading;
  const activeTotal = isPassTab ? activePassList.length : pagination.total;
  const activePage = isPassTab ? passPage : pagination.page;
  const activeTotalPages = isPassTab ? passTotalPages : totalPages;
  const pageStartDisplay = activeTotal === 0 ? 0 : (activePage - 1) * PAGE_SIZE + 1;
  const pageEndDisplay = Math.min(activePage * PAGE_SIZE, activeTotal);

  const goToPage = (page) => {
    if (page < 1 || page > activeTotalPages) return;
    if (isPassTab) setPassPage(page);
    else fetchCrewList(page);
  };

  const refreshActiveList = useCallback(() => {
    if (activeTab === "crewChange") fetchCrewList(pagination.page);
    else refreshPassRequests();
  }, [activeTab, fetchCrewList, pagination.page, refreshPassRequests]);

  const toggleRowSelection = (crewId) => {
    setSelectedCrewIds((prev) => {
      const next = new Set(prev);
      if (next.has(crewId)) next.delete(crewId);
      else next.add(crewId);
      return next;
    });
  };

  const headerChecked =
    displayRows.length > 0 && displayRows.every((row) => selectedCrewIds.has(getCrewChangeCrewId(row)));

  const toggleHeaderSelection = (checked) => {
    setSelectedCrewIds((prev) => {
      const next = new Set(prev);
      displayRows.forEach((row) => {
        const id = getCrewChangeCrewId(row);
        if (id == null) return;
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const selectedRows = (isPassTab ? activePassList : rows).filter((row) =>
    selectedCrewIds.has(getCrewChangeCrewId(row))
  );

  // CG Pass single-row upload — no popover, just pick a file and it uploads immediately (AI-read).
  const triggerCgSingleUpload = (crew) => {
    cgSingleUploadCrewRef.current = crew;
    if (cgSingleFileInputRef.current) cgSingleFileInputRef.current.value = "";
    cgSingleFileInputRef.current?.click();
  };

  const handleCgSingleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const crew = cgSingleUploadCrewRef.current;
    if (!file || !crew) return;
    const crewId = getCrewChangeCrewId(crew);
    setCgSingleUploadCrewId(crewId);
    try {
      const formData = new FormData();
      formData.append("cg_document[]", file);
      formData.append("crew_id", String(crewId));
      await groService.uploadCgPassAi(formData);
      notify("CG Pass uploaded successfully.", "success");
      refreshActiveList();
    } catch (err) {
      notify(groApiErrorMessage(err, "Upload failed."), "error");
    } finally {
      setCgSingleUploadCrewId(null);
      cgSingleUploadCrewRef.current = null;
    }
  };

  // Zawil Pass single-row upload — no popover, just pick a file and it uploads immediately.
  const triggerZawilSingleUpload = (crew) => {
    zawilSingleUploadCrewRef.current = crew;
    if (zawilSingleFileInputRef.current) zawilSingleFileInputRef.current.value = "";
    zawilSingleFileInputRef.current?.click();
  };

  const handleZawilSingleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const crew = zawilSingleUploadCrewRef.current;
    if (!file || !crew) return;
    const crewId = getCrewChangeCrewId(crew);
    setZawilSingleUploadCrewId(crewId);
    try {
      const formData = new FormData();
      formData.append("zawil_document[]", file);
      formData.append("crew_id", String(crewId));
      await groService.uploadZawilPassAi(formData);
      notify("Zawil Pass uploaded successfully.", "success");
      refreshActiveList();
    } catch (err) {
      notify(groApiErrorMessage(err, "Upload failed."), "error");
    } finally {
      setZawilSingleUploadCrewId(null);
      zawilSingleUploadCrewRef.current = null;
    }
  };

  const resetZawilBulkForm = () => {
    setZawilBulkFiles([]);
    if (zawilBulkFileInputRef.current) zawilBulkFileInputRef.current.value = "";
  };

  const addZawilBulkFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    setZawilBulkFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}_${f.lastModified}`));
      const merged = [...prev];
      incoming.forEach((file) => {
        const key = `${file.name}_${file.size}_${file.lastModified}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          merged.push(file);
        }
      });
      return merged;
    });
  };

  const removeZawilBulkFile = (index) => {
    setZawilBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleZawilBulkSubmit = async () => {
    if (zawilBulkFiles.length === 0) {
      notify("Please select at least one file to upload.", "warn");
      return;
    }

    setZawilBulkSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("call_id", String(callId));
      zawilBulkFiles.forEach((file) => formData.append("zawil_document[]", file));
      await groService.uploadZawilPassAi(formData);
      notify("Zawil Pass uploaded successfully.", "success");
      setShowZawilBulkModal(false);
      resetZawilBulkForm();
      refreshPassRequests();
    } catch (err) {
      notify(groApiErrorMessage(err, "Upload failed."), "error");
    } finally {
      setZawilBulkSubmitting(false);
    }
  };

  const handleGenerateUploaded = () => {
    setView("roster");
    setSelectedCrewIds(new Set());
    refreshPassRequests();
  };

  if (view === "generate") {
    return (
      <CrewChangeCgPassGenerateView
        portId={portId}
        selectedRows={selectedRows}
        onBack={() => setView("roster")}
        onUploaded={handleGenerateUploaded}
      />
    );
  }

  return (
    <div className="gro-crew-immigration-panel">
      <div className="gro-crew-immigration-toolbar gro-crew-change-toolbar">
        <div className="gro-pass-segments" role="tablist" aria-label="Crew change view">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "crewChange"}
            className={`gro-pass-segment${activeTab === "crewChange" ? " gro-pass-segment--active" : ""}`}
            onClick={() => setActiveTab("crewChange")}
          >
            Crew Change
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "zawil"}
            className={`gro-pass-segment${activeTab === "zawil" ? " gro-pass-segment--active" : ""}`}
            onClick={() => setActiveTab("zawil")}
          >
            Zawil Pass
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cg"}
            className={`gro-pass-segment${activeTab === "cg" ? " gro-pass-segment--active" : ""}`}
            onClick={() => setActiveTab("cg")}
          >
            CG Pass
          </button>
        </div>
        {activeTab === "cg" && (
          <div className="gro-crew-change-toolbar-actions">
            <button
              type="button"
              className="gro-pass-segment gro-crew-change-action-btn"
              disabled={selectedCrewIds.size === 0}
              onClick={() => setView("generate")}
            >
              Generate CG Pass
            </button>
          </div>
        )}
        {activeTab === "zawil" && (
          <div className="gro-crew-change-toolbar-actions">
            <button
              type="button"
              className="gro-pass-segment gro-crew-change-action-btn"
              onClick={() => setShowZawilBulkModal(true)}
            >
              Bulk Upload Zawil Pass
            </button>
          </div>
        )}
      </div>

      <div className="gro-crew-immigration-table-wrap">
        <table className="gro-crew-immigration-table">
          <thead>
            <tr>
              {activeTab === "cg" && (
                <th className="gro-pass-table-th-check">
                  <input
                    type="checkbox"
                    className="gro-pass-row-check"
                    checked={headerChecked}
                    disabled={displayRows.length === 0}
                    aria-label="Select all rows on this page"
                    onChange={(e) => toggleHeaderSelection(e.target.checked)}
                  />
                </th>
              )}
              <th>Crew Name</th>
              <th>Nationality</th>
              <th>Rank</th>
              <th>Movement Type</th>
              <th>Passport</th>
              <th>Iqama</th>
              <th>Visa</th>
              <th>CG Pass</th>
              <th>Zawil Pass</th>
            </tr>
          </thead>
          <tbody>
            {displayLoading ? (
              <tr>
                <td colSpan={activeTab === "cg" ? 10 : 9}>Loading…</td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={activeTab === "cg" ? 10 : 9}>No crew found.</td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const f = crewChangeRowFields(row);
                const checked = selectedCrewIds.has(f.crewId);
                return (
                  <tr key={f.crewId}>
                    {activeTab === "cg" && (
                      <td className="gro-pass-table-td-check">
                        <input
                          type="checkbox"
                          className="gro-pass-row-check"
                          checked={checked}
                          aria-label={`Select ${f.crewName}`}
                          onChange={() => toggleRowSelection(f.crewId)}
                        />
                      </td>
                    )}
                    <td>{f.crewName}</td>
                    <td>{f.nationality}</td>
                    <td>{f.rank}</td>
                    <td>{f.movementType}</td>
                    <td>{f.passport}</td>
                    <td>{f.iqama}</td>
                    <td>{f.visa}</td>
                    <td>
                      <button
                        type="button"
                        className="gro-crew-change-row-upload-btn"
                        title={`Upload CG Pass for ${f.crewName}`}
                        aria-label={`Upload CG Pass for ${f.crewName}`}
                        disabled={cgSingleUploadCrewId === f.crewId}
                        onClick={() => triggerCgSingleUpload(row)}
                      >
                        {cgSingleUploadCrewId === f.crewId ? (
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        ) : (
                          <FiUpload />
                        )}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="gro-crew-change-row-upload-btn"
                        title={`Upload Zawil Pass for ${f.crewName}`}
                        aria-label={`Upload Zawil Pass for ${f.crewName}`}
                        disabled={zawilSingleUploadCrewId === f.crewId}
                        onClick={() => triggerZawilSingleUpload(row)}
                      >
                        {zawilSingleUploadCrewId === f.crewId ? (
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        ) : (
                          <FiUpload />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="gro-crew-immigration-pagination">
        <p className="gro-crew-immigration-pagination-text">
          {`Showing ${pageStartDisplay}-${pageEndDisplay} of ${activeTotal}`}
        </p>
        <div className="gro-crew-immigration-pagination-controls">
          <button
            type="button"
            className="gro-crew-immigration-page-btn"
            onClick={() => goToPage(activePage - 1)}
            disabled={activePage === 1}
          >
            Previous
          </button>
          {Array.from({ length: activeTotalPages }, (_, i) => i + 1).map((pageNo) => (
            <button
              key={pageNo}
              type="button"
              className={`gro-crew-immigration-page-btn${pageNo === activePage ? " gro-crew-immigration-page-btn--active" : ""}`}
              onClick={() => goToPage(pageNo)}
            >
              {pageNo}
            </button>
          ))}
          <button
            type="button"
            className="gro-crew-immigration-page-btn"
            onClick={() => goToPage(activePage + 1)}
            disabled={activePage === activeTotalPages}
          >
            Next
          </button>
        </div>
      </div>

      <input
        ref={cgSingleFileInputRef}
        type="file"
        className="gro-premium-upload-input-hidden"
        onChange={handleCgSingleFileChange}
      />

      <input
        ref={zawilSingleFileInputRef}
        type="file"
        className="gro-premium-upload-input-hidden"
        onChange={handleZawilSingleFileChange}
      />

      {showZawilBulkModal && typeof document !== "undefined" && document.body
        ? createPortal(
            <div
              className="gro-stage-upload-modal-overlay"
              role="presentation"
              onClick={() => {
                if (zawilBulkSubmitting) return;
                setShowZawilBulkModal(false);
                resetZawilBulkForm();
              }}
            >
              <div
                className="gro-stage-upload-modal gro-stage-upload-modal--multi"
                role="dialog"
                aria-modal="true"
                aria-label="Bulk Upload Zawil Pass"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="gro-inward-popover-header">Bulk Upload Zawil Pass</div>
                <div className="gro-inward-popover-body">
                  <button
                    type="button"
                    className={`gro-stage-upload-dropzone${zawilBulkFiles.length > 0 ? " gro-stage-upload-dropzone--has-file" : ""}`}
                    disabled={zawilBulkSubmitting}
                    onClick={() => zawilBulkFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (zawilBulkSubmitting) return;
                      addZawilBulkFiles(e.dataTransfer?.files);
                    }}
                  >
                    <FiUploadCloud className="gro-stage-upload-dropzone-icon" />
                    <span className="gro-stage-upload-dropzone-text">Drag & drop files here, or click to browse</span>
                  </button>
                  <input
                    ref={zawilBulkFileInputRef}
                    type="file"
                    multiple
                    className="gro-premium-upload-input-hidden"
                    disabled={zawilBulkSubmitting}
                    onChange={(e) => {
                      addZawilBulkFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {zawilBulkFiles.length > 0 ? (
                    <ul className="gro-stage-upload-file-list">
                      {zawilBulkFiles.map((file, index) => (
                        <li key={`${file.name}_${file.size}_${file.lastModified}`} className="gro-stage-upload-file-item">
                          <span className="gro-stage-upload-file-item-name" title={file.name}>
                            {file.name}
                          </span>
                          <button
                            type="button"
                            className="gro-stage-upload-file-item-remove"
                            aria-label={`Remove ${file.name}`}
                            disabled={zawilBulkSubmitting}
                            onClick={() => removeZawilBulkFile(index)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="gro-stage-upload-actions gro-inward-popover-footer">
                  <button
                    type="button"
                    className="gro-inward-popover-btn-cancel"
                    disabled={zawilBulkSubmitting}
                    onClick={() => {
                      setShowZawilBulkModal(false);
                      resetZawilBulkForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gro-inward-popover-btn-submit"
                    disabled={zawilBulkSubmitting || zawilBulkFiles.length === 0}
                    onClick={handleZawilBulkSubmit}
                  >
                    {zawilBulkSubmitting
                      ? "Uploading…"
                      : `Upload${zawilBulkFiles.length > 0 ? ` (${zawilBulkFiles.length})` : ""}`}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

CrewChangePassPanel.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
