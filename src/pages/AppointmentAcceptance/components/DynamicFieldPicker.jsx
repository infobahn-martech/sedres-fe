import PropTypes from "prop-types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronDown, FiPlus, FiSearch } from "react-icons/fi";
import { PREMIUM_SELECT_MODAL_Z_INDEX } from "../../../components/form/PremiumSelect";
import { filterPlaceholderGroups } from "../utils/reportPlaceholders";

const MENU_WIDTH = 320;
const MENU_MAX_HEIGHT = 360;
const VIEWPORT_GAP = 8;

// "Insert Field" button + searchable, grouped popover of dynamic fields. The popover is
// portalled to document.body with position:fixed so the modal's scroll container can't clip it.
// The parent decides where the chosen field goes (onSelect).
function DynamicFieldPicker({ groups, status, error, hasReportType, onOpen, onRetry, onSelect, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const visibleGroups = useMemo(() => filterPlaceholderGroups(groups, query), [groups, query]);
  const flatFields = useMemo(() => visibleGroups.flatMap((group) => group.fields), [visibleGroups]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const open = () => {
    setIsOpen(true);
    onOpen?.();
  };

  // Right-aligned under the button; flips above when there's no room below.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
    const left = Math.min(
      Math.max(VIEWPORT_GAP, rect.right - width),
      window.innerWidth - width - VIEWPORT_GAP
    );
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP;
    const spaceAbove = rect.top - VIEWPORT_GAP;
    const placeAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, (placeAbove ? spaceAbove : spaceBelow) - 4);
    setPosition({
      left,
      width,
      maxHeight,
      ...(placeAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onOutside = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      updatePosition();
    };
    document.addEventListener("mousedown", onOutside, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, close, updatePosition]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, groups]);

  // Keep the keyboard-highlighted option in view.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const choose = (field) => {
    close();
    onSelect(field);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (!flatFields.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatFields.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatFields.length) % flatFields.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const field = flatFields[activeIndex];
      if (field) choose(field);
    }
  };

  const renderState = () => {
    if (!hasReportType) {
      return <div className="rt-field-picker__state">Select a Report Type to see the available fields.</div>;
    }
    if (status === "loading" || status === "idle") {
      return (
        <div className="rt-field-picker__state" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden />
          <span>Loading fields…</span>
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="rt-field-picker__state rt-field-picker__state--error">
          <span>{error || "Failed to load fields."}</span>
          <button type="button" className="rt-field-picker__retry" onClick={onRetry}>
            Retry
          </button>
        </div>
      );
    }
    if (!groups.length) {
      return <div className="rt-field-picker__state">No fields are configured for this report type.</div>;
    }
    if (!visibleGroups.length) {
      return <div className="rt-field-picker__state">No fields match “{query.trim()}”.</div>;
    }
    return null;
  };

  let runningIndex = -1;
  const stateContent = renderState();

  const menu =
    isOpen && position
      ? createPortal(
          <div
            ref={menuRef}
            className="rt-field-picker__menu"
            style={{
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: PREMIUM_SELECT_MODAL_Z_INDEX,
            }}
            onKeyDown={onKeyDown}
          >
            <div className="rt-field-picker__search">
              <FiSearch size={14} aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fields..."
                aria-label="Search fields"
                disabled={!hasReportType || status !== "ready" || !groups.length}
              />
            </div>
            <div className="rt-field-picker__list" ref={listRef} role="listbox" aria-label="Dynamic fields">
              {stateContent ??
                visibleGroups.map((group) => (
                  <div key={group.key} className="rt-field-picker__group" role="group" aria-label={group.label}>
                    <div className="rt-field-picker__group-label">{group.label}</div>
                    {group.fields.map((field) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={`${group.key}:${field.key}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-index={index}
                          className={`rt-field-picker__option${isActive ? " is-active" : ""}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => choose(field)}
                        >
                          <span className="rt-field-picker__option-label">{field.label}</span>
                          <span className="rt-field-picker__option-token">{field.token}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`rt-field-picker__trigger${isOpen ? " is-open" : ""}`}
        // Keep the editor's caret/selection where it is while the picker opens.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <FiPlus size={13} aria-hidden />
        <span>Insert Field</span>
        <FiChevronDown size={13} aria-hidden className="rt-field-picker__chevron" />
      </button>
      {menu}
    </>
  );
}

DynamicFieldPicker.propTypes = {
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      fields: PropTypes.arrayOf(
        PropTypes.shape({
          key: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          token: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  status: PropTypes.oneOf(["idle", "loading", "ready", "error"]).isRequired,
  error: PropTypes.string,
  hasReportType: PropTypes.bool.isRequired,
  onOpen: PropTypes.func,
  onRetry: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
};

export default DynamicFieldPicker;
