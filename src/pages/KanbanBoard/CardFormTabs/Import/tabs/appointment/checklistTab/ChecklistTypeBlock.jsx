import PropTypes from "prop-types";
import ChecklistSectionNode from "./ChecklistSectionNode";

const ChecklistTypeBlock = ({
  typeTitle,
  sectionTree,
  itemsData,
  onItemChange,
  openSections,
  onSectionToggle,
  onSelectAll,
  cardColor,
  isViewOnly,
  isDAModule,
}) => (
  <div className="cl-type-block cl-excel-block" style={{ "--card-color": cardColor }}>
    {typeTitle ? (
      <div className="cl-excel-type-title">{typeTitle}</div>
    ) : null}
    <div className="cl-excel-table-wrap">
      <table className="checklist-items-table cl-items-table cl-excel-table cl-items-table--6col">
        <colgroup>
          <col className="checklist-col-check cl-col-check" />
          <col className="cl-col-requirement" />
          <col className="cl-col-item" />
          <col className="cl-col-role" />
          <col className="cl-col-upload" />
          <col className="cl-col-remarks" />
        </colgroup>
        <thead>
          <tr>
            <th className="checklist-table-checkbox-header">Done</th>
            <th className="checklist-table-requirement-header">Requirement / Type</th>
            <th className="checklist-table-label-header">Item</th>
            <th className="checklist-table-role-header">Task</th>
            <th className="checklist-table-upload-header">Document Upload</th>
            <th className="checklist-table-remarks-header">Updated Remarks</th>
          </tr>
        </thead>
        <tbody>
          {sectionTree.map((node, index) => (
            <ChecklistSectionNode
              key={node.id}
              node={node}
              itemsData={itemsData}
              onItemChange={onItemChange}
              openSections={openSections}
              onSectionToggle={onSectionToggle}
              onSelectAll={onSelectAll}
              cardColor={cardColor}
              isViewOnly={isViewOnly}
              isDAModule={isDAModule}
              depth={0}
              sectionIndex={index}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

ChecklistTypeBlock.propTypes = {
  typeTitle: PropTypes.string.isRequired,
  sectionTree: PropTypes.array.isRequired,
  itemsData: PropTypes.object.isRequired,
  onItemChange: PropTypes.func.isRequired,
  openSections: PropTypes.object.isRequired,
  onSectionToggle: PropTypes.func.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
  isDAModule: PropTypes.bool,
};

export default ChecklistTypeBlock;
