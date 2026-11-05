import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import '../../design/scss/structure/side-nav/AddDashboardModal.scss';
import '../../design/scss/EditWorkflows.scss';
import billingEntityService from '../../services/billingEntityService';
import PremiumSelect from '../../components/form/PremiumSelect';

const SWIMLANE_NAME_MAX_LEN = 200;

function extractList(res) {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function getEntityLabel(entity) {
  return String(entity?.billing_entity ?? entity?.customer_code ?? entity?.entity_id ?? '');
}

function getSubEntityId(subEntity) {
  return subEntity?.sub_entity_id ?? subEntity?.id ?? '';
}

function getSubEntityLabel(subEntity) {
  return String(
    subEntity?.sub_entity_name ?? subEntity?.sub_entity ?? subEntity?.name ?? getSubEntityId(subEntity)
  );
}

const CreateSwimlaneModal = ({ show, onClose, onSave, isSaving = false }) => {
  const [swimlaneName, setSwimlaneName] = useState('');
  const [nameError, setNameError] = useState('');
  const [entityId, setEntityId] = useState('');
  const [entities, setEntities] = useState([]);
  const [isEntitiesLoading, setIsEntitiesLoading] = useState(false);
  const [subEntityId, setSubEntityId] = useState('');
  const [subEntities, setSubEntities] = useState([]);
  const [isSubEntitiesLoading, setIsSubEntitiesLoading] = useState(false);

  const resetForm = () => {
    setSwimlaneName('');
    setNameError('');
    setEntityId('');
    setSubEntityId('');
    setSubEntities([]);
  };

  useEffect(() => {
    if (!show) resetForm();
  }, [show]);

  useEffect(() => {
    if (!show) return;

    let isMounted = true;
    setIsEntitiesLoading(true);

    billingEntityService
      .getAllEntity()
      .then((res) => {
        if (isMounted) setEntities(extractList(res));
      })
      .catch(() => {
        if (isMounted) setEntities([]);
      })
      .finally(() => {
        if (isMounted) setIsEntitiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [show]);

  useEffect(() => {
    setSubEntityId('');
    setSubEntities([]);
    if (!show || !entityId) return;

    let isMounted = true;
    setIsSubEntitiesLoading(true);

    billingEntityService
      .getSubEntities(entityId)
      .then((res) => {
        if (isMounted) setSubEntities(extractList(res));
      })
      .catch(() => {
        if (isMounted) setSubEntities([]);
      })
      .finally(() => {
        if (isMounted) setIsSubEntitiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [show, entityId]);

  const handleEntityChange = (e) => {
    const v = e.target?.value;
    const nextId = v === undefined || v === null ? '' : String(v);
    setEntityId(nextId);
    // Swimlanes are usually named after the entity — prefill when the name is still empty
    if (nextId && !swimlaneName.trim()) {
      const match = entities.find((ent) => String(ent?.entity_id) === nextId);
      if (match) {
        setSwimlaneName(getEntityLabel(match));
        setNameError('');
      }
    }
  };

  const isBusy = isSaving || isEntitiesLoading || isSubEntitiesLoading;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = swimlaneName.trim();
    if (!trimmed) {
      setNameError('Name is required.');
      return;
    }
    setNameError('');
    if (isBusy) return;
    onSave?.({
      swimlane_name: trimmed,
      entity_id: entityId ? Number(entityId) : null,
      sub_entity_id: subEntityId ? Number(subEntityId) : null,
    });
  };

  const handleClose = () => {
    if (isSaving) return;
    resetForm();
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      className="add-dashboard-modal create-workflow-modal"
      centered
      backdrop="static"
      backdropClassName="add-dashboard-modal-backdrop"
      dialogClassName="add-dashboard-modal-dialog"
      contentClassName="add-dashboard-modal-content"
    >
      <form onSubmit={handleSubmit} className="add-dashboard-form">
        <div className="add-dashboard-modal-header">
          <h2 className="add-dashboard-modal-title" id="create-swimlane-modal-title">
            New swimlane
          </h2>
          <button
            type="button"
            className="add-dashboard-modal-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            <FiX size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="add-dashboard-modal-body">
          <div className="add-dashboard-field">
            <label htmlFor="swimlaneEntity" className="add-dashboard-label">
              Billing Entity
            </label>
            <PremiumSelect
              value={String(entityId)}
              onChange={handleEntityChange}
              options={entities.map((entity) => ({
                value: String(entity?.entity_id ?? ''),
                label: getEntityLabel(entity),
              }))}
              placeholder={isEntitiesLoading ? 'Loading billing entities...' : 'Select billing entity'}
              searchPlaceholder="Search billing entity..."
              disabled={isSaving || isEntitiesLoading}
              className="add-dashboard-premium-select"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuClassName="user-modal-premium-select-menu"
            />
            {!isEntitiesLoading && entities.length === 0 ? (
              <div className="add-dashboard-field-hint">No billing entities found.</div>
            ) : null}
          </div>

          <div className="add-dashboard-field">
            <label htmlFor="swimlaneSubEntity" className="add-dashboard-label">
              Sub Entity
            </label>
            <PremiumSelect
              value={String(subEntityId)}
              onChange={(e) => {
                const v = e.target?.value;
                setSubEntityId(v === undefined || v === null ? '' : String(v));
              }}
              options={subEntities.map((subEntity) => ({
                value: String(getSubEntityId(subEntity)),
                label: getSubEntityLabel(subEntity),
              }))}
              placeholder={
                !entityId
                  ? 'Select a billing entity first'
                  : isSubEntitiesLoading
                    ? 'Loading sub entities...'
                    : 'Select sub entity'
              }
              searchPlaceholder="Search sub entity..."
              disabled={isSaving || !entityId || isSubEntitiesLoading}
              className="add-dashboard-premium-select"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuClassName="user-modal-premium-select-menu"
            />
            {entityId && !isSubEntitiesLoading && subEntities.length === 0 ? (
              <div className="add-dashboard-field-hint">No sub entities found.</div>
            ) : null}
          </div>

          <div className="add-dashboard-field">
            <label htmlFor="swimlaneName" className="add-dashboard-label">
              Name
            </label>
            <input
              type="text"
              id="swimlaneName"
              className={`add-dashboard-input${nameError ? ' add-dashboard-input--invalid' : ''}`}
              placeholder="Enter swimlane name"
              value={swimlaneName}
              onChange={(e) => {
                setSwimlaneName(e.target.value);
                if (nameError) setNameError('');
              }}
              disabled={isSaving}
              maxLength={SWIMLANE_NAME_MAX_LEN}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'swimlaneName-error' : undefined}
            />
            {nameError ? (
              <div id="swimlaneName-error" className="add-dashboard-field-error" role="alert">
                {nameError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="add-dashboard-modal-footer">
          <button
            type="button"
            onClick={handleClose}
            className="add-dashboard-btn add-dashboard-btn--text"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="add-dashboard-btn add-dashboard-btn--text" disabled={isBusy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateSwimlaneModal;
