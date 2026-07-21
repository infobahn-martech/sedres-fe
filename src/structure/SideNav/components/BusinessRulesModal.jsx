import { useEffect, useState } from 'react';
import { FiX, FiSearch, FiArrowLeft } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import BusinessRuleIcon from './BusinessRuleIcon';
import BusinessRuleFormModal from './BusinessRuleFormModal';
import { TRIGGER_CODE_TO_ICON } from './businessRulesData';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import '../../../design/scss/business-rules-modal.scss';

const OwnerCell = ({ owner }) => {
  if (!owner) return <span className="br-table-deleted-user">Deleted user</span>;
  const name = typeof owner === 'object' ? (owner?.name ?? owner?.username ?? '') : owner;
  const avatar = typeof owner === 'object' ? owner?.avatar : null;
  if (!name) return <span className="br-table-deleted-user">Deleted user</span>;
  return (
    <div className="br-table-owner">
      {avatar ? (
        <img src={avatar} className="br-table-avatar" alt={name} />
      ) : (
        <div className="br-table-avatar-placeholder">{name.charAt(0).toUpperCase()}</div>
      )}
      <span>{name}</span>
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

  const {
    getBusinessRules, businessRules, businessRulesCount, isLoadingBusinessRules,
    triggerTypes, isLoadingGet, getTriggerTypes,
    getBusinessRuleStats, businessRuleStats,
    createBusinessRule, isCreatingBusinessRule,
    toggleBusinessRuleStatus,
  } = useBusinessRuleReducer((s) => s);

  // Optimistic override, keyed by rule id, reconciled once the toggle API call settles.
  const [localStatusOverrides, setLocalStatusOverrides] = useState({});
  const [togglingRuleId, setTogglingRuleId] = useState(null);

  const handleToggleStatus = (ruleId, currentValue) => {
    setTogglingRuleId(ruleId);
    toggleBusinessRuleStatus(ruleId, {
      cb: () => setLocalStatusOverrides((prev) => ({ ...prev, [ruleId]: !currentValue })),
      onSettled: () => setTogglingRuleId(null),
    });
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
    createBusinessRule(payload, {
      cb: () => {
        setShowFormModal(false);
        setSelectedRule(null);
        setSelectedRuleId(null);
        setView('table');
        const isEnabled = statusFilter === 'enabled' ? 1 : statusFilter === 'disabled' ? 0 : undefined;
        getBusinessRules({ params: { page, per_page: limit, search: searchValue || undefined, is_enabled: isEnabled } });
        getBusinessRuleStats();
      },
    });
  };

  const handleCancelFormModal = () => {
    const wasEditing = Boolean(selectedRuleId);
    setShowFormModal(false);
    setSelectedRule(null);
    setSelectedRuleId(null);
    setView(wasEditing ? 'table' : 'picker');
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
        <Modal.Header className="business-rules-modal-header">
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
            <>
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

                  <div className="business-rules-search-wrapper br-table-search-wrap">
                    <FiSearch className="business-rules-search-icon" />
                    <input
                      type="text"
                      className="business-rules-search-input"
                      placeholder="Filter by business rule name, ID, owner, t"
                      value={searchValue}
                      onChange={(e) => { setSearchValue(e.target.value.trimStart()); setPage(1); }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="br-add-new-rule-btn"
                  onClick={handleAddNewRule}
                >
                  Add new rule
                </button>
              </div>

              <div className="br-table-scroll">
                <table className="br-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }} />
                      <th>ID</th>
                      <th>NAME</th>
                      <th>OWNER</th>
                      <th>BOARD NAME</th>
                      <th>EXECUTION ORDER</th>
                      <th>TAGS</th>
                      <th>SHARED WITH</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingBusinessRules ? (
                      <tr><td colSpan={9} className="br-table-state">Loading...</td></tr>
                    ) : businessRules.length === 0 ? (
                      <tr><td colSpan={9} className="br-table-state">No business rules found</td></tr>
                    ) : (
                      businessRules.map((rule) => {
                        const ruleId = rule?.business_rule_id ?? rule?.id;
                        const name = rule?.name ?? rule?.rule_name ?? '-';
                        const execOrder = rule?.execution_order ?? '-';
                        const tags = rule?.tags || '-';
                        const isEnabled = localStatusOverrides[ruleId] ?? (String(rule?.status) === '1');
                        const sharedWith = Array.isArray(rule?.shared_with) && rule.shared_with.length > 0
                          ? rule.shared_with.map((s) => (typeof s === 'object' ? s?.name : s)).join(', ')
                          : '-';
                        const boards = rule?.board_name ?? [];

                        return (
                          <tr key={ruleId}>
                            <td>
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={isEnabled}
                                  disabled={togglingRuleId === ruleId}
                                  onChange={() => handleToggleStatus(ruleId, isEnabled)}
                                />
                              </div>
                            </td>
                            <td className="br-table-id">{ruleId}</td>
                            <td><span className="br-table-rule-name">{name}</span></td>
                            <td><OwnerCell owner={rule?.owner} /></td>
                            <td>
                              {Array.isArray(boards) && boards.length > 0
                                ? boards.map((b, i) => (
                                  <span key={i} className="br-table-board-link">
                                    {typeof b === 'object' ? b?.name : b}
                                    {i < boards.length - 1 && ', '}
                                  </span>
                                ))
                                : <span>-</span>
                              }
                            </td>
                            <td>{execOrder}</td>
                            <td>{tags}</td>
                            <td>{sharedWith}</td>
                            <td>
                              <div className="dropdown">
                                <button
                                  className="br-table-action-btn"
                                  type="button"
                                  data-bs-toggle="dropdown"
                                  aria-expanded="false"
                                >
                                  &#8942;
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                  <li>
                                    <button
                                      className="dropdown-item"
                                      type="button"
                                      onClick={() => { setSelectedRule(null); setSelectedRuleId(ruleId); setShowFormModal(true); }}
                                    >
                                      Edit
                                    </button>
                                  </li>
                                  <li><button className="dropdown-item text-danger" type="button">Delete</button></li>
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

              <div className="br-table-pagination">
                <div className="br-table-pagination-controls">
                  <select
                    className="br-table-page-select"
                    value={page}
                    onChange={(e) => setPage(Number(e.target.value))}
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    className="br-table-page-btn"
                    type="button"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages}
                  >
                    &gt;
                  </button>
                </div>
                <span className="br-table-count">
                  Available business rules {businessRuleStats.available} / Created business rules {businessRuleStats.created} / Enabled business rules {businessRuleStats.enabled} / Visible business rules {businessRuleStats.visible}
                </span>
              </div>
            </>
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
                <button
                  type="button"
                  className="br-picker-cancel-btn"
                  onClick={handleBackToTable}
                >
                  Cancel
                </button>
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

              <div className="br-picker-footer">
                Available business rules {businessRuleStats.available} / Created business rules {businessRuleStats.created} / Enabled business rules {businessRuleStats.enabled} / Visible business rules {businessRuleStats.visible}
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
        onClose={handleCancelFormModal}
        onSave={handleSaveFormModal}
        isSaving={isCreatingBusinessRule}
      />
    </>
  );
};

BusinessRulesModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  boardName: PropTypes.string,
};

export default BusinessRulesModal;
