import { useEffect, useState } from 'react';
import { FiX, FiSearch, FiArrowLeft, FiMoreVertical } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import BusinessRuleIcon from './BusinessRuleIcon';
import BusinessRuleFormModal from './BusinessRuleFormModal';
import { TRIGGER_CODE_TO_ICON } from './businessRulesData';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import DeleteConfirmationModal from '../../../components/DeleteConfirmationModal';
import { resolveKanbanBoardPath } from '../../../shared/helpers/kanbanBoardLink';
import '../../../design/scss/business-rules-modal.scss';

const OWNER_NAME_LIMIT = 6;

const OwnerCell = ({ owner }) => {
  if (!owner) return <span className="br-table-deleted-user">Deleted user</span>;
  const name = typeof owner === 'object' ? (owner?.name ?? owner?.username ?? '') : owner;
  const avatar = typeof owner === 'object' ? owner?.avatar : null;
  if (!name) return <span className="br-table-deleted-user">Deleted user</span>;
  const displayName = name.length > OWNER_NAME_LIMIT ? `${name.slice(0, OWNER_NAME_LIMIT)}...` : name;
  return (
    <div className="br-table-owner">
      {avatar ? (
        <img src={avatar} className="br-table-avatar" alt={name} />
      ) : (
        <div className="br-table-avatar-placeholder">{name.charAt(0).toUpperCase()}</div>
      )}
      <span title={name}>{displayName}</span>
    </div>
  );
};

