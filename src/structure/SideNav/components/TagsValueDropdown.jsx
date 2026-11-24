import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiChevronDown, FiFilter, FiX } from 'react-icons/fi';
import useKanbanManagementReducer, { isKanbanManagementRowDisabled } from '../../../store/KanbanManagementReducer';
import OptionColorBadge from './OptionColorBadge';
import { splitMultiValue } from './businessRuleFieldUtils';

const NOT_SET_PLACEHOLDER = 'Not Set';
const TAG_ID_SEPARATOR = ', ';

// Tags value of a THEN field ("Set tags"): the picked tags as pills in an input box; it opens the
// board-management tag list with a filter. The value is the picked tag ids joined by commas, the
// same shape the Set tags update action sends.
function TagsValueDropdown({ value, onChange }) {
  const { tags, tagsLoading, fetchKanbanTags } = useKanbanManagementReducer((s) => s);
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const selectedIds = splitMultiValue(value);

  useEffect(() => {
    if (tags.length === 0 && !tagsLoading) fetchKanbanTags({ per_page: 200 });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const toggleOpen = () => {
    setFilterText('');
    setOpen((prev) => !prev);
  };

  const toggleTag = (tagId) => {
    const id = String(tagId);
    onChange((selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]).join(TAG_ID_SEPARATOR));
  };

  const query = filterText.trim().toLowerCase();
  const enabledTags = tags.filter((t) => !isKanbanManagementRowDisabled(t.status));
  const visibleTags = query ? enabledTags.filter((t) => t.label.toLowerCase().includes(query)) : enabledTags;

  return (
    <div className="board-minimap-picker-wrap br-update-user-wrap">
      <div
        role="button"
        tabIndex={0}
        ref={triggerRef}
        className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-nonworking-trigger"
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedIds.length === 0 ? (
          <span className="br-nonworking-placeholder">{NOT_SET_PLACEHOLDER}</span>
        ) : (
          selectedIds.map((tagId) => {
            const tag = tags.find((t) => String(t.id) === tagId);
            if (!tag) return null;
            return (
              <span key={tagId} className="business-rule-form-tag-pill">
                {tag.color_code && <OptionColorBadge colorCode={tag.color_code} />}
                {tag.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTag(tagId);
                  }}
                  aria-label={`Remove ${tag.label}`}
                >
                  <FiX size={12} />
                </button>
              </span>
            );
          })
        )}
        <FiChevronDown className="br-nonworking-trigger-chevron" size={14} aria-hidden />
      </div>

      {open && (
        <div className="br-owner-picker-panel" ref={panelRef}>
          <div className="br-owner-picker-search">
            <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
            <input
              type="text"
              placeholder="Filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="br-owner-picker-list">
            {tagsLoading ? (
              <div className="br-property-picker-empty">Loading...</div>
            ) : visibleTags.length === 0 ? (
              <div className="br-property-picker-empty">No matches</div>
            ) : (
              visibleTags.map((tag) => (
                <div key={tag.id} className="br-owner-picker-row">
                  <button
                    type="button"
                    className={`br-owner-picker-row-btn${selectedIds.includes(String(tag.id)) ? ' br-owner-picker-row-btn--selected' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <OptionColorBadge colorCode={tag.color_code} />
                    <span className="br-owner-picker-row-name">{tag.label}</span>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="br-tags-picker-footer">
            <button type="button" className="br-tags-picker-save" onClick={() => setOpen(false)}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

TagsValueDropdown.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

export default TagsValueDropdown;
