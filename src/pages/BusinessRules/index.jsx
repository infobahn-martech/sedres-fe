import { useState, useEffect } from 'react';
import useBusinessRuleReducer from '../../store/BusinessRuleReducer';
import BusinessRulesModal from '../../structure/SideNav/components/BusinessRulesModal';
import BusinessRuleFormModal from '../../structure/SideNav/components/BusinessRuleFormModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { resolveKanbanBoardPath } from '../../shared/helpers/kanbanBoardLink';
import './business-rules-page.scss';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
];

const OWNER_NAME_LIMIT = 18;

const OwnerCell = ({ owner }) => {
  if (!owner) return <span className="br-deleted-user">Deleted user</span>;
  const name = typeof owner === 'object' ? (owner?.name ?? owner?.username ?? '') : owner;
  const avatar = typeof owner === 'object' ? owner?.avatar : null;
  if (!name) return <span className="br-deleted-user">Deleted user</span>;
  const displayName = name.length > OWNER_NAME_LIMIT ? `${name.slice(0, OWNER_NAME_LIMIT)}...` : name;
  return (
    <div className="br-owner">
      {avatar ? (
        <img src={avatar} className="br-avatar" alt={name} />
      ) : (
        <div className="br-avatar-placeholder">{name.charAt(0).toUpperCase()}</div>
      )}
      <span title={name}>{displayName}</span>
    </div>
  );
};

const BoardNameCell = ({ boards }) => {
  const items = boards ?? [];
  if (!Array.isArray(items) || items.length === 0) return <span>-</span>;
  return (
    <>
      {items.map((b, i) => {
        const label = typeof b === 'object' ? b?.name : b;
        const boardId = typeof b === 'object' ? (b?.board_id ?? b?.id ?? b?.boardId) : null;
        const path = resolveKanbanBoardPath(label, boardId);
        return (
          <span key={i}>
            {path ? (
              <button
                type="button"
                className="br-board-link-btn"
                onClick={() => window.open(path, '_blank', 'noopener,noreferrer')}
              >
                {label}
              </button>
            ) : (
              <span className="br-board-link">{label}</span>
            )}
            {i < items.length - 1 && ', '}
          </span>
        );
      })}
    </>
  );
};

