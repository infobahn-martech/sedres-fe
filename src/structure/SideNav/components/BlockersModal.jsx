import { useState, useRef, useEffect } from 'react';
import { FiX, FiPlus, FiMoreVertical, FiInfo, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import NewBlockerModal from './NewBlockerModal';
import DynamicIcon from './DynamicIcon';
import useKanbanManagementReducer, {
  isKanbanManagementRowDisabled,
} from '../../../store/KanbanManagementReducer';
import { normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import '../../../design/scss/blockers-modal.scss';

const contrastIconFg = (bg) => {
  if (!bg || typeof bg !== 'string') return '#1a1a1a';
  let r;
  let g;
  let b;
  const trimmed = bg.trim();
  if (trimmed.startsWith('#')) {
    const h = trimmed.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length < 6) return '#1a1a1a';
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const m = trimmed.match(/\d+/g);
    if (!m || m.length < 3) return '#1a1a1a';
    r = Number(m[0]);
    g = Number(m[1]);
    b = Number(m[2]);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#1a1a1a' : '#ffffff';
};

const BlockerIconSwatch = ({ color_code, iconKey }) => {
  const hex = normalizeHexColor(color_code);
  const fg = contrastIconFg(hex);
  return (
    <div
      className="tags-modal-tag-color-swatch"
      style={{
        backgroundColor: hex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden
    >
      <DynamicIcon iconKey={iconKey} size={16} color={fg} />
    </div>
  );
};

const availabilityDotClass = (level) => {
  const normalized = String(level ?? '').trim().toLowerCase();
  if (normalized === 'global') return 'is-global';
  if (normalized === 'auto') return 'is-auto';
  return '';
};

const BlockersModal = ({ show, onClose }) => {
  const cardBlockers = useKanbanManagementReducer((s) => s.cardBlockers);
  const cardBlockersLoading = useKanbanManagementReducer((s) => s.cardBlockersLoading);
  const cardBlockersError = useKanbanManagementReducer((s) => s.cardBlockersError);
  const cardBlockersPagination = useKanbanManagementReducer((s) => s.cardBlockersPagination);
  const workspaceBoardOptions = useKanbanManagementReducer((s) => s.workspaceBoardOptions);
  const workspaceBoardsLoading = useKanbanManagementReducer((s) => s.workspaceBoardsLoading);

  const fetchKanbanCardBlockers = useKanbanManagementReducer((s) => s.fetchKanbanCardBlockers);
  const fetchWorkspaceBoardPickerOptions = useKanbanManagementReducer(
    (s) => s.fetchWorkspaceBoardPickerOptions
  );
  const createKanbanCardBlocker = useKanbanManagementReducer((s) => s.createKanbanCardBlocker);
  const updateKanbanCardBlockerRecord = useKanbanManagementReducer(
    (s) => s.updateKanbanCardBlockerRecord
  );
  const disableKanbanCardBlockerRecord = useKanbanManagementReducer(
    (s) => s.disableKanbanCardBlockerRecord
  );
  const enableKanbanCardBlockerRecord = useKanbanManagementReducer(
    (s) => s.enableKanbanCardBlockerRecord
  );
  const deleteKanbanCardBlockerRecord = useKanbanManagementReducer(
    (s) => s.deleteKanbanCardBlockerRecord
  );

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  const [showNewBlockerModal, setShowNewBlockerModal] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState(null);

  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const actionMenuRefs = useRef({});

  useEffect(() => {
    if (!show) {
      setSearchValue('');
      setDebouncedSearch('');
      setCurrentPage(1);
      return;
    }
    fetchWorkspaceBoardPickerOptions();
  }, [show, fetchWorkspaceBoardPickerOptions]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    if (!show) return;
    fetchKanbanCardBlockers({ search: debouncedSearch, page: currentPage, limit });
  }, [show, debouncedSearch, currentPage, limit, fetchKanbanCardBlockers]);

  useEffect(() => {
    const serverPage = Number(cardBlockersPagination?.current_page || 1);
    if (serverPage !== currentPage) {
      setCurrentPage(serverPage);
    }
  }, [cardBlockersPagination?.current_page, currentPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openActionMenuId !== null) {
        const menuRef = actionMenuRefs.current[openActionMenuId];
        if (menuRef && !menuRef.contains(event.target)) {
          setOpenActionMenuId(null);
        }
      }
    };

    if (openActionMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openActionMenuId]);

  const handleActionMenuToggle = (blockerId, event) => {
    event.stopPropagation();
    const id = String(blockerId);
    setOpenActionMenuId(openActionMenuId === id ? null : id);
  };

  const refreshParams = () => ({
    search: debouncedSearch,
    page: currentPage,
    limit,
  });

  const handleEdit = (row) => {
    setEditingBlocker({
      blocker_id: row.blocker_id,
      label: row.label,
      color_code: row.color_code,
      icon: row.icon,
      availability_level: row.availabilityLevel,
      boards: row.boardsRaw,
    });
    setShowNewBlockerModal(true);
    setOpenActionMenuId(null);
  };

  const handleDisable = async (blockerId) => {
    const id = String(blockerId);
    setOpenActionMenuId(null);
    try {
      await disableKanbanCardBlockerRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleEnable = async (blockerId) => {
    const id = String(blockerId);
    setOpenActionMenuId(null);
    try {
      await enableKanbanCardBlockerRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleDelete = (blockerId) => {
    const id = String(blockerId);
    setOpenActionMenuId(null);
    if (!window.confirm('Delete this blocker? This cannot be undone.')) {
      return;
    }
    (async () => {
      try {
        await deleteKanbanCardBlockerRecord(id, refreshParams());
      } catch {
        /* AlertReducer in store */
      }
    })();
  };

  const handleAddBlocker = () => {
    setEditingBlocker(null);
    setShowNewBlockerModal(true);
  };

  const closeBlockerFormModal = () => {
    setShowNewBlockerModal(false);
    setEditingBlocker(null);
  };

  const handleBlockerFormSave = async (payload) => {
    const apiBody = {
      blocker_name: payload.label,
      color_code: payload.color_code,
      icon_name: payload.icon,
      board_ids: payload.board_ids,
      availability_level: payload.availability_level,
    };
    if (payload.mode === 'create') {
      await createKanbanCardBlocker(apiBody, refreshParams());
    } else {
      await updateKanbanCardBlockerRecord(payload.blocker_id, apiBody, refreshParams());
    }
  };

  const blockerLimit = Number(cardBlockersPagination?.limit) || limit;
  const hasMetaLastPage = Number(cardBlockersPagination?.last_page || 0) > 0;
  const hasNextByMeta = hasMetaLastPage
    ? currentPage < Number(cardBlockersPagination.last_page)
    : true;
  const hasNextPage = hasNextByMeta && cardBlockers.length === blockerLimit;

  const handleSearchChange = (value) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="blockers-modal"
      centered
      size="xl"
    >
      <Modal.Header bsPrefix="blockers-modal-header">
        <div className="blockers-modal-header-text">
          <Modal.Title className="blockers-modal-title">Blockers</Modal.Title>
          <p className="blockers-modal-subtitle">Rules that restrict availability across boards</p>
        </div>
        <button
          type="button"
          className="blockers-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={20} />
        </button>
      </Modal.Header>
      <Modal.Body className="blockers-modal-body tags-modal-body">
        <div className="blockers-toolbar-section">
          <div className="blockers-filter-bar">
            <div className="blockers-filter-left">
              <div className="blockers-filter-input-wrap">
                <FiSearch size={16} className="blockers-filter-search-icon" />
                <input
                  type="text"
                  className="blockers-filter-input"
                  placeholder="Filter blockers by label or board..."
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
            <div className="blockers-filter-right">
              <button
                type="button"
                className="blockers-add-btn"
                aria-label="Add blocker"
                onClick={handleAddBlocker}
              >
                <FiPlus size={20} />
              </button>
            </div>
          </div>

          {cardBlockersError && (
            <div className="tags-modal-error-banner" role="alert">
              <FiAlertCircle size={18} aria-hidden />
              <span className="tags-modal-error-text">{cardBlockersError}</span>
              <button
                type="button"
                className="tags-modal-error-retry"
                onClick={() =>
                  fetchKanbanCardBlockers({
                    search: debouncedSearch,
                    page: currentPage,
                    limit,
                  })
                }
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="blockers-table-section">
          <div className="blockers-table-wrapper blockers-table-wrapper--tags-min-body">
            <table className="blockers-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M2 4h12M2 8h12M2 12h12"
                        stroke="#666"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <circle cx="4" cy="4" r="1" fill="#666" />
                      <circle cx="4" cy="8" r="1" fill="#666" />
                      <circle cx="4" cy="12" r="1" fill="#666" />
                    </svg>
                  </th>
                  <th>
                    <div className="blockers-th-content">
                      <span>Label</span>
                    </div>
                  </th>
                  <th>
                    <div className="blockers-th-content">
                      <span>Availability level</span>
                      <button type="button" className="blockers-th-info-btn">
                        <FiInfo size={14} />
                      </button>
                    </div>
                  </th>
                  <th>
                    <div className="blockers-th-content">
                      <span>Boards</span>
                    </div>
                  </th>
                  <th style={{ width: '40px' }}>
                    <span>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cardBlockersLoading ? (
                  <tr>
                    <td colSpan="5" className="tags-modal-loading-cell">
                      Loading blockers…
                    </td>
                  </tr>
                ) : cardBlockers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ textAlign: 'center', padding: '40px', color: '#999' }}
                    >
                      No blockers found
                    </td>
                  </tr>
                ) : (
                  cardBlockers.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <BlockerIconSwatch color_code={row.color_code} iconKey={row.icon} />
                      </td>
                      <td>
                        <span className="blockers-label-text">{row.label}</span>
                      </td>
                      <td>
                        <span className="blockers-availability-cell">
                          <span className={`blockers-availability-dot ${availabilityDotClass(row.availabilityLevel)}`} />
                          <span className={`blockers-availability-text ${availabilityDotClass(row.availabilityLevel)}`}>
                            {row.availabilityLevel}
                          </span>
                        </span>
                      </td>
                      <td>
                        {row.boardsRaw && row.boardsRaw.length > 0 ? (
                          <span className="blockers-boards-cell">
                            {row.boardsRaw.map((b) => (
                              <span key={b.board_id} className="blockers-board-badge">
                                {b.board_name}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="blockers-boards-empty">No boards assigned</span>
                        )}
                      </td>
                      <td>
                        <div
                          ref={(el) => {
                            actionMenuRefs.current[String(row.id)] = el;
                          }}
                          style={{ position: 'relative' }}
                        >
                          <button
                            type="button"
                            className="blockers-kebab-btn"
                            aria-label="Action"
                            onClick={(e) => handleActionMenuToggle(row.id, e)}
                          >
                            <FiMoreVertical size={18} />
                          </button>
                          {openActionMenuId === String(row.id) && (
                            <div className="blockers-action-menu">
                              {isKanbanManagementRowDisabled(row.status) ? (
                                <button
                                  type="button"
                                  className="blockers-action-menu-item"
                                  onClick={() => handleEnable(row.blocker_id ?? row.id)}
                                >
                                  Enable
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="blockers-action-menu-item"
                                    onClick={() => handleEdit(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="blockers-action-menu-item"
                                    onClick={() => handleDisable(row.blocker_id ?? row.id)}
                                  >
                                    Disable
                                  </button>
                                  <button
                                    type="button"
                                    className="blockers-action-menu-item blockers-action-menu-item-danger"
                                    onClick={() => handleDelete(row.blocker_id ?? row.id)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="tags-modal-pagination">
            <span className="tags-modal-pagination-count">
              {cardBlockersPagination?.total != null
                ? `${cardBlockersPagination.total} blocker${Number(cardBlockersPagination.total) === 1 ? '' : 's'}`
                : `${cardBlockers.length} blocker${cardBlockers.length === 1 ? '' : 's'}`}
            </span>
            <div className="tags-modal-pagination-controls">
              <button
                type="button"
                className="tags-modal-pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1 || cardBlockersLoading}
              >
                Previous
              </button>
              <span className="tags-modal-pagination-page">Page {currentPage}</span>
              <button
                type="button"
                className="tags-modal-pagination-btn"
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={!hasNextPage || cardBlockersLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Modal.Body>
      <NewBlockerModal
        show={showNewBlockerModal}
        onClose={closeBlockerFormModal}
        editingBlocker={editingBlocker}
        workspaceBoardOptions={workspaceBoardOptions}
        workspaceBoardsLoading={workspaceBoardsLoading}
        onSave={handleBlockerFormSave}
      />
    </Modal>
  );
};

export default BlockersModal;
