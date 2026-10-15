import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FileText, Check, Search, X, LayoutTemplate } from "lucide-react";

export const TEMPLATE_PICKER_WIDTH = 320;
const SEARCH_THRESHOLD = 5;

// Template names arrive as "Title - Call Type - Group"; split so the title
// leads and the remaining segments render as compact tags.
const parseTemplateName = (rawName = "") => {
  const [title, ...tags] = String(rawName)
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);
  return { title: title || "Untitled template", tags };
};

const resolveTone = (rawName = "") => {
  if (/export/i.test(rawName)) return "export";
  if (/import/i.test(rawName)) return "import";
  return "neutral";
};

const TemplatePickerPopover = ({
  floaterStyle,
  wrapRef,
  loading,
  items,
  selectedId,
  onSelect,
  onRemove,
}) => {
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => items.map((row) => ({ ...row, ...parseTemplateName(row.name), tone: resolveTone(row.name) })),
    [items]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const showSearch = !loading && rows.length > SEARCH_THRESHOLD;

  return (
    <div
      ref={wrapRef}
      className="template-picker"
      style={{ ...floaterStyle, width: TEMPLATE_PICKER_WIDTH }}
      role="listbox"
      aria-label="Select template"
    >
      <div className="template-picker__header">
        <div className="template-picker__header-text">
          <span className="template-picker__title">Templates</span>
        </div>
      </div>

      {showSearch && (
        <div className="template-picker__search">
          <Search size={14} aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            autoFocus
          />
        </div>
      )}

      {loading ? (
        <ul className="template-picker__list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="template-picker__skeleton">
              <span className="template-picker__skeleton-tile" />
              <span className="template-picker__skeleton-lines">
                <span />
                <span />
              </span>
            </li>
          ))}
        </ul>
      ) : visibleRows.length === 0 ? (
        <div className="template-picker__empty">
          <FileText size={22} aria-hidden />
          <span>{rows.length === 0 ? "No templates available yet." : "No templates match your search."}</span>
        </div>
      ) : (
        <ul className="template-picker__list">
          {visibleRows.map((row) => {
            const isSelected = selectedId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={`template-picker__row${isSelected ? " template-picker__row--selected" : ""}`}
                  onClick={() => onSelect(row)}
                  role="option"
                  aria-selected={isSelected}
                  title={row.name}
                >
                  <span className={`template-picker__tile template-picker__tile--${row.tone}`} aria-hidden>
                    <FileText size={16} />
                  </span>
                  <span className="template-picker__body">
                    <span className="template-picker__name">{row.title}</span>
                    
                  </span>
                  <span className="template-picker__check" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedId && (
        <div className="template-picker__footer">
          <button type="button" className="template-picker__clear" onClick={onRemove}>
            <X size={13} aria-hidden />
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
};

TemplatePickerPopover.propTypes = {
  floaterStyle: PropTypes.object.isRequired,
  wrapRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  loading: PropTypes.bool,
  items: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string })
  ).isRequired,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default TemplatePickerPopover;
