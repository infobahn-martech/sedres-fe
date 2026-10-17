import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FileText, Check, Search, X } from "lucide-react";

export const TEMPLATE_PICKER_WIDTH = 320;
const SEARCH_THRESHOLD = 5;

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
    () => items.map((row) => ({
        ...row,
        title: row.name?.trim() || "Untitled template",
        tone: resolveTone(row.name),
      })),
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
      className="picker-popover"
      style={{ ...floaterStyle, width: TEMPLATE_PICKER_WIDTH }}
      role="listbox"
      aria-label="Select template"
    >
      <div className="picker-popover__header">
        <div className="picker-popover__header-text">
          <span className="picker-popover__title">Templates</span>
        </div>
      </div>

      {showSearch && (
        <div className="picker-popover__search">
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
        <ul className="picker-popover__list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="picker-popover__skeleton">
              <span className="picker-popover__skeleton-tile" />
              <span className="picker-popover__skeleton-lines">
                <span />
                <span />
              </span>
            </li>
          ))}
        </ul>
      ) : visibleRows.length === 0 ? (
        <div className="picker-popover__empty">
          <FileText size={22} aria-hidden />
          <span>{rows.length === 0 ? "No templates available yet." : "No templates match your search."}</span>
        </div>
      ) : (
        <ul className="picker-popover__list">
          {visibleRows.map((row) => {
            const isSelected = selectedId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={`picker-popover__row${isSelected ? " picker-popover__row--selected" : ""}`}
                  onClick={() => onSelect(row)}
                  role="option"
                  aria-selected={isSelected}
                  title={row.name}
                >
                  <span className={`picker-popover__tile picker-popover__tile--${row.tone}`} aria-hidden>
                    <FileText size={16} />
                  </span>
                  <span className="picker-popover__body">
                    <span className="picker-popover__name">{row.title}</span>
                  </span>
                  <span className="picker-popover__check" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedId && (
        <div className="picker-popover__footer">
          <button type="button" className="picker-popover__clear" onClick={onRemove}>
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