const BusinessRulesModal = ({ show, onClose, boardName }) => {
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'enabled' | 'disabled'
  const [triggerSearch, setTriggerSearch] = useState('');
  const [debouncedTriggerSearch, setDebouncedTriggerSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // view: 'table' | 'picker'
  const [view, setView] = useState('table');
  const [selectedRule, setSelectedRule] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState(null);
  const [deleteRuleName, setDeleteRuleName] = useState('');
  // Tracks the row last opened via Edit so it stays highlighted in the table after
  // the edit form modal closes — separate from selectedRuleId, which drives the
  // create-vs-update API call and gets cleared as soon as the form closes.
  const [highlightedRuleId, setHighlightedRuleId] = useState(null);
  // Copy reuses the edit form (same selectedRuleId/showFormModal flow, pointed at the
  // newly duplicated rule's id) — this only flags the header/title to read "Copy
  // Business Rule" instead of "Edit Business Rule".
  const [isCopyMode, setIsCopyMode] = useState(false);

  const {
    getBusinessRules, businessRules, businessRulesCount, isLoadingBusinessRules,
    triggerTypes, isLoadingGet, getTriggerTypes,
    getBusinessRuleStats,
    createBusinessRule, isCreatingBusinessRule,
    updateBusinessRule, isUpdatingBusinessRule,
    deleteBusinessRule, isDeletingBusinessRule,
    toggleBusinessRuleStatus, isTogglingBusinessRuleStatus,
    duplicateBusinessRule, isDuplicatingBusinessRule,
  } = useBusinessRuleReducer((s) => s);

  const handleToggleStatus = (ruleId) => {
    // Enabled/Disabled/All is a server-side filter (is_enabled param) - a row that just
    // changed state must be re-fetched under the current filter so it drops out of the
    // Enabled view once disabled (and shows under Disabled), not just have its switch
    // flip in place while staying listed under the wrong tab.
    toggleBusinessRuleStatus(ruleId, { cb: () => { fetchBusinessRules(); getBusinessRuleStats(); } });
  };

  useEffect(() => {
    if (!show) {
      setSearchValue('');
      setStatusFilter('all');
      setTriggerSearch('');
      setDebouncedTriggerSearch('');
      setPage(1);
      setView('table');
      setSelectedRule(null);
      setShowFormModal(false);
      setSelectedRuleId(null);
      setShowDeleteModal(false);
      setDeleteRuleId(null);
      setHighlightedRuleId(null);
      setIsCopyMode(false);
      return;
    }
    const isEnabled = statusFilter === 'enabled' ? 1 : statusFilter === 'disabled' ? 0 : undefined;
    getBusinessRules({ params: { page, per_page: limit, search: searchValue || undefined, is_enabled: isEnabled } });
  }, [show, page, searchValue, statusFilter]);

  useEffect(() => {
    if (!show) return;
    getBusinessRuleStats();
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedTriggerSearch(triggerSearch.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [triggerSearch]);

  useEffect(() => {
    if (view !== 'picker') return;
    getTriggerTypes({ params: { search: debouncedTriggerSearch || undefined } });
  }, [view, debouncedTriggerSearch]);

  const totalPages = Math.max(1, Math.ceil(businessRulesCount / limit));

  const mappedTriggers = triggerTypes.map((item) => ({
    id: item.trigger_type_id,
    name: item.trigger_name,
    icon: TRIGGER_CODE_TO_ICON[item.trigger_code] ?? item.trigger_code,
    description: item.description,
  }));

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTriggerCardClick = (trigger) => {
    setSelectedRule(trigger);
    setShowFormModal(true);
  };

  const handleSaveFormModal = (payload) => {
    const onSaved = () => {
      setShowFormModal(false);
      setSelectedRule(null);
      setSelectedRuleId(null);
      setIsCopyMode(false);
      setView('table');
      const isEnabled = statusFilter === 'enabled' ? 1 : statusFilter === 'disabled' ? 0 : undefined;
      getBusinessRules({ params: { page, per_page: limit, search: searchValue || undefined, is_enabled: isEnabled } });
      getBusinessRuleStats();
    };
    if (selectedRuleId) {
      updateBusinessRule(selectedRuleId, payload, { cb: onSaved });
    } else {
      createBusinessRule(payload, { cb: onSaved });
    }
  };

  const fetchBusinessRules = () => {
    const isEnabled = statusFilter === 'enabled' ? 1 : statusFilter === 'disabled' ? 0 : undefined;
    getBusinessRules({ params: { page, per_page: limit, search: searchValue || undefined, is_enabled: isEnabled } });
  };

  const handleDelete = (ruleId, ruleName) => {
    setDeleteRuleId(ruleId);
    setDeleteRuleName(ruleName ?? '');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    deleteBusinessRule(deleteRuleId, {
      cb: () => { fetchBusinessRules(); getBusinessRuleStats(); },
      onSettled: () => { setShowDeleteModal(false); setDeleteRuleId(null); setDeleteRuleName(''); },
    });
  };

  const handleCancelFormModal = () => {
    const wasEditing = Boolean(selectedRuleId);
    setShowFormModal(false);
    setSelectedRule(null);
    setSelectedRuleId(null);
    setIsCopyMode(false);
    setView(wasEditing ? 'table' : 'picker');
  };

  const handleCopy = (ruleId) => {
    duplicateBusinessRule(ruleId, {
      cb: (data) => {
        const newRuleId = data?.business_rule_id;
        if (!newRuleId) return;
        setSelectedRule(null);
        setSelectedRuleId(newRuleId);
        setHighlightedRuleId(newRuleId);
        setIsCopyMode(true);
        setShowFormModal(true);
      },
    });
  };

  const handleBoardNameClick = (board) => {
    const label = typeof board === 'object' ? board?.name : board;
    const boardId = typeof board === 'object' ? (board?.board_id ?? board?.id ?? board?.boardId) : null;
    const path = resolveKanbanBoardPath(label, boardId);
    if (!path) return;
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  const handleAddNewRule = () => {
    setTriggerSearch('');
    setView('picker');
  };

  const handleBackToTable = () => {
    setView('table');
    setTriggerSearch('');
  };

  return (
    <>
      <Modal
        show={show && !showFormModal}
        onHide={onClose}
        className="business-rules-modal"
        backdropClassName="business-rules-modal-backdrop"
        centered
        size="xl"
      >
        <Modal.Header bsPrefix="business-rules-modal-header">
          <div className="br-modal-header-left">
            {view === 'picker' && (
              <button
                type="button"
                className="br-modal-back-btn"
                onClick={handleBackToTable}
                aria-label="Back"
              >
                <FiArrowLeft size={18} />
              </button>
            )}
            <Modal.Title className="business-rules-modal-title">
              {view === 'picker' ? 'Select Rule Type' : 'Business Rules'}
            </Modal.Title>
          </div>
          <button
            type="button"
            className="business-rules-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </Modal.Header>

        <Modal.Body className="business-rules-modal-body">
          {view === 'table' ? (
            <div className="br-body-inner">
              <div className="br-table-toolbar">
                <div className="br-table-toolbar-left">
                  <select
                    className="form-select form-select-sm br-table-status-select"
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div className="br-table-toolbar-right">
                  <div className="business-rules-search-wrapper br-table-search-wrap">
                    <FiSearch className="business-rules-search-icon" />
                    <input
                      type="text"
                      className="business-rules-search-input"
                      placeholder="Filter by business rule name, ID, owner, board name"
                      value={searchValue}
                      onChange={(e) => { setSearchValue(e.target.value.trimStart()); setPage(1); }}
                    />
                  </div>

                  <button
                    type="button"
                    className="br-add-new-rule-btn"
                    onClick={handleAddNewRule}
                  >
                    Add new rule
                  </button>
                </div>
              </div>

              <div className="br-table-section">
              <div className="br-table-scroll">
                <table className="br-table">
                  <thead>
                    <tr>
                      <th style={{ width: 78 }} />
                      <th style={{ width: 67 }}>ID</th>
                      <th style={{ width: 290 }}>Name</th>
                      <th style={{ width: 157 }}>Owner</th>
                      <th style={{ width: 200 }}>Board name</th>
                      <th style={{ width: 168 }}>Execution order</th>
                      <th style={{ width: 100 }}>Tags</th>
                      <th style={{ width: 179 }}>Shared with</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingBusinessRules ? (
                      <tr><td colSpan={10} className="br-table-state">Loading...</td></tr>
                    ) : businessRules.length === 0 ? (
                      <tr><td colSpan={10} className="br-table-state">No business rules found</td></tr>
                    ) : (
                      businessRules.map((rule) => {
                        const ruleId = rule?.business_rule_id ?? rule?.id;
                        const name = rule?.name ?? rule?.rule_name ?? '-';
                        const execOrder = rule?.execution_order ?? '-';
                        const tags = rule?.tags || '-';
                        const sharedWith = Array.isArray(rule?.shared_with) && rule.shared_with.length > 0
                          ? rule.shared_with.map((s) => (typeof s === 'object' ? s?.name : s)).join(', ')
                          : '-';
                        const boards = rule?.board_name ?? [];
                        // `status` from get_business_rule_list is overloaded: "1"/"0" (as a string) is the
                        // enable/disable flag, but flips to a descriptive string like "Missing reference"
                        // when the rule has a broken reference - only flag red when it explicitly signals
                        // "missing"; any other value (numeric flag included) must default to "OK"/black.
                        // There is no separate is_enabled field on this endpoint (only on the
                        // enable_disable_business_rule toggle response, which patches is_enabled here too).
                        const isMissingReference = typeof rule?.status === 'string' && /missing/i.test(rule.status);
                        const statusText = isMissingReference ? rule.status : 'OK';
                        const enabledFlag = rule?.is_enabled ?? rule?.status;
                        const isEnabled = !isMissingReference
                          && (enabledFlag === 1 || enabledFlag === '1' || enabledFlag === true);

                        return (
                          <tr
                            key={ruleId}
                            className={ruleId === highlightedRuleId ? 'br-table-row-selected' : undefined}
                          >
                            <td>
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={isEnabled}
                                  disabled={Boolean(isTogglingBusinessRuleStatus[ruleId])}
                                  onChange={() => handleToggleStatus(ruleId)}
                                />
                              </div>
                            </td>
                            <td className="br-table-id">{ruleId}</td>
                            <td>
                              <button
                                type="button"
                                className={`br-table-rule-name-btn${isMissingReference ? ' text-danger' : ''}`}
                                title={name}
                                onClick={() => { setSelectedRule(null); setSelectedRuleId(ruleId); setHighlightedRuleId(ruleId); setIsCopyMode(false); setShowFormModal(true); }}
                              >
                                {name}
                              </button>
                            </td>
                            <td><OwnerCell owner={rule?.owner} /></td>
                            <td>
                              {Array.isArray(boards) && boards.length > 0
                                ? boards.map((b, i) => {
                                  const label = typeof b === 'object' ? b?.name : b;
                                  const boardId = typeof b === 'object'
                                    ? (b?.board_id ?? b?.id ?? b?.boardId) : null;
                                  const clickable = resolveKanbanBoardPath(label, boardId) != null;
                                  return (
                                    <span key={i}>
                                      {clickable ? (
                                        <button
                                          type="button"
                                          className="br-table-board-link-btn"
                                          onClick={() => handleBoardNameClick(b)}
                                        >
                                          {label}
                                        </button>
                                      ) : (
                                        <span className="br-table-board-link">{label}</span>
                                      )}
                                      {i < boards.length - 1 && ', '}
                                    </span>
                                  );
                                })
                                : <span>-</span>
                              }
                            </td>
                            <td>{execOrder}</td>
                            <td title={tags}>{tags}</td>
                            <td title={sharedWith}>{sharedWith}</td>
                            <td>
                              <span className={isMissingReference ? 'text-danger' : ''}>
                                {statusText}
                              </span>
                            </td>
                            <td>
                              <div className="dropdown">
                                <button
                                  className="br-table-action-btn"
                                  type="button"
                                  data-bs-toggle="dropdown"
                                  aria-expanded="false"
                                  aria-label="Action"
                                >
                                  <FiMoreVertical size={18} />
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end br-table-action-menu">
                                  <li>
                                    <button
                                      className="dropdown-item"
                                      type="button"
                                      onClick={() => { setSelectedRule(null); setSelectedRuleId(ruleId); setHighlightedRuleId(ruleId); setIsCopyMode(false); setShowFormModal(true); }}
                                    >
                                      Edit
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="dropdown-item"
                                      type="button"
                                      disabled={Boolean(isDuplicatingBusinessRule[ruleId])}
                                      onClick={() => handleCopy(ruleId)}
                                    >
                                      {isDuplicatingBusinessRule[ruleId] ? 'Copying...' : 'Copy'}
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="dropdown-item text-danger"
                                      type="button"
                                      onClick={() => handleDelete(ruleId, name)}
                                    >
                                      Delete
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              </div>

              <div className="br-table-pagination">
                <span className="br-table-pagination-total">
                  Available business rules {businessRulesCount}
                </span>
                <div className="br-table-pagination-controls">
                  <button
                    type="button"
                    className="br-table-pagination-btn"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </button>
                  <span className="br-table-pagination-page">Page {page}</span>
                  <button
                    type="button"
                    className="br-table-pagination-btn"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
            <div className="br-picker-container">
              <div className="br-picker-header">
                <input
                  type="text"
                  className="br-picker-search-input"
                  placeholder="Filter by business rule name."
                  value={triggerSearch}
                  onChange={(e) => setTriggerSearch(e.target.value)}
                />
              </div>

              <div className="br-picker-grid-wrapper">
                {isLoadingGet ? (
                  <div className="business-rules-empty-state">Loading...</div>
                ) : mappedTriggers.length > 0 ? (
                  <div className="br-picker-grid">
                    {mappedTriggers.map((trigger) => (
                      <button
                        key={trigger.id}
                        type="button"
                        className="br-picker-card"
                        onClick={() => handleTriggerCardClick(trigger)}
                      >
                        <span className="br-picker-card-title">{trigger.name}</span>
                        <div className="br-picker-card-icon">
                          <BusinessRuleIcon iconType={trigger.icon} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="business-rules-empty-state">No rule types found</div>
                )}
              </div>
            </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <BusinessRuleFormModal
        show={show && showFormModal}
        rule={selectedRule}
        businessRuleId={selectedRuleId}
        boardName={boardName}
        isCopyMode={isCopyMode}
        onClose={handleCancelFormModal}
        onSave={handleSaveFormModal}
        isSaving={isCreatingBusinessRule || isUpdatingBusinessRule}
      />

      {showDeleteModal && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          isLoading={isDeletingBusinessRule}
          deleteText={`Delete business rule "${deleteRuleName}"? This cannot be undone.`}
          onCancel={() => { setShowDeleteModal(false); setDeleteRuleId(null); setDeleteRuleName(''); }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
};

BusinessRulesModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  boardName: PropTypes.string,
};

export default BusinessRulesModal;
