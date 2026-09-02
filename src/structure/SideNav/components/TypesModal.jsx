import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiMoreVertical, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import NewTypeModal from './NewTypeModal';
import DeleteConfirmationModal from '../../../components/DeleteConfirmationModal';
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

const TypeIconSwatch = ({ color_code, iconKey }) => {
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

const ACTION_MENU_GAP = 4;
const ACTION_MENU_MIN_HEIGHT = 150;
const ACTION_MENU_PORTAL_Z = 10700;

function computeActionMenuPlacement(rect) {
  const spaceBelow = window.innerHeight - rect.bottom - ACTION_MENU_GAP;
  const spaceAbove = rect.top - ACTION_MENU_GAP;
  const openUp = spaceBelow < ACTION_MENU_MIN_HEIGHT && spaceAbove > spaceBelow;
  return {
    right: window.innerWidth - rect.right,
    top: openUp ? undefined : rect.bottom + ACTION_MENU_GAP,
    bottom: openUp ? window.innerHeight - rect.top + ACTION_MENU_GAP : undefined,
  };
}

const TypesModal = ({ show, onClose }) => {
  const cardTypes = useKanbanManagementReducer((s) => s.cardTypes);
  const cardTypesLoading = useKanbanManagementReducer((s) => s.cardTypesLoading);
  const cardTypesError = useKanbanManagementReducer((s) => s.cardTypesError);
  const cardTypesPagination = useKanbanManagementReducer((s) => s.cardTypesPagination);
  const workspaceBoardOptions = useKanbanManagementReducer((s) => s.workspaceBoardOptions);
  const workspaceBoardsLoading = useKanbanManagementReducer((s) => s.workspaceBoardsLoading);

  const fetchKanbanCardTypes = useKanbanManagementReducer((s) => s.fetchKanbanCardTypes);
  const fetchWorkspaceBoardPickerOptions = useKanbanManagementReducer(
    (s) => s.fetchWorkspaceBoardPickerOptions
  );
  const createKanbanCardType = useKanbanManagementReducer((s) => s.createKanbanCardType);
  const updateKanbanCardTypeRecord = useKanbanManagementReducer((s) => s.updateKanbanCardTypeRecord);
  const disableKanbanCardTypeRecord = useKanbanManagementReducer((s) => s.disableKanbanCardTypeRecord);
  const enableKanbanCardTypeRecord = useKanbanManagementReducer((s) => s.enableKanbanCardTypeRecord);
  const deleteKanbanCardTypeRecord = useKanbanManagementReducer((s) => s.deleteKanbanCardTypeRecord);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);

  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionMenuPlacement, setActionMenuPlacement] = useState({ top: 0, right: 0 });
  const actionMenuRefs = useRef({});
  const actionMenuPortalRef = useRef(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteTypeId, setSelectedDeleteTypeId] = useState(null);
  const [selectedDeleteTypeLabel, setSelectedDeleteTypeLabel] = useState('');
  const [isDeletingType, setIsDeletingType] = useState(false);

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
    fetchKanbanCardTypes({ search: debouncedSearch, page: currentPage, per_page: perPage });
  }, [show, debouncedSearch, currentPage, perPage, fetchKanbanCardTypes]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openActionMenuId !== null) {
        const menuRef = actionMenuRefs.current[openActionMenuId];
        const t = event.target;
        if (menuRef?.contains(t)) return;
        if (actionMenuPortalRef.current?.contains(t)) return;
        setOpenActionMenuId(null);
      }
    };

    if (openActionMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openActionMenuId]);

  const handleActionMenuToggle = (typeId, event) => {
    event.stopPropagation();
    const id = String(typeId);
    if (openActionMenuId === id) {
      setOpenActionMenuId(null);
      return;
    }
    setActionMenuPlacement(computeActionMenuPlacement(event.currentTarget.getBoundingClientRect()));
    setOpenActionMenuId(id);
  };

  const refreshParams = () => ({
    search: debouncedSearch,
    page: currentPage,
    per_page: perPage,
  });

  const handleEdit = (row) => {
    setEditingType({
      card_type_id: row.card_type_id,
      label: row.label,
      color_code: row.color_code,
      icon: row.icon,
      availability_level: row.availabilityLevel,
      boards: row.boardsRaw,
    });
    setShowNewTypeModal(true);
    setOpenActionMenuId(null);
  };

  const handleDisable = async (cardTypeId) => {
    const id = String(cardTypeId);
    setOpenActionMenuId(null);
    try {
      await disableKanbanCardTypeRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleEnable = async (cardTypeId) => {
    const id = String(cardTypeId);
    setOpenActionMenuId(null);
    try {
      await enableKanbanCardTypeRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleDelete = (cardTypeId, cardTypeLabel) => {
    setOpenActionMenuId(null);
    setSelectedDeleteTypeId(String(cardTypeId));
    setSelectedDeleteTypeLabel(cardTypeLabel ?? '');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedDeleteTypeId(null);
    setSelectedDeleteTypeLabel('');
  };

  const handleConfirmDelete = async () => {
    if (!selectedDeleteTypeId) return;
    setIsDeletingType(true);
    try {
      await deleteKanbanCardTypeRecord(selectedDeleteTypeId, refreshParams());
    } catch {
      /* AlertReducer in store */
    } finally {
      setIsDeletingType(false);
      closeDeleteModal();
    }
  };

  const handleAddType = () => {
    setEditingType(null);
    setShowNewTypeModal(true);
  };

  const closeTypeFormModal = () => {
    setShowNewTypeModal(false);
    setEditingType(null);
  };

  const handleTypeFormSave = async (payload) => {
    const apiBody = {
      type_name: payload.label,
      color_code: payload.color_code,
      icon_name: payload.icon,
      board_ids: payload.board_ids,
      availability_level: payload.availability_level,
    };
    if (payload.mode === 'create') {
      await createKanbanCardType(apiBody, refreshParams());
    } else {
      await updateKanbanCardTypeRecord(payload.card_type_id, apiBody, refreshParams());
    }
  };

  // Some kanban_management list endpoints don't honor `per_page`/`page` and always
  // return the full unpaginated result set. When that happens (more rows came back
  // than we asked for), fall back to paginating the fetched list on the client.
  const isBackendPaginated = cardTypes.length <= perPage;
  const pageTypes = isBackendPaginated
    ? cardTypes
    : cardTypes.slice((currentPage - 1) * perPage, currentPage * perPage);
  // `last_page` in the meta has proven unreliable on this endpoint, but `total` matches
  // the real record count, so drive "is there a next page" off total vs. currentPage*limit
  // instead of trusting last_page.
  const metaTotal = Number(cardTypesPagination?.total);
  const hasReliableTotal = Number.isFinite(metaTotal) && metaTotal > 0;
  const hasNextPage = isBackendPaginated
    ? (hasReliableTotal
      ? currentPage * perPage < metaTotal
      : cardTypes.length === perPage)
    : currentPage * perPage < cardTypes.length;

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
      <Modal.Header className="blockers-modal-header">
        <div className="blockers-modal-header-text">
          <Modal.Title className="blockers-modal-title">Types</Modal.Title>
          <p className="blockers-modal-subtitle">Card types available across boards</p>
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
        <div className="blockers-filter-bar">
          <div className="blockers-filter-left">
            <div className="blockers-filter-input-wrap">
              <FiSearch size={16} className="blockers-filter-search-icon" />
              <input
                type="text"
                className="blockers-filter-input"
                placeholder="Filter types by label or board..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="blockers-filter-right">
            <button
              type="button"
              className="blockers-add-btn"
              aria-label="Add type"
              onClick={handleAddType}
            >
              <FiPlus size={20} />
            </button>
          </div>
        </div>

        {cardTypesError && (
          <div className="tags-modal-error-banner" role="alert">
            <FiAlertCircle size={18} aria-hidden />
            <span className="tags-modal-error-text">{cardTypesError}</span>
            <button
              type="button"
              className="tags-modal-error-retry"
              onClick={() =>
                fetchKanbanCardTypes({
                  search: debouncedSearch,
                  page: currentPage,
                  per_page: perPage,
                })
              }
            >
              Retry
            </button>
          </div>
        )}

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
              {cardTypesLoading ? (
                <tr>
                  <td colSpan="5" className="tags-modal-loading-cell">
                    Loading types…
                  </td>
                </tr>
              ) : pageTypes.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: 'center', padding: '40px', color: '#999' }}
                  >
                    No types found
                  </td>
                </tr>
              ) : (
                pageTypes.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <TypeIconSwatch color_code={row.color_code} iconKey={row.icon} />
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
            {isBackendPaginated && cardTypesPagination?.total != null
              ? `${cardTypesPagination.total} type${Number(cardTypesPagination.total) === 1 ? '' : 's'}`
              : `${cardTypes.length} type${cardTypes.length === 1 ? '' : 's'}`}
          </span>
          <div className="tags-modal-pagination-controls">
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || cardTypesLoading}
            >
              Previous
            </button>
            <span className="tags-modal-pagination-page">Page {currentPage}</span>
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={!hasNextPage || cardTypesLoading}
            >
              Next
            </button>
          </div>
        </div>
      </Modal.Body>
      <NewTypeModal
        show={showNewTypeModal}
        onClose={closeTypeFormModal}
        editingType={editingType}
        workspaceBoardOptions={workspaceBoardOptions}
        workspaceBoardsLoading={workspaceBoardsLoading}
        onSave={handleTypeFormSave}
      />
      {!!showDeleteModal && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          onCancel={closeDeleteModal}
          onConfirm={handleConfirmDelete}
          deleteText={`Delete type "${selectedDeleteTypeLabel}"? This cannot be undone.`}
          isLoading={isDeletingType}
        />
      )}

      {openActionMenuId !== null &&
        (() => {
          const activeRow = cardTypes.find((r) => String(r.id) === openActionMenuId);
          if (!activeRow) return null;
          return createPortal(
            <div
              className="blockers-action-menu"
              ref={actionMenuPortalRef}
              style={{
                position: 'fixed',
                top: actionMenuPlacement.top,
                bottom: actionMenuPlacement.bottom,
                right: actionMenuPlacement.right,
                zIndex: ACTION_MENU_PORTAL_Z,
              }}
            >
              {isKanbanManagementRowDisabled(activeRow.status) ? (
                <button
                  type="button"
                  className="blockers-action-menu-item"
                  onClick={() => handleEnable(activeRow.card_type_id ?? activeRow.id)}
                >
                  Enable
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="blockers-action-menu-item"
                    onClick={() => handleEdit(activeRow)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="blockers-action-menu-item"
                    onClick={() => handleDisable(activeRow.card_type_id ?? activeRow.id)}
                  >
                    Disable
                  </button>
                  <button
                    type="button"
                    className="blockers-action-menu-item blockers-action-menu-item-danger"
                    onClick={() => handleDelete(activeRow.card_type_id ?? activeRow.id, activeRow.label)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>,
            document.body
          );
        })()}
    </Modal>
  );
};

export default TypesModal;
