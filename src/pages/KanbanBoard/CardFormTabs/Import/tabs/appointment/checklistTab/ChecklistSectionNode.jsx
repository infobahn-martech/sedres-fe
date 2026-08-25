import PropTypes from "prop-types";
import { Fragment, useEffect, useRef } from "react";
import ChecklistItemRow from "./ChecklistItemRow";
import { countNodeItems } from "./checklistMappers";

const SECTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const formatSectionHeaderTitle = (title, depth, sectionIndex) => {
  const label = String(title || "Section").trim();
  // Subsections under a main section are numbered (restarts per parent via sectionIndex).
  if (depth > 0) return `${sectionIndex + 1}. ${label.toUpperCase()}`;
  const letter = SECTION_LETTERS[sectionIndex] ?? String(sectionIndex + 1);
  return `${letter}) ${label.toUpperCase()}`;
};

const ChecklistSectionNode = ({
  node,
  itemsData,
  onItemChange,
  openSections,
  onSectionToggle,
  onSelectAll,
  isViewOnly = false,
  isDAModule = false,
  depth = 0,
  sectionIndex = 0,
}) => {
  const isSub = depth > 0;
  const total = countNodeItems(node);

  const allSelected =
    total > 0
    && nodeItemsEveryUploaded(node, itemsData);
  const someSelected = nodeItemsSomeUploaded(node, itemsData) && !allSelected;
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const handleSelectAllClick = (e) => {
    e.stopPropagation();
    onSelectAll(node.id, !allSelected);
  };

  const sectionTitle = formatSectionHeaderTitle(node.title, depth, sectionIndex);

  return (
    <Fragment>
      <tr
        className={`cl-excel-section-header-row ${isSub ? "cl-excel-section-header-row--sub" : ""}`}
        data-cl-depth={depth}
      >
        <td colSpan={5} className="cl-excel-section-header-title-cell">
          <span className="cl-excel-section-title" title={sectionTitle}>{sectionTitle}</span>
          {/* {total > 0 ? (
            <span className="cl-excel-section-count">{done} / {total}</span>
          ) : null} */}
        </td>
        <td className="cl-excel-section-header-actions-cell">
          {!isViewOnly ? (
            <button
              type="button"
              className="checklist-select-all-btn cl-excel-select-all-btn"
              onClick={handleSelectAllClick}
              title={allSelected ? "Deselect all" : "Select all"}
            >
              <input
                type="checkbox"
                ref={checkboxRef}
                checked={allSelected}
                onChange={() => { }}
                className="checklist-select-all-checkbox"
              />
              <span className="checklist-select-all-label">{allSelected ? "Deselect all" : "Select all"}</span>
            </button>
          ) : null}
        </td>
      </tr>

      {node.items.map((item) => (
        <ChecklistItemRow
          key={item.id}
          item={item}
          itemData={itemsData[item.id] || {}}
          onChange={onItemChange}
          isViewOnly={isViewOnly}
          isDAModule={isDAModule}
        />
      ))}

      {(node.subSections || []).map((sub, subIndex) => (
        <ChecklistSectionNode
          key={sub.id}
          node={sub}
          itemsData={itemsData}
          onItemChange={onItemChange}
          openSections={openSections}
          onSectionToggle={onSectionToggle}
          onSelectAll={onSelectAll}
          isViewOnly={isViewOnly}
          isDAModule={isDAModule}
          depth={depth + 1}
          sectionIndex={subIndex}
        />
      ))}
    </Fragment>
  );
};

function nodeItemsEveryUploaded(node, itemsData) {
  const ok = (id) => {
    const d = itemsData[id] || {};
    return d.checked === true;
  };
  const walk = (n) => {
    for (const it of n.items || []) {
      if (!ok(it.id)) return false;
    }
    for (const s of n.subSections || []) {
      if (!walk(s)) return false;
    }
    return true;
  };
  if ((node.items || []).length === 0 && !(node.subSections || []).length) return false;
  return walk(node);
}

function nodeItemsSomeUploaded(node, itemsData) {
  const any = (id) => {
    const d = itemsData[id] || {};
    return d.checked === true;
  };
  const walk = (n) => {
    for (const it of n.items || []) {
      if (any(it.id)) return true;
    }
    for (const s of n.subSections || []) {
      if (walk(s)) return true;
    }
    return false;
  };
  return walk(node);
}

ChecklistSectionNode.propTypes = {
  node: PropTypes.object.isRequired,
  itemsData: PropTypes.object.isRequired,
  onItemChange: PropTypes.func.isRequired,
  openSections: PropTypes.object.isRequired,
  onSectionToggle: PropTypes.func.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
  isDAModule: PropTypes.bool,
  depth: PropTypes.number,
  sectionIndex: PropTypes.number,
};

export default ChecklistSectionNode;
