import PropTypes from "prop-types";
import { useMemo } from "react";
import { FiEye } from "react-icons/fi";
import {
  DetailBox,
  DetailChips,
  DetailRow,
} from "@/pages/KanbanBoard/CardFormTabs/Import/tabs/appointment/GeneralViewAppointmentDetails";
import {
  buildTemplateFieldDisplay,
  flattenTimeObjects,
  normalizeTemplateTabs,
  sortTemplateFields,
} from "../utils/callDetailTemplate";

const openFile = (url) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const renderDisplayValue = (display) => {
  switch (display.kind) {
    case "text":
      return display.text;
    case "list":
      return <DetailChips items={display.items.filter(Boolean)} />;
    case "file":
      return (
        <div className="detail-attachment-row">
          <span className="detail-attachment-name">{display.fileName}</span>
          <button
            type="button"
            className="detail-attachment-view-btn"
            onClick={() => openFile(display.fileUrl)}
            disabled={!display.fileUrl}
            title={display.fileUrl ? `View ${display.fileName}` : "File URL not available"}
          >
            <FiEye size={14} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      );
    case "unsupported":
      return <span className="detail-row-empty">Can&apos;t display this field type ({display.type})</span>;
    default:
      return null;
  }
};

// Read-only rendering of one template tab's configured fields, in row/column order,
// with values resolved from the call detail (field value → time object → documented fallback).
function TemplateFieldsView({ title, fields, detail }) {
  const timeObjects = useMemo(() => flattenTimeObjects(detail), [detail]);
  const rows = useMemo(
    () =>
      sortTemplateFields(fields).map((field, index) => {
        const display = buildTemplateFieldDisplay(field, { detail, timeObjects });
        return {
          key: field.field_id ?? `${field.field_key ?? "field"}-${index}`,
          label: String(field.field_label ?? field.field_key ?? "").trim() || "Untitled field",
          display,
          span: display.kind === "file" || display.kind === "list",
        };
      }),
    [fields, detail, timeObjects]
  );

  if (!rows.length) return null;

  return (
    <DetailBox title={title}>
      {rows.map((row) => (
        <DetailRow key={row.key} label={row.label} span={row.span} value={renderDisplayValue(row.display)} />
      ))}
    </DetailBox>
  );
}

TemplateFieldsView.propTypes = {
  title: PropTypes.string.isRequired,
  fields: PropTypes.array,
  detail: PropTypes.object,
};

// Fallback for a configured tab/subtab whose tab_key has no existing component: shows its
// configured fields (and subtab fields) read-only, or an explanatory empty state.
export function TemplateTabPanel({ tab, detail }) {
  const subtabs = useMemo(() => normalizeTemplateTabs(tab?.rawSubtabs), [tab]);
  const hasFields = (tab?.fields?.length ?? 0) > 0 || subtabs.some((sub) => sub.fields.length > 0);

  if (!tab) return null;

  return (
    <div className="cardform-body card-form-panel general-tab-body general-tab-body--view-mode">
      <div className="general-view-detail-boxes">
        {hasFields ? (
          <>
            <TemplateFieldsView title={tab.label} fields={tab.fields} detail={detail} />
            {subtabs.map((sub) => (
              <TemplateFieldsView key={sub.tabId} title={sub.label} fields={sub.fields} detail={detail} />
            ))}
          </>
        ) : (
          <DetailBox title={tab.label}>
            <span className="detail-row-empty">This section isn&apos;t available in this version of the app yet.</span>
          </DetailBox>
        )}
      </div>
    </div>
  );
}

TemplateTabPanel.propTypes = {
  tab: PropTypes.shape({
    tabId: PropTypes.string,
    label: PropTypes.string,
    fields: PropTypes.array,
    rawSubtabs: PropTypes.array,
  }),
  detail: PropTypes.object,
};

export default TemplateFieldsView;
