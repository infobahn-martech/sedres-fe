import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiMoreVertical, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import NewStickerModal from './NewStickerModal';
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

const StickerIconSwatch = ({ color_code, iconKey }) => {
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

const StickersModal = ({ show, onClose }) => {
  const cardStickers = useKanbanManagementReducer((s) => s.cardStickers);
  const cardStickersLoading = useKanbanManagementReducer((s) => s.cardStickersLoading);
  const cardStickersError = useKanbanManagementReducer((s) => s.cardStickersError);
  const cardStickersPagination = useKanbanManagementReducer((s) => s.cardStickersPagination);
  const workspaceBoardOptions = useKanbanManagementReducer((s) => s.workspaceBoardOptions);
  const workspaceBoardsLoading = useKanbanManagementReducer((s) => s.workspaceBoardsLoading);

  const fetchKanbanCardStickers = useKanbanManagementReducer((s) => s.fetchKanbanCardStickers);
  const fetchWorkspaceBoardPickerOptions = useKanbanManagementReducer(
    (s) => s.fetchWorkspaceBoardPickerOptions
  );
  const createKanbanCardSticker = useKanbanManagementReducer((s) => s.createKanbanCardSticker);
  const updateKanbanCardStickerRecord = useKanbanManagementReducer(
    (s) => s.updateKanbanCardStickerRecord
  );
  const disableKanbanCardStickerRecord = useKanbanManagementReducer(
    (s) => s.disableKanbanCardStickerRecord
  );
  const enableKanbanCardStickerRecord = useKanbanManagementReducer(
    (s) => s.enableKanbanCardStickerRecord
  );
  const deleteKanbanCardStickerRecord = useKanbanManagementReducer(
    (s) => s.deleteKanbanCardStickerRecord
  );

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  const [showNewStickerModal, setShowNewStickerModal] = useState(false);
  const [editingSticker, setEditingSticker] = useState(null);

  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionMenuPlacement, setActionMenuPlacement] = useState({ top: 0, right: 0 });
  const actionMenuRefs = useRef({});
  const actionMenuPortalRef = useRef(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteStickerId, setSelectedDeleteStickerId] = useState(null);
  const [selectedDeleteStickerLabel, setSelectedDeleteStickerLabel] = useState('');
  const [isDeletingSticker, setIsDeletingSticker] = useState(false);

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
    fetchKanbanCardStickers({ search: debouncedSearch, page: currentPage, limit });
  }, [show, debouncedSearch, currentPage, limit, fetchKanbanCardStickers]);

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

  const handleActionMenuToggle = (stickerId, event) => {
    event.stopPropagation();
    const id = String(stickerId);
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
    limit,
  });

  const handleEdit = (row) => {
    setEditingSticker({
      sticker_id: row.sticker_id,
      label: row.label,
      color_code: row.color_code,
      icon: row.icon,
      availability_level: row.availabilityLevel,
      boards: row.boardsRaw,
    });
    setShowNewStickerModal(true);
    setOpenActionMenuId(null);
  };

  const handleDisable = async (stickerId) => {
    const id = String(stickerId);
    setOpenActionMenuId(null);
    try {
      await disableKanbanCardStickerRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleEnable = async (stickerId) => {
    const id = String(stickerId);
    setOpenActionMenuId(null);
    try {
      await enableKanbanCardStickerRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleDelete = (stickerId, stickerLabel) => {
    setOpenActionMenuId(null);
    setSelectedDeleteStickerId(String(stickerId));
    setSelectedDeleteStickerLabel(stickerLabel ?? '');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedDeleteStickerId(null);
    setSelectedDeleteStickerLabel('');
  };

  const handleConfirmDelete = async () => {
    if (!selectedDeleteStickerId) return;
    setIsDeletingSticker(true);
    try {
      await deleteKanbanCardStickerRecord(selectedDeleteStickerId, refreshParams());
    } catch {
      /* AlertReducer in store */
    } finally {
      setIsDeletingSticker(false);
      closeDeleteModal();
    }
  };

  const handleAddSticker = () => {
    setEditingSticker(null);
    setShowNewStickerModal(true);
  };

  const closeStickerFormModal = () => {
    setShowNewStickerModal(false);
    setEditingSticker(null);
  };

  const handleStickerFormSave = async (payload) => {
    const apiBody = {
      sticker_name: payload.label,
      color_code: payload.color_code,
      icon_name: payload.icon,
      board_ids: payload.board_ids,
      availability_level: payload.availability_level,
    };
    if (payload.mode === 'create') {
      await createKanbanCardSticker(apiBody, refreshParams());
    } else {
      await updateKanbanCardStickerRecord(payload.sticker_id, apiBody, refreshParams());
    }
  };

  const stickerLimit = Number(cardStickersPagination?.limit) || limit;
  // Some kanban_management list endpoints don't honor `limit`/`page` and always return
  // the full unpaginated result set. When that happens (more rows came back than we
  // asked for), fall back to paginating the fetched list on the client.
  const isBackendPaginated = cardStickers.length <= stickerLimit;
  const pageStickers = isBackendPaginated
    ? cardStickers
    : cardStickers.slice((currentPage - 1) * stickerLimit, currentPage * stickerLimit);
  // `last_page` in the meta has proven unreliable on this endpoint, but `total` matches
  // the real record count, so drive "is there a next page" off total vs. currentPage*limit
  // instead of trusting last_page.
  const metaTotal = Number(cardStickersPagination?.total);
  const hasReliableTotal = Number.isFinite(metaTotal) && metaTotal > 0;
  const hasNextPage = isBackendPaginated
    ? (hasReliableTotal
      ? currentPage * stickerLimit < metaTotal
      : cardStickers.length === stickerLimit)
    : currentPage * stickerLimit < cardStickers.length;

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
          <Modal.Title className="blockers-modal-title">Stickers</Modal.Title>
          <p className="blockers-modal-subtitle">Stickers available across boards</p>
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
                placeholder="Filter stickers by label or board..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="blockers-filter-right">
            <button
              type="button"
              className="blockers-add-btn"
              aria-label="Add sticker"
              onClick={handleAddSticker}
            >
              <FiPlus size={20} />
            </button>
          </div>
        </div>

        {cardStickersError && (
          <div className="tags-modal-error-banner" role="alert">
            <FiAlertCircle size={18} aria-hidden />
            <span className="tags-modal-error-text">{cardStickersError}</span>
            <button
              type="button"
              className="tags-modal-error-retry"
              onClick={() =>
                fetchKanbanCardStickers({
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
              {cardStickersLoading ? (
                <tr>
                  <td colSpan="5" className="tags-modal-loading-cell">
                    Loading stickers…
                  </td>
                </tr>
              ) : pageStickers.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: 'center', padding: '40px', color: '#999' }}
                  >
                    No stickers found
                  </td>
                </tr>
              ) : (
                pageStickers.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <StickerIconSwatch color_code={row.color_code} iconKey={row.icon} />
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
            {isBackendPaginated && cardStickersPagination?.total != null
              ? `${cardStickersPagination.total} sticker${Number(cardStickersPagination.total) === 1 ? '' : 's'}`
              : `${cardStickers.length} sticker${cardStickers.length === 1 ? '' : 's'}`}
          </span>
          <div className="tags-modal-pagination-controls">
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || cardStickersLoading}
            >
              Previous
            </button>
            <span className="tags-modal-pagination-page">Page {currentPage}</span>
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={!hasNextPage || cardStickersLoading}
            >
              Next
            </button>
          </div>
        </div>
      </Modal.Body>
      <NewStickerModal
        show={showNewStickerModal}
        onClose={closeStickerFormModal}
        editingSticker={editingSticker}
        workspaceBoardOptions={workspaceBoardOptions}
        workspaceBoardsLoading={workspaceBoardsLoading}
        onSave={handleStickerFormSave}
      />
      {!!showDeleteModal && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          onCancel={closeDeleteModal}
          onConfirm={handleConfirmDelete}
          deleteText={`Delete sticker "${selectedDeleteStickerLabel}"? This cannot be undone.`}
          isLoading={isDeletingSticker}
        />
      )}

      {openActionMenuId !== null &&
        (() => {
          const activeRow = cardStickers.find((r) => String(r.id) === openActionMenuId);
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
                  onClick={() => handleEnable(activeRow.sticker_id ?? activeRow.id)}
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
                    onClick={() => handleDisable(activeRow.sticker_id ?? activeRow.id)}
                  >
                    Disable
                  </button>
                  <button
                    type="button"
                    className="blockers-action-menu-item blockers-action-menu-item-danger"
                    onClick={() => handleDelete(activeRow.sticker_id ?? activeRow.id, activeRow.label)}
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

export default StickersModal;
