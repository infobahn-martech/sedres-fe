import PropTypes from "prop-types";
import { useState } from "react";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import checklistService from "@/services/checklistService";
import { notify } from "@/components/Toaster";
import ChecklistSectionNode from "./ChecklistSectionNode";

/** Opens the generated checklist PDF. Supports a raw PDF blob or a JSON body carrying a file URL. */
const openChecklistPdf = async (response) => {
  const blob = response?.data;
  const contentType = String(response?.headers?.["content-type"] || blob?.type || "");

  if (contentType.includes("application/json")) {
    const body = JSON.parse(await blob.text());
    const d = body?.data ?? body;
    const url = d?.file_url ?? d?.pdf_url ?? d?.url ?? (typeof d === "string" ? d : null);
    if (!url) throw new Error(body?.message || "PDF could not be generated.");
    window.open(url, "_blank", "noopener");
    return;
  }

  const pdfUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  window.open(pdfUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
};

const readErrorMessage = async (err) => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text())?.message;
    } catch {
      return null;
    }
  }
  return data?.message || err?.message;
};

const ChecklistTypeBlock = ({
  typeTitle,
  typeId,
  callId,
  sectionTree,
  itemsData,
  onItemChange,
  openSections,
  onSectionToggle,
  onSelectAll,
  isViewOnly,
  isDAModule,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [printing, setPrinting] = useState(false);

  const canPrint = Boolean(callId) && typeId != null && String(typeId).trim() !== "";

  const handlePrint = async (e) => {
    e.stopPropagation();
    if (!canPrint) {
      notify("Call ID is missing. Please save general details first.", "error");
      return;
    }
    setPrinting(true);
    try {
      const response = await checklistService.generateChecklistPdf({
        call_id: Number(callId) || callId,
        checklist_type_id: Number(typeId) || typeId,
      });
      await openChecklistPdf(response);
    } catch (err) {
      notify((await readErrorMessage(err)) || "Failed to generate checklist PDF.", "error");
    } finally {
      setPrinting(false);
    }
  };

  const toggleCollapsed = () => setCollapsed((v) => !v);

  return (
    <div className={`cl-type-block cl-excel-block ${collapsed ? "is-collapsed" : ""}`}>
      <div
        className="cl-excel-type-title cl-excel-type-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleCollapsed();
          }
        }}
      >
        <span className="cl-excel-type-header-name" title={typeTitle}>{typeTitle}</span>
        <div className="cl-excel-type-actions">
          <button
            type="button"
            className="cl-type-action-btn cl-type-action-btn--print"
            onClick={handlePrint}
            disabled={printing}
            title="Print checklist"
          >
            {printing ? <Loader2 size={14} className="cl-spin" /> : <Printer size={14} />}
            <span>{printing ? "Generating…" : "Print"}</span>
          </button>
          <button
            type="button"
            className="cl-type-action-btn cl-type-action-btn--collapse"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
            title={collapsed ? "Expand checklist" : "Collapse checklist"}
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          >
            <ChevronDown size={16} className="cl-type-chevron" />
          </button>
        </div>
      </div>
      {!collapsed ? (
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
                  isViewOnly={isViewOnly}
                  isDAModule={isDAModule}
                  depth={0}
                  sectionIndex={index}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

ChecklistTypeBlock.propTypes = {
  typeTitle: PropTypes.string.isRequired,
  typeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sectionTree: PropTypes.array.isRequired,
  itemsData: PropTypes.object.isRequired,
  onItemChange: PropTypes.func.isRequired,
  openSections: PropTypes.object.isRequired,
  onSectionToggle: PropTypes.func.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
  isDAModule: PropTypes.bool,
};

export default ChecklistTypeBlock;