const BusinessRules = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyRuleId, setCopyRuleId] = useState(null);

  const {
    getBusinessRules, businessRules, businessRulesCount, isLoadingBusinessRules, deleteBusinessRule, isDeletingBusinessRule,
    toggleBusinessRuleStatus, isTogglingBusinessRuleStatus,
    duplicateBusinessRule, isDuplicatingBusinessRule,
    updateBusinessRule, isUpdatingBusinessRule,
  } = useBusinessRuleReducer((s) => s);

  const fetchBusinessRules = () => {
    const is_enabled = filter === 'enabled' ? 1 : filter === 'disabled' ? 0 : undefined;
    getBusinessRules({ params: { page, per_page: limit, search: searchTerm || undefined, is_enabled } });
  };

  useEffect(() => {
    fetchBusinessRules();
  }, [page, limit, searchTerm, filter]);

  const handleToggleStatus = (ruleId) => {
    // Enabled/Disabled/All is a server-side filter (is_enabled param) - a row that just
    // changed state must be re-fetched under the current filter so it drops out of the
    // Enabled view once disabled (and shows under Disabled), not just have its switch
    // flip in place while staying listed under the wrong tab.
    toggleBusinessRuleStatus(ruleId, { cb: fetchBusinessRules });
  };

  const handleDelete = (ruleId) => {
    setDeleteRuleId(ruleId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    deleteBusinessRule(deleteRuleId, {
      cb: fetchBusinessRules,
      onSettled: () => { setShowDeleteModal(false); setDeleteRuleId(null); },
    });
  };

  const handleCopy = (ruleId) => {
    duplicateBusinessRule(ruleId, {
      cb: (data) => {
        const newRuleId = data?.business_rule_id;
        if (!newRuleId) return;
        setCopyRuleId(newRuleId);
        setShowCopyModal(true);
      },
    });
  };

  const handleSaveCopyModal = (payload) => {
    updateBusinessRule(copyRuleId, payload, {
      cb: () => {
        setShowCopyModal(false);
        setCopyRuleId(null);
        fetchBusinessRules();
      },
    });
  };

  const handleSaveEditModal = (payload) => {
    updateBusinessRule(selectedRuleId, payload, {
      cb: () => {
        setShowDetailsModal(false);
        setSelectedRuleId(null);
        fetchBusinessRules();
      },
    });
  };

  const totalPages = Math.max(1, Math.ceil(businessRulesCount / limit));

  return (
    <div className="page-body">
      <div className="br-page">
        <div className="br-toolbar">
          <div className="br-toolbar-left">
            <div className="dropdown">
              <button
                className="btn btn-primary dropdown-toggle br-filter-btn"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'All'}
              </button>
              <ul className="dropdown-menu">
                {FILTER_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={() => { setFilter(opt.value); setPage(1); }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <input
              type="text"
              className="form-control br-search-input"
              placeholder="Filter by business rule name, ID, owner, board name"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <button
            type="button"
            className="btn btn-link br-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            Add new rule
          </button>
        </div>

        <div className="br-table-wrapper">
          <table className="br-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>ID</th>
                <th>NAME</th>
                <th>OWNER</th>
                <th>BOARD NAME</th>
                <th>EXECUTION ORDER</th>
                <th>TAGS</th>
                <th>SHARED WITH</th>
                <th>STATUS</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {isLoadingBusinessRules ? (
                <tr>
                  <td colSpan={10} className="br-loading">Loading...</td>
                </tr>
              ) : businessRules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="br-empty">No business rules found</td>
                </tr>
              ) : (
                businessRules.map((rule) => {
                  const ruleId = rule?.business_rule_id ?? rule?.id;
                  const name = rule?.name ?? rule?.rule_name ?? '-';
                  const execOrder = rule?.execution_order ?? '-';
                  const tags = rule?.tags || '-';
                  const sharedWith = Array.isArray(rule?.shared_with) && rule.shared_with.length > 0
                    ? rule.shared_with.map((s) => (typeof s === 'object' ? s?.name : s)).join(', ')
                    : '-';
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
                    <tr key={ruleId}>
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
                      <td>{ruleId}</td>
                      <td><span className={`br-rule-name${isMissingReference ? ' text-danger' : ''}`}>{name}</span></td>
                      <td><OwnerCell owner={rule?.owner} /></td>
                      <td><BoardNameCell boards={rule?.board_name} /></td>
                      <td>{execOrder}</td>
                      <td>{tags}</td>
                      <td>{sharedWith}</td>
                      <td>
                        <span className={isMissingReference ? 'text-danger' : ''}>
                          {statusText}
                        </span>
                      </td>
                      <td>
                        <div className="dropdown">
                          <button
                            className="br-action-btn"
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
                                onClick={() => { setSelectedRuleId(ruleId); setShowDetailsModal(true); }}
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
                                onClick={() => handleDelete(ruleId)}
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

          <div className="br-pagination">
            <div className="br-pagination-controls">
              <select
                className="br-page-select"
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                className="br-page-btn"
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
              >
                &gt;
              </button>
            </div>
            <span>
              Available business rules {businessRulesCount}
            </span>
          </div>
        </div>
      </div>

      <BusinessRulesModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <BusinessRuleFormModal
        show={showDetailsModal}
        businessRuleId={selectedRuleId}
        onClose={() => { setShowDetailsModal(false); setSelectedRuleId(null); }}
        onSave={handleSaveEditModal}
        isSaving={isUpdatingBusinessRule}
      />

      <BusinessRuleFormModal
        show={showCopyModal}
        businessRuleId={copyRuleId}
        isCopyMode
        onClose={() => { setShowCopyModal(false); setCopyRuleId(null); }}
        onSave={handleSaveCopyModal}
        isSaving={isUpdatingBusinessRule}
      />

      {showDeleteModal && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          isLoading={isDeletingBusinessRule}
          deleteText="Are you sure you want to delete this business rule?"
          onCancel={() => { setShowDeleteModal(false); setDeleteRuleId(null); }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export default BusinessRules;
