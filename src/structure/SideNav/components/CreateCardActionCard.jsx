import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiX } from 'react-icons/fi';
import useFormTemplateReducer from '../../../store/FormTemplateReducer';
import InlineTextDropdown from './InlineTextDropdown';
import MoveTargetAction from './MoveTargetAction';
import CopyCardDetailsModal from './CopyCardDetailsModal';
import CardDetailsModal from './CardDetailsModal';
import '../../../design/scss/business-rule-generic-action.scss';

const EMPTY_LIST = [];

// One Create card / child / parent action (guide 5.7): title, where it is created (board
// minimap), the card fields to set and the fields copied from this card. The lists of card
// fields and copy fields come from get_then_action_fields; nothing is typed in the code.
function CreateCardActionCard({ action, catalog, triggerTypeId, defaultBoardId, templateSelectable = false, copyable = true, onChange, onRemove }) {
  const allTemplates = useFormTemplateReducer((s) => s.allTemplates);
  const getAllTemplates = useFormTemplateReducer((s) => s.getAllTemplates);
  const [showCopyDetails, setShowCopyDetails] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);

  useEffect(() => {
    if (templateSelectable && allTemplates === null) getAllTemplates();
  }, [templateSelectable, allTemplates]);

  /* "with custom properties" plus one option per form template (form_template/all_templates). */
  const templateOptions = useMemo(
    () => [
      { value: '', label: 'with custom properties' },
      ...(allTemplates ?? []).map((tpl) => ({
        value: String(tpl.template_id),
        label: tpl.template_desc || tpl.template_name,
        group: 'Templates',
      })),
    ],
    [allTemplates]
  );

  const cardFields = catalog?.cardFields ?? EMPTY_LIST;
  const copyFields = catalog?.copyFields ?? EMPTY_LIST;

  const withCustomProperties = templateSelectable && !action.templateId;
  const titleCopyKey = copyFields.find((f) => String(f.field_label).trim().toLowerCase() === 'title')?.field_key;
  const isTitleCopied = action.copyKeys.includes(titleCopyKey);

  // Set once every regular field, or any custom field, is copied from the originator.
  const allCopied = copyFields.length > 0 && copyFields.every((f) => action.copyKeys?.includes(f.field_key));
  const showCopyNote = allCopied || Boolean(action.copyCustomKeys?.length);

  const set = (patch) => onChange({ ...action, ...patch });

  // The action as it was before the modals opened: closing without "Save details" puts it back.
  const beforeEdit = useRef(action);
  const cancelEdit = () => {
    setShowCopyDetails(false);
    setShowCardDetails(false);
    onChange(beforeEdit.current);
  };

  return (
    <div className="br-link-card">
      <button type="button" className="business-rule-form-action-detail-close" onClick={onRemove} aria-label="Remove action">
        <FiX size={14} />
      </button>

      {templateSelectable ? (
        <h5 className="business-rule-form-action-detail-title">
          <InlineTextDropdown
            value={action.templateId ?? ''}
            options={templateOptions}
            triggerPrefix={`${action.label} `}
            triggerClassName="br-create-action-link br-create-action-link--btn"
            searchable
            onChange={(templateId) => set({ templateId })}
          />
        </h5>
      ) : (
        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
      )}

      {/* Custom-property cards always read "Configure details", which starts again at the board minimap. */}
      <MoveTargetAction
        embedded
        cellOnly
        emptyLabel="Configure details"
        linkLabel={withCustomProperties ? 'Configure details' : ''}
        position={action.position}
        defaultBoardId={defaultBoardId}
        onChange={(position) => {
          beforeEdit.current = action;
          set({ position });
          if (!withCustomProperties) return;
          if (copyable) setShowCopyDetails(true);
          else setShowCardDetails(true);
        }}
      />

      <CardDetailsModal
        show={showCardDetails}
        action={action}
        cardFields={cardFields}
        titleCopied={isTitleCopied}
        showCopyNote={showCopyNote}
        triggerTypeId={triggerTypeId}
        // A typed title replaces copying it from the originator, so both are never sent.
        onChange={(patch) => set(patch.title ? { ...patch, copyKeys: action.copyKeys.filter((k) => k !== titleCopyKey) } : patch)}
        onSave={() => setShowCardDetails(false)}
        onClose={cancelEdit}
      />

      {copyable && <CopyCardDetailsModal
        show={showCopyDetails}
        copyFields={copyFields}
        triggerTypeId={triggerTypeId}
        boardId={defaultBoardId}
        copyKeys={action.copyKeys}
        copyCustomKeys={action.copyCustomKeys}
        onClose={cancelEdit}
        onContinue={(copyKeys, copyCustomKeys) => {
          set({ copyKeys, copyCustomKeys });
          setShowCopyDetails(false);
          setShowCardDetails(true);
        }}
      />}
    </div>
  );
}

CreateCardActionCard.propTypes = {
  action: PropTypes.shape({
    label: PropTypes.string,
    title: PropTypes.string,
    position: PropTypes.object,
    fields: PropTypes.object,
    copyKeys: PropTypes.array,
    copyCustomKeys: PropTypes.array,
    templateId: PropTypes.string,
  }).isRequired,
  catalog: PropTypes.object,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  templateSelectable: PropTypes.bool,
  copyable: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default CreateCardActionCard;
