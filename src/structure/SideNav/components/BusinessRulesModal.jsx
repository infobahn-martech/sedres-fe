import { useEffect, useState } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import BusinessRuleIcon from './BusinessRuleIcon';
import BusinessRuleFormModal from './BusinessRuleFormModal';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import '../../../design/scss/business-rules-modal.scss';

const TRIGGER_CODE_TO_ICON = {
  card_created: 'create',
  card_updated: 'update',
  card_moved: 'moved',
  child_card_blocked: 'child-blocked',
  child_card_moved: 'child-moved',
  all_children_moved: 'all-children-moved',
};

const BusinessRulesModal = ({ show, onClose, boardName }) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedRule, setSelectedRule] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const { triggerTypes, isLoadingGet, getTriggerTypes, timeUnits, getTimeUnits, regularFields, getRegularFields } = useBusinessRuleReducer();

  useEffect(() => {
    if (!show) {
      setShowFormModal(false);
      setSelectedRule(null);
      return;
    }
    getTriggerTypes();
    getTimeUnits();
    getRegularFields();
  }, [show]);

  const mappedRules = triggerTypes.map((item) => ({
    id: item.trigger_type_id,
    name: item.trigger_name,
    icon: TRIGGER_CODE_TO_ICON[item.trigger_code] ?? item.trigger_code,
    description: item.description,
  }));

  const filteredRules = mappedRules.filter((rule) =>
    rule.name.toLowerCase().includes(searchValue.toLowerCase().trim())
  );

  const handleCardClick = (rule) => {
    setSelectedRule(rule);
    setShowFormModal(true);
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setSelectedRule(null);
  };

  const handleSaveForm = () => {
    // Hook for API integration when backend is ready
  };

  return (
    <>
      <Modal
        show={show && !showFormModal}
        onHide={onClose}
        className="business-rules-modal"
        centered
        size="xl"
      >
        <Modal.Header className="business-rules-modal-header">
          <Modal.Title className="business-rules-modal-title">Business Rules</Modal.Title>
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
          <div className="business-rules-search-section">
            <div className="business-rules-search-wrapper">
              <FiSearch className="business-rules-search-icon" />
              <input
                type="text"
                className="business-rules-search-input"
                placeholder="Filter by business rule name"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </div>

          <div className="business-rules-grid-wrapper">
            {isLoadingGet ? (
              <div className="business-rules-empty-state">Loading...</div>
            ) : filteredRules.length > 0 ? (
              <div className="business-rules-grid">
                {filteredRules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className="business-rules-card"
                    onClick={() => handleCardClick(rule)}
                  >
                    <BusinessRuleIcon iconType={rule.icon} />
                    <span className="business-rules-card-title">{rule.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="business-rules-empty-state">No business rules found</div>
            )}
          </div>
        </Modal.Body>
      </Modal>

      <BusinessRuleFormModal
        show={show && showFormModal}
        rule={selectedRule}
        boardName={boardName}
        onClose={handleCloseFormModal}
        onSave={handleSaveForm}
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
