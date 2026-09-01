import { useState, useRef, useEffect } from 'react';
import { FiX, FiPlus, FiMoreVertical, FiInfo, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import NewTagModal, { normalizeTagAvailabilityLevel } from './NewTagModal';
import useKanbanManagementReducer, {
  isKanbanManagementRowDisabled,
} from '../../../store/KanbanManagementReducer';
import '../../../design/scss/blockers-modal.scss';

/** Color swatch for tag row */
const TagColorSwatch = ({ color }) => (
  <div
    className="tags-modal-tag-color-swatch"
    style={{ backgroundColor: color }}
    aria-hidden
  />
);

const availabilityDotClass = (level) => {
  const normalized = String(level ?? '').trim().toLowerCase();
  if (normalized === 'global') return 'is-global';
  if (normalized === 'auto') return 'is-auto';
  return '';
};

const TagsModal = ({ show, onClose }) => {
  const tags = useKanbanManagementReducer((s) => s.tags);
  const tagsLoading = useKanbanManagementReducer((s) => s.tagsLoading);
  const tagsError = useKanbanManagementReducer((s) => s.tagsError);
  const tagsPagination = useKanbanManagementReducer((s) => s.tagsPagination);
  const workspaceBoardOptions = useKanbanManagementReducer((s) => s.workspaceBoardOptions);
  const workspaceBoardsLoading = useKanbanManagementReducer((s) => s.workspaceBoardsLoading);

  const fetchKanbanTags = useKanbanManagementReducer((s) => s.fetchKanbanTags);
  const fetchWorkspaceBoardPickerOptions = useKanbanManagementReducer(
    (s) => s.fetchWorkspaceBoardPickerOptions
  );
  const createKanbanTag = useKanbanManagementReducer((s) => s.createKanbanTag);
  const updateKanbanTagRecord = useKanbanManagementReducer((s) => s.updateKanbanTagRecord);
  const disableKanbanTagRecord = useKanbanManagementReducer((s) => s.disableKanbanTagRecord);
  const enableKanbanTagRecord = useKanbanManagementReducer((s) => s.enableKanbanTagRecord);
  const deleteKanbanTagRecord = useKanbanManagementReducer((s) => s.deleteKanbanTagRecord);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

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
    fetchKanbanTags({ search: debouncedSearch, page: currentPage, per_page: perPage });
  }, [show, debouncedSearch, currentPage, perPage, fetchKanbanTags]);

  useEffect(() => {
    const serverPage = Number(tagsPagination?.current_page || 1);
    if (serverPage !== currentPage) {
      setCurrentPage(serverPage);
    }
  }, [tagsPagination?.current_page, currentPage]);

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

  const handleActionMenuToggle = (tagId, event) => {
    event.stopPropagation();
    const id = String(tagId);
    setOpenActionMenuId(openActionMenuId === id ? null : id);
  };

  const refreshParams = () => ({
    search: debouncedSearch,
    page: currentPage,
    per_page: perPage,
  });

  const handleEdit = (tag) => {
    setEditingTag({
      tag_id: tag.id,
      label: tag.label,
      availability_level: normalizeTagAvailabilityLevel(tag.availabilityLevel),
      color_code: tag.color_code,
      boards: tag.boardsRaw,
    });
    setShowNewTagModal(true);
    setOpenActionMenuId(null);
  };

  const handleDisable = async (tagId) => {
    const id = String(tagId);
    setOpenActionMenuId(null);
    try {
      await disableKanbanTagRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleEnable = async (tagId) => {
    const id = String(tagId);
    setOpenActionMenuId(null);
    try {
      await enableKanbanTagRecord(id, refreshParams());
    } catch {
      /* AlertReducer in store */
    }
  };

  const handleDelete = (tagId) => {
    const id = String(tagId);
    setOpenActionMenuId(null);
    if (
      !window.confirm(
        'Delete this tag? This cannot be undone.'
      )
    ) {
      return;
    }
    (async () => {
      try {
        await deleteKanbanTagRecord(id, refreshParams());
      } catch {
        /* AlertReducer in store */
      }
    })();
  };

  const handleAddTag = () => {
    setEditingTag(null);
    setShowNewTagModal(true);
  };

  const closeTagFormModal = () => {
    setShowNewTagModal(false);
    setEditingTag(null);
  };

  const handleTagFormSave = async (payload) => {
    if (payload.mode === 'create') {
      await createKanbanTag({
        color_code: payload.color_code,
        label: payload.label,
        availability_level: payload.availability_level,
        board_ids: payload.board_ids,
      }, refreshParams());
    } else {
      await updateKanbanTagRecord(payload.tag_id, {
        label: payload.label,
        availability_level: payload.availability_level,
        color_code: payload.color_code,
        board_ids: payload.board_ids,
      }, refreshParams());
    }
  };

  const hasMetaLastPage = Number(tagsPagination?.last_page || 0) > 0;
  const hasNextByMeta = hasMetaLastPage ? currentPage < Number(tagsPagination.last_page) : true;
  const hasNextPage = hasNextByMeta && tags.length === perPage;

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
          <Modal.Title className="blockers-modal-title">Tags</Modal.Title>
          <p className="blockers-modal-subtitle">Tags available across boards</p>
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
                placeholder="Filter tags by label or board..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="blockers-filter-right">
            <button
              type="button"
              className="blockers-add-btn"
              aria-label="Add tag"
              onClick={handleAddTag}
            >
              <FiPlus size={20} />
            </button>
          </div>
        </div>

        {tagsError && (
          <div className="tags-modal-error-banner" role="alert">
            <FiAlertCircle size={18} aria-hidden />
            <span className="tags-modal-error-text">{tagsError}</span>
            <button
              type="button"
              className="tags-modal-error-retry"
              onClick={() =>
                fetchKanbanTags({
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
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
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
                    <button
                      type="button"
                      className="blockers-th-info-btn"
                    >
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
              {tagsLoading ? (
                <tr>
                  <td colSpan="5" className="tags-modal-loading-cell">
                    Loading tags…
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No tags found
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <TagColorSwatch color={tag.color_code} />
                    </td>
                    <td>
                      <span className="blockers-label-text">{tag.label}</span>
                    </td>
                    <td>
                      <span className="blockers-availability-cell">
                        <span className={`blockers-availability-dot ${availabilityDotClass(tag.availabilityLevel)}`} />
                        <span className={`blockers-availability-text ${availabilityDotClass(tag.availabilityLevel)}`}>
                          {tag.availabilityLevel}
                        </span>
                      </span>
                    </td>
                    <td>
                      {tag.boardsRaw && tag.boardsRaw.length > 0 ? (
                        <span className="blockers-boards-cell">
                          {tag.boardsRaw.map((b) => (
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
                          actionMenuRefs.current[String(tag.id)] = el;
                        }}
                        style={{ position: 'relative' }}
                      >
                        <button
                          type="button"
                          className="blockers-kebab-btn"
                          aria-label="Action"
                          onClick={(e) => handleActionMenuToggle(tag.id, e)}
                        >
                          <FiMoreVertical size={18} />
                        </button>
                        {openActionMenuId === String(tag.id) && (
                          <div className="blockers-action-menu">
                            {isKanbanManagementRowDisabled(tag.status) ? (
                              <button
                                type="button"
                                className="blockers-action-menu-item"
                                onClick={() => handleEnable(tag.id)}
                              >
                                Enable
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="blockers-action-menu-item"
                                  onClick={() => handleEdit(tag)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="blockers-action-menu-item"
                                  onClick={() => handleDisable(tag.id)}
                                >
                                  Disable
                                </button>
                                <button
                                  type="button"
                                  className="blockers-action-menu-item blockers-action-menu-item-danger"
                                  onClick={() => handleDelete(tag.id)}
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
            {tagsPagination?.total != null
              ? `${tagsPagination.total} tag${Number(tagsPagination.total) === 1 ? '' : 's'}`
              : `${tags.length} tag${tags.length === 1 ? '' : 's'}`}
          </span>
          <div className="tags-modal-pagination-controls">
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || tagsLoading}
            >
              Previous
            </button>
            <span className="tags-modal-pagination-page">Page {currentPage}</span>
            <button
              type="button"
              className="tags-modal-pagination-btn"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={!hasNextPage || tagsLoading}
            >
              Next
            </button>
          </div>
        </div>
      </Modal.Body>
      <NewTagModal
        show={showNewTagModal}
        onClose={closeTagFormModal}
        editingTag={editingTag}
        workspaceBoardOptions={workspaceBoardOptions}
        workspaceBoardsLoading={workspaceBoardsLoading}
        onSave={handleTagFormSave}
      />
    </Modal>
  );
};

export default TagsModal;
