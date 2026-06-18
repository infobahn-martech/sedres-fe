import { useEffect, useState, useCallback } from "react";
import { FiX, FiChevronDown, FiChevronRight, FiPlus, FiTrash2 } from "react-icons/fi";
import SearchableSelect from "../../components/form/SearchableSelect";
import useCallTypeReducer from "../../store/CallTypeReducer";
import { DailyTaskTodo } from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/General";
import OperationTasksPanel from "../KanbanBoard/CardFormTabs/Import/tabs/operation/TaskTab";
import KPIAnalytics from "../KanbanBoard/CardFormTabs/Import/tabs/kpi/KPIAnalytics";
import DocumentLibrary from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/DocumentLibrary";
import Comments from "../KanbanBoard/CardFormTabs/Import/tabs/comments/Comments";
import Subtasks from "../KanbanBoard/CardFormTabs/Import/tabs/subTasks/SubTasks";
import Notes from "../KanbanBoard/CardFormTabs/Import/tabs/notes/Notes";
import DatePickerField from "../KanbanBoard/CardFormTabs/shared/components/DatePickerField";
import DateTimePickerField from "../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";
import "../../design/css/common/CardForm.css";
import "../../design/scss/general.scss";
import "../../design/scss/operations.scss";
import "../../design/scss/salesOrder.scss";
import "../../design/scss/pages/callTypeBuilder.scss";

// Static sample data for the Live Preview's Daily Tasks / Operation Tasks panels —
// these widgets show real operational data in the live modal and aren't driven by
// the builder's field toggles, so the preview just demonstrates their look.
const PREVIEW_DAILY_TASKS = [
    {
        id: "preview-task-1",
        text: "Upload appointment request email",
        status: "DELAYED",
        statusColor: "#c62828",
        startTime: "2026-06-11 10:00",
        dueTime: "2026-06-11 12:00",
        completedTime: "2026-06-11 13:10",
    },
    {
        id: "preview-task-2",
        text: "Open call file and child card created",
        status: "DELAYED",
        statusColor: "#c62828",
        delayText: "70 mins delay",
        startTime: "2026-06-11 10:00",
        dueTime: "2026-06-11 12:00",
        completedTime: "2026-06-11 13:10",
    },
];

const PREVIEW_OPERATION_TASK_SECTIONS = [
    {
        id: "preview-gro-supervisor",
        title: "GRO Supervisor",
        tasks: [
            { id: "preview-op-1", title: "Crew Immigration", assignedTo: "GRO Supervisor", status: "Pending", documentCount: 6, progress: 0, documents: [] },
            { id: "preview-op-2", title: "Vessel Inward Registration", assignedTo: "GRO Supervisor", status: "Pending", documentCount: 10, progress: 0, documents: [] },
        ],
    },
    {
        id: "preview-custom-clearance-supervisor",
        title: "Custom Clearance Supervisor",
        tasks: [
            { id: "preview-op-3", title: "Custom Bayan", assignedTo: "Custom Clearance Supervisor", status: "Pending", documentCount: 19, progress: 0, documents: [] },
        ],
    },
];

const PREVIEW_KPI_DATA = [
    { id: 1, name: "Appointment Acceptance", category: "Appointment Acceptance", performance: "On Target", value: 80, target: 75 },
    { id: 2, name: "Call file open", category: "Call file open", performance: "Above Target", value: 90, target: 75 },
    { id: 3, name: "Pre arrival report", category: "Pre arrival report", performance: "Below Target", value: 60, target: 75 },
    { id: 4, name: "Arrival report", category: "Arrival report", performance: "On Target", value: 76, target: 75 },
    { id: 5, name: "Vessel inward formalities", category: "Vessel inward formalities", performance: "Critical", value: 40, target: 75 },
    { id: 6, name: "Daily report", category: "Daily report", performance: "On Target", value: 78, target: 75 },
    { id: 7, name: "Outward clearance issue", category: "Outward clearance issue", performance: "Below Target", value: 65, target: 75 },
    { id: 8, name: "Outward clearance deliver", category: "Outward clearance deliver", performance: "Above Target", value: 85, target: 75 },
    { id: 9, name: "Sailing Report", category: "Sailing Report", performance: "On Target", value: 77, target: 75 },
];

const PREVIEW_KPI_TASKS = [
    { id: 1, task: "Appointment Acceptance", estimatedDuration: "2h 0m", elapsedTime: "1h 45m", status: "Completed" },
    { id: 2, task: "Call file open", estimatedDuration: "1h 30m", elapsedTime: "1h 10m", status: "Completed" },
    { id: 3, task: "Pre arrival report", estimatedDuration: "3h 0m", elapsedTime: "3h 30m", status: "Pending" },
    { id: 4, task: "Arrival report", estimatedDuration: "2h 0m", elapsedTime: "2h 5m", status: "In Progress" },
    { id: 5, task: "Vessel inward formalities", estimatedDuration: "4h 0m", elapsedTime: "5h 0m", status: "Cancelled" },
];

const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "datetime", label: "Date & Time" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
    { value: "radio", label: "Radio Button" },
    { value: "textarea", label: "Textarea" },
];

const CALL_TYPE_OPTIONS = [
    { value: "create_template", label: "Create Template" },
    { value: "import_call", label: "Import Call" },
    { value: "export_call", label: "Export Call" },
    { value: "husbandry_call", label: "Husbandry Call" },
    { value: "husbandry_monthly_call", label: "Husbandry Monthly Call" },
];

const PREVIEW_DATETIME_FIELDS = new Set([
    "Expected time of arrival",
    "Expected commencement of custom inspection",
    "Expected commencement of Immigration clearance for crew",
    "Expected completion of inward clearance",
    "Actual time of arrival",
    "Custom Inspection commenced",
    "Custom Inspection completed",
    "Crew immigration commenced",
    "Crew immigration completed",
    "Vessel Inward formalities completed",
    "Marine work permit applied",
    "Marine work permit issued",
    "Marine work permit expires",
    "Request for outward clearance received",
    "Outward clearance issued",
    "Outward clearance delivered",
    "Vessel Sailed",
]);

const PREVIEW_SELECT_FIELDS = new Set([
    "SABER Status",
    "Weather Forecast",
    "Coordinates Type",
    "Select Coordinates",
    "Custom Inspection Status",
    "Crew Immigration Status",
    "Inward Clearance Status",
    "MWP Status",
]);

const PREVIEW_FILE_FIELDS = new Set([
    "SABER Certificate Upload",
    "Inward Clearance Document",
    "MWP Document",
    "SADAD Document",
    "Initial Bayan Document",
    "Final Bayan Document",
]);

const OPERATION_SUBTAB_TITLES = {
    pre_arrival: "Pre-Arrival Information",
    arrival: "Arrival Information",
    departure: "Departure Information",
    check_list: "Check List",
};

const OPERATION_SUBTAB_EMAIL_SUBJECTS = {
    pre_arrival: "Report - Pre Arrival",
    arrival: "Report - Arrival",
    departure: "Report - Departure",
};

// Main tabs — mirrors the top-level tabs of the real kanban card modal (CardForm.jsx ALL_TOP_TABS).
// Tabs that own fields directly use `fields`; tabs whose fields are grouped under section
// headers (matching General.jsx's form-group-title sections) use `groups`; tabs that nest
// their own sub-tabs use `subTabs`; tabs with neither are simple include/exclude toggles.
const MAIN_TABS = [
    {
        id: "appointment_details",
        label: "Appointment Details",
        // Mirrors the real "Appointment Details" tab (General.jsx) at /kanban-board/:id —
        // same three section headers and field labels as the live card modal.
        groups: [
            {
                label: "Appointment Details",
                fields: ["Appointment Email", "Appointment Received"],
            },
            {
                label: "Service Information",
                fields: ["Time Objects", "Last Port", "Main Billing Entity", "PO No", "Project"],
            },
            {
                label: "Vessel Information",
                fields: [
                    "Appointment Type",
                    "Vessel Type",
                    "Vessel Name",
                    "Vessel Owner",
                    "Vessel Charter",
                    "Barge Type",
                    "Barge Name",
                    "Barge Owner",
                    "Assigned Operator",
                    "Service Requestor Name",
                    "Service Requestor Email",
                    "Daily Report Emails",
                    "Billing Instructions",
                ],
            },
        ],
    },
    {
        id: "operation",
        label: "Operation",
        subTabs: [
            {
                id: "pre_arrival",
                label: "Pre Arrival",
                fields: [
                    "Expected time of arrival",
                    "Expected commencement of custom inspection",
                    "Expected commencement of Immigration clearance for crew",
                    "Expected completion of inward clearance",
                    "SABER Status",
                    "SABER Certificate Upload",
                    "Weather Forecast",
                    "Coordinates Type",
                    "Select Coordinates",
                    "Coordinates",
                ],
            },
            {
                id: "arrival",
                label: "Arrival",
                fields: [
                    "Actual time of arrival",
                    "Custom Inspection commenced",
                    "Custom Inspection completed",
                    "Crew immigration commenced",
                    "Crew immigration completed",
                    "Vessel Inward formalities completed",
                    "Marine work permit applied",
                    "Marine work permit issued",
                    "Marine work permit expires",
                    "Custom Inspection Status",
                    "Custom Inspection Remark",
                    "Crew Immigration Status",
                    "Crew Immigration Remark",
                    "Inward Clearance Status",
                    "MWP Ticket No",
                    "MWP Status",
                    "SADAD No",
                    "Inward Clearance Document",
                    "MWP Document",
                    "SADAD Document",
                    "Initial Bayan Document",
                    "Final Bayan Document",
                ],
            },
            {
                id: "departure",
                label: "Departure",
                fields: [
                    "Request for outward clearance received",
                    "Outward clearance issued",
                    "Outward clearance delivered",
                    "Vessel Sailed",
                    "Email Requested Accept",
                    "Next port",
                ],
            },
            { id: "check_list", label: "Check List" },
        ],
    },
    {
        id: "husbandry",
        label: "Husbandry",
        subTabs: [
            { id: "crewManagement", label: "Crew Management" },
            { id: "warehouse", label: "Warehouse" },
            { id: "onOffHireSurvey", label: "On/Off-Hire Survey" },
            { id: "onStation", label: "On Station" },
            { id: "materialManagement", label: "Material Management" },
            { id: "wasteDisposal", label: "Waste Disposal" },
            { id: "mwpRenewal", label: "MWP Renewal" },
            { id: "thirdPartyServices", label: "Third-Party Services" },
        ],
    },
    {
        id: "sales_order",
        label: "Sales Order",
        groups: [
            {
                label: "Header Fields",
                fields: [
                    "PO No", "Project Name", "Port",
                    "Delivery Date", "Document Date", "Ship Name", "BP Currency",
                ],
            },
            {
                label: "Line Item Columns",
                fields: [
                    "Item No", "Item Description", "Quantity", "Unit Price",
                    "Discount %", "Tax Code", "Total Amount",
                    "Type of PO", "Document Picker", "Supplier Code",
                ],
            },
        ],
    },
    {
        id: "reports",
        label: "Reports",
        fields: [
            "Reporting Format",
            "Appointment Acceptance",
            "Arrival Report",
            "Daily Report",
            "Departure Report",
            "Pre-arrival Report",
        ],
        editableWhenUnchecked: true,
    },
    { id: "kpi", label: "KPI" },
    { id: "document_library", label: "Document Library" },
    { id: "comments", label: "Comments" },
    { id: "subtasks", label: "Subtasks" },
    { id: "notes", label: "Notes" },
];

// A main tab's full field list, whether declared flat (`fields`) or under section headers (`groups`).
const getTabFieldList = (tab) =>
    tab.groups ? tab.groups.flatMap((g) => g.fields) : (tab.fields ?? []);

const buildInitialTabConfig = () => {
    const config = {};
    for (const tab of MAIN_TABS) {
        if (tab.subTabs) {
            config[tab.id] = {
                enabled: false,
                subTabs: Object.fromEntries(
                    tab.subTabs.map((sub) => [
                        sub.id,
                        sub.fields
                            ? { enabled: false, fields: Object.fromEntries(sub.fields.map((f) => [f, false])), customFields: [] }
                            : { enabled: false, customFields: [] },
                    ])
                ),
            };
        } else if (tab.fields || tab.groups) {
            config[tab.id] = {
                enabled: false,
                fields: Object.fromEntries(getTabFieldList(tab).map((f) => [f, false])),
                customFields: [],
                ...(tab.editableWhenUnchecked ? { fieldOverrides: {}, deletedFields: [] } : {}),
            };
        } else {
            config[tab.id] = { enabled: false, customFields: [] };
        }
    }
    return config;
};

// Updates either a main tab's own scope (subId == null) or one of its nested sub-tabs.
const updateScope = (prev, mainId, subId, updater) => {
    if (subId == null) {
        return { ...prev, [mainId]: updater(prev[mainId]) };
    }
    return {
        ...prev,
        [mainId]: {
            ...prev[mainId],
            subTabs: { ...prev[mainId].subTabs, [subId]: updater(prev[mainId].subTabs[subId]) },
        },
    };
};

function CustomFieldRow({ field, onUpdate, onRemove }) {
    const isRadio = field.type === "radio";
    const options = field.options ?? [];

    const handleAddOption = () =>
        onUpdate(field.id, "options", [...options, ""]);

    const handleUpdateOption = (idx, val) => {
        const next = [...options];
        next[idx] = val;
        onUpdate(field.id, "options", next);
    };

    const handleRemoveOption = (idx) =>
        onUpdate(field.id, "options", options.filter((_, i) => i !== idx));

    return (
        <div className="ct-custom-field-wrap">
            <div className="ct-custom-field-row">
                <input
                    className="ct-custom-field-input"
                    placeholder="Field name"
                    value={field.label}
                    onChange={(e) => onUpdate(field.id, "label", e.target.value)}
                />
                <select
                    className="ct-custom-field-select"
                    value={field.type}
                    onChange={(e) => onUpdate(field.id, "type", e.target.value)}
                >
                    {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                </select>
                <button type="button" className="ct-custom-field-del" onClick={() => onRemove(field.id)}>
                    <FiTrash2 size={13} />
                </button>
            </div>
            {isRadio && (
                <div className="ct-radio-options">
                    {options.map((opt, idx) => (
                        <div key={idx} className="ct-radio-option-row">
                            <span className="ct-radio-option-dot" />
                            <input
                                className="ct-custom-field-input"
                                placeholder={`Option ${idx + 1}`}
                                value={opt}
                                onChange={(e) => handleUpdateOption(idx, e.target.value)}
                            />
                            <button type="button" className="ct-custom-field-del" onClick={() => handleRemoveOption(idx)}>
                                <FiTrash2 size={12} />
                            </button>
                        </div>
                    ))}
                    <button type="button" className="ct-add-radio-option-btn" onClick={handleAddOption}>
                        <FiPlus size={11} /> Add Option
                    </button>
                </div>
            )}
        </div>
    );
}

function CustomFieldPreviewItem({ field }) {
    const label = field.label || "Unnamed Field";
    const [dateVal, setDateVal] = useState("");
    const [datetimeDate, setDatetimeDate] = useState("");
    const [datetimeTime, setDatetimeTime] = useState("");
    const [checked, setChecked] = useState(false);
    const [radioVal, setRadioVal] = useState("");
    const [textVal, setTextVal] = useState("");

    if (field.type === "date") {
        return (
            <div className="cf-field">
                <label>{label}</label>
                <DatePickerField
                    dateValue={dateVal}
                    onDateChange={(e) => setDateVal(e.target.value)}
                    placeholder="Select date"
                />
            </div>
        );
    }
    if (field.type === "datetime") {
        return (
            <div className="cf-field">
                <label>{label}</label>
                <DateTimePickerField
                    dateValue={datetimeDate}
                    timeValue={datetimeTime}
                    onDateTimeChange={({ date, time }) => { setDatetimeDate(date); setDatetimeTime(time); }}
                    placeholder="Select date and time"
                />
            </div>
        );
    }
    if (field.type === "checkbox") {
        return (
            <div className="cf-field ct-preview-span-full">
                <label className="ct-preview-check-mock">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>{label}</span>
                </label>
            </div>
        );
    }
    if (field.type === "radio") {
        const radioOptions = (field.options ?? []).filter(Boolean);
        const displayOptions = radioOptions.length > 0 ? radioOptions : ["Option 1", "Option 2", "Option 3"];
        return (
            <div className="cf-field ct-preview-span-full">
                <label>{label}</label>
                <div className="ct-preview-radio-mock">
                    {displayOptions.map((opt, i) => (
                        <label key={i} className="ct-preview-radio-option">
                            <input type="radio" name={`preview-radio-${field.id}`} value={opt} checked={radioVal === opt} onChange={() => setRadioVal(opt)} />
                            <span>{opt}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    }
    if (field.type === "textarea") {
        return (
            <div className="cf-field ct-preview-span-full">
                <label>{label}</label>
                <textarea className="ct-preview-textarea-mock" rows={3} placeholder="Enter text..." value={textVal} onChange={(e) => setTextVal(e.target.value)} />
            </div>
        );
    }
    if (field.type === "dropdown") {
        return (
            <div className="cf-field">
                <label>{label}</label>
                <div className="cf-input ct-preview-select-input">
                    <input type="text" placeholder="Select option..." value={textVal} onChange={(e) => setTextVal(e.target.value)} />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
            </div>
        );
    }
    return (
        <div className="cf-field">
            <label>{label}</label>
            <div className="cf-input">
                <input
                    type={field.type === "number" ? "number" : "text"}
                    placeholder={label}
                    value={textVal}
                    onChange={(e) => setTextVal(e.target.value)}
                />
            </div>
        </div>
    );
}

function FieldCheckList({ fields, fieldMap, onToggleField }) {
    return (
        <div className="ct-field-list">
            {fields.map((field) => (
                <label key={field} className="ct-field-check-label">
                    <input
                        type="checkbox"
                        checked={fieldMap[field] ?? false}
                        onChange={(e) => onToggleField(field, e.target.checked)}
                    />
                    <span>{field}</span>
                </label>
            ))}
        </div>
    );
}

function EditableFieldCheckList({ fields, fieldMap, deletedFields, fieldOverrides, onToggleField, onRenameField, onDeleteField }) {
    const visibleFields = fields.filter((f) => !deletedFields.includes(f));
    return (
        <div className="ct-field-list">
            {visibleFields.map((field) => {
                const isChecked = fieldMap[field] ?? false;
                const displayLabel = fieldOverrides[field] ?? field;
                if (isChecked) {
                    return (
                        <label key={field} className="ct-field-check-label">
                            <input
                                type="checkbox"
                                checked={true}
                                onChange={(e) => onToggleField(field, e.target.checked)}
                            />
                            <span>{displayLabel}</span>
                        </label>
                    );
                }
                return (
                    <div key={field} className="ct-field-check-editable">
                        <input
                            type="checkbox"
                            checked={false}
                            onChange={(e) => onToggleField(field, e.target.checked)}
                        />
                        <input
                            type="text"
                            className="ct-report-field-input"
                            value={displayLabel}
                            onChange={(e) => onRenameField(field, e.target.value)}
                        />
                        <button type="button" className="ct-custom-field-del" onClick={() => onDeleteField(field)}>
                            <FiTrash2 size={13} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function FieldsBlock({ fields, groups, fieldMap, customFields, onToggleField, onAddCustomField, onUpdateCustomField, onRemoveCustomField, editableWhenUnchecked, fieldOverrides, deletedFields, onRenameField, onDeleteField }) {
    return (
        <>
            {groups ? (
                groups.map((group) => (
                    <div key={group.label} className="ct-field-group">
                        <p className="ct-field-group-label">{group.label}</p>
                        <FieldCheckList fields={group.fields} fieldMap={fieldMap} onToggleField={onToggleField} />
                    </div>
                ))
            ) : editableWhenUnchecked ? (
                <EditableFieldCheckList
                    fields={fields}
                    fieldMap={fieldMap}
                    deletedFields={deletedFields}
                    fieldOverrides={fieldOverrides}
                    onToggleField={onToggleField}
                    onRenameField={onRenameField}
                    onDeleteField={onDeleteField}
                />
            ) : (
                <FieldCheckList fields={fields} fieldMap={fieldMap} onToggleField={onToggleField} />
            )}

            {customFields.length > 0 && (
                <div className="ct-custom-fields-list">
                    <p className="ct-custom-fields-heading">Custom Fields</p>
                    {customFields.map((cf) => (
                        <CustomFieldRow
                            key={cf.id}
                            field={cf}
                            onUpdate={onUpdateCustomField}
                            onRemove={onRemoveCustomField}
                        />
                    ))}
                </div>
            )}

            <button type="button" className="ct-add-custom-btn" onClick={onAddCustomField}>
                <FiPlus size={13} /> Add Custom Field
            </button>
        </>
    );
}

function SubTabRow({ mainId, sub, mainConfig, isOpen, onToggleOpen, onToggleSubTab, onToggleField, onSelectAll, onAddCustomField, onUpdateCustomField, onRemoveCustomField }) {
    const subConfig = mainConfig.subTabs?.[sub.id] ?? {};
    const isEnabled = subConfig.enabled ?? false;
    const hasFields = Array.isArray(sub.fields);
    const fieldMap = subConfig.fields ?? {};
    const customFields = subConfig.customFields ?? [];
    const allChecked = hasFields && sub.fields.every((f) => fieldMap[f]);
    const anyChecked = hasFields
        ? sub.fields.some((f) => fieldMap[f]) || customFields.length > 0
        : customFields.length > 0;

    const handleLabelClick = (e) => {
        e.stopPropagation();
        if (!isOpen) onToggleOpen(sub.id);
        if (hasFields) onSelectAll(mainId, sub.id, sub.fields, !allChecked);
    };

    return (
        <div className={`ct-subtab-item ${isEnabled ? "ct-subtab-item--enabled" : ""}`}>
            <div className="ct-accordion-header">
                <label className="ct-tab-toggle">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => onToggleSubTab(mainId, sub.id, e.target.checked)}
                    />
                </label>
                <button type="button" className="ct-accordion-trigger" onClick={() => onToggleOpen(sub.id)}>
                    <span className="ct-accordion-label" onClick={handleLabelClick}>{sub.label}</span>
                    {anyChecked && (
                        <span className="ct-accordion-badge">
                            {hasFields
                                ? sub.fields.filter((f) => fieldMap[f]).length + customFields.length
                                : customFields.length}
                        </span>
                    )}
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
            </div>

            {isOpen && (
                <div className="ct-accordion-body">
                    {hasFields ? (
                        <FieldsBlock
                            fields={sub.fields}
                            fieldMap={fieldMap}
                            customFields={customFields}
                            onToggleField={(field, checked) => onToggleField(mainId, sub.id, field, checked)}
                            onAddCustomField={() => onAddCustomField(mainId, sub.id)}
                            onUpdateCustomField={(id, key, val) => onUpdateCustomField(mainId, sub.id, id, key, val)}
                            onRemoveCustomField={(id) => onRemoveCustomField(mainId, sub.id, id)}
                        />
                    ) : (
                        <>
                            {customFields.length > 0 && (
                                <div className="ct-custom-fields-list">
                                    <p className="ct-custom-fields-heading">Custom Fields</p>
                                    {customFields.map((cf) => (
                                        <CustomFieldRow
                                            key={cf.id}
                                            field={cf}
                                            onUpdate={(id, key, val) => onUpdateCustomField(mainId, sub.id, id, key, val)}
                                            onRemove={(id) => onRemoveCustomField(mainId, sub.id, id)}
                                        />
                                    ))}
                                </div>
                            )}
                            <button type="button" className="ct-add-custom-btn" onClick={() => onAddCustomField(mainId, sub.id)}>
                                <FiPlus size={13} /> Add Custom Field
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function MainTabAccordion({ tab, config, openMainTab, openSubTab, onToggleOpenMain, onToggleOpenSub, onToggleMainTab, onToggleSubTab, onToggleField, onSelectAll, onAddCustomField, onUpdateCustomField, onRemoveCustomField, onRenameReportField, onDeleteReportField }) {
    const mainConfig = config[tab.id] ?? {};
    const isEnabled = mainConfig.enabled ?? false;
    const isOpen = openMainTab === tab.id;
    const hasDirectFields = Boolean(tab.fields || tab.groups);
    const isSimpleTab = !hasDirectFields && !tab.subTabs;
    const allFieldsList = getTabFieldList(tab);
    const fieldMap = mainConfig.fields ?? {};
    const customFields = mainConfig.customFields ?? [];
    const allChecked = hasDirectFields && allFieldsList.every((f) => fieldMap[f]);
    const enabledSubCount = tab.subTabs?.filter((s) => mainConfig.subTabs?.[s.id]?.enabled).length ?? 0;
    const anyChecked = hasDirectFields
        ? allFieldsList.some((f) => fieldMap[f]) || customFields.length > 0
        : tab.subTabs
            ? enabledSubCount > 0
            : customFields.length > 0;

    const handleLabelClick = (e) => {
        e.stopPropagation();
        if (!isOpen) onToggleOpenMain(tab.id);
        if (hasDirectFields) onSelectAll(tab.id, null, allFieldsList, !allChecked);
    };

    return (
        <div className={`ct-accordion-item ${isEnabled ? "ct-accordion-item--enabled" : ""}`}>
            <div className="ct-accordion-header">
                <label className="ct-tab-toggle">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => onToggleMainTab(tab.id, e.target.checked)}
                    />
                </label>
                <button type="button" className="ct-accordion-trigger" onClick={() => onToggleOpenMain(tab.id)}>
                    <span className="ct-accordion-label" onClick={handleLabelClick}>{tab.label}</span>
                    {anyChecked && (
                        <span className="ct-accordion-badge">
                            {hasDirectFields
                                ? allFieldsList.filter((f) => fieldMap[f]).length + customFields.length
                                : tab.subTabs
                                    ? `${enabledSubCount} sub-tab${enabledSubCount > 1 ? "s" : ""}`
                                    : customFields.length}
                        </span>
                    )}
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
            </div>

            {isOpen && (
                <div className="ct-accordion-body">
                    {hasDirectFields && (
                        <FieldsBlock
                            fields={tab.fields}
                            groups={tab.groups}
                            fieldMap={fieldMap}
                            customFields={customFields}
                            onToggleField={(field, checked) => onToggleField(tab.id, null, field, checked)}
                            onAddCustomField={() => onAddCustomField(tab.id, null)}
                            onUpdateCustomField={(id, key, val) => onUpdateCustomField(tab.id, null, id, key, val)}
                            onRemoveCustomField={(id) => onRemoveCustomField(tab.id, null, id)}
                            editableWhenUnchecked={tab.editableWhenUnchecked ?? false}
                            fieldOverrides={mainConfig.fieldOverrides ?? {}}
                            deletedFields={mainConfig.deletedFields ?? []}
                            onRenameField={(fieldName, newLabel) => onRenameReportField(tab.id, fieldName, newLabel)}
                            onDeleteField={(fieldName) => onDeleteReportField(tab.id, fieldName)}
                        />
                    )}

                    {tab.subTabs && (
                        <div className="ct-subtabs-list">
                            {tab.subTabs.map((sub) => (
                                <SubTabRow
                                    key={sub.id}
                                    mainId={tab.id}
                                    sub={sub}
                                    mainConfig={mainConfig}
                                    isOpen={openSubTab === sub.id}
                                    onToggleOpen={onToggleOpenSub}
                                    onToggleSubTab={onToggleSubTab}
                                    onToggleField={onToggleField}
                                    onSelectAll={onSelectAll}
                                    onAddCustomField={onAddCustomField}
                                    onUpdateCustomField={onUpdateCustomField}
                                    onRemoveCustomField={onRemoveCustomField}
                                />
                            ))}
                        </div>
                    )}

                    {isSimpleTab && (
                        <>
                            {customFields.length > 0 && (
                                <div className="ct-custom-fields-list">
                                    <p className="ct-custom-fields-heading">Custom Fields</p>
                                    {customFields.map((cf) => (
                                        <CustomFieldRow
                                            key={cf.id}
                                            field={cf}
                                            onUpdate={(id, key, val) => onUpdateCustomField(tab.id, null, id, key, val)}
                                            onRemove={(id) => onRemoveCustomField(tab.id, null, id)}
                                        />
                                    ))}
                                </div>
                            )}
                            <button type="button" className="ct-add-custom-btn" onClick={() => onAddCustomField(tab.id, null)}>
                                <FiPlus size={13} /> Add Custom Field
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function CustomTabAccordion({ tab, isOpen, onToggleOpen, onToggle, onRename, onRemove, onAddField, onUpdateField, onRemoveField }) {
    const fields = tab.fields ?? [];
    return (
        <div className={`ct-accordion-item ct-custom-tab-item ${tab.enabled ? "ct-accordion-item--enabled" : ""}`}>
            <div className="ct-accordion-header">
                <label className="ct-tab-toggle">
                    <input
                        type="checkbox"
                        checked={tab.enabled}
                        onChange={(e) => onToggle(tab.id, e.target.checked)}
                    />
                </label>
                <input
                    className="ct-custom-tab-name-input"
                    value={tab.label}
                    placeholder="Tab name..."
                    onChange={(e) => onRename(tab.id, e.target.value)}
                />
                {fields.length > 0 && <span className="ct-accordion-badge">{fields.length}</span>}
                <button type="button" className="ct-accordion-expand-btn" onClick={() => onToggleOpen(tab.id)}>
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
                <button type="button" className="ct-custom-field-del ct-custom-tab-del" title="Delete tab" onClick={() => onRemove(tab.id)}>
                    <FiTrash2 size={13} />
                </button>
            </div>

            {isOpen && (
                <div className="ct-accordion-body">
                    {fields.length > 0 && (
                        <div className="ct-custom-fields-list">
                            <p className="ct-custom-fields-heading">Fields</p>
                            {fields.map((f) => (
                                <CustomFieldRow
                                    key={f.id}
                                    field={f}
                                    onUpdate={(id, key, val) => onUpdateField(tab.id, id, key, val)}
                                    onRemove={(id) => onRemoveField(tab.id, id)}
                                />
                            ))}
                        </div>
                    )}
                    <button type="button" className="ct-add-custom-btn" onClick={() => onAddField(tab.id)}>
                        <FiPlus size={13} /> Add Field
                    </button>
                </div>
            )}
        </div>
    );
}

function CallTypeBuilderModal({ show, onClose }) {
    const {
        getCallTypes, callTypes, isLoadingGet,
        addCallType, updateCallType, deleteCallType,
        isBeingUpdated, isLoadingDelete,
    } = useCallTypeReducer((s) => s);

    const [editingCallType, setEditingCallType] = useState(null);
    const [templateName, setTemplateName] = useState("");
    const [selectedCallType, setSelectedCallType] = useState("create_template");
    const [tabConfig, setTabConfig] = useState(buildInitialTabConfig);
    const [openMainTab, setOpenMainTab] = useState(null);
    const [openSubTab, setOpenSubTab] = useState(null);
    const [customTabs, setCustomTabs] = useState([]);
    const [openCustomTab, setOpenCustomTab] = useState(null);
    const [callTypeError, setCallTypeError] = useState("");
    const [previewActiveMain, setPreviewActiveMain] = useState(null);
    const [previewActiveSub, setPreviewActiveSub] = useState(null);

    useEffect(() => {
        if (show) getCallTypes({});
    }, [show, getCallTypes]);

    // Template Name is shown when "Create Template" is chosen (or legacy records with empty value).
    const isCreateTemplate = !selectedCallType || selectedCallType === "create_template";

    const handleNew = useCallback(() => {
        setEditingCallType(null);
        setTemplateName("");
        setSelectedCallType("create_template");
        setTabConfig(buildInitialTabConfig());
        setOpenMainTab(null);
        setOpenSubTab(null);
        setCustomTabs([]);
        setOpenCustomTab(null);
        setCallTypeError("");
    }, []);

    const handleClearAll = useCallback(() => {
        setTabConfig(buildInitialTabConfig());
        setOpenMainTab(null);
        setOpenSubTab(null);
        setCustomTabs([]);
        setOpenCustomTab(null);
    }, []);

    const parseTabConfig = (raw) => {
        if (!raw) return null;
        if (typeof raw === "string") {
            try { return JSON.parse(raw); } catch { return null; }
        }
        return typeof raw === "object" ? raw : null;
    };

    const handleSelectCallType = (ct) => {
        setEditingCallType(ct);
        setTemplateName(ct.call_type_name ?? "");
        setSelectedCallType(ct.selected_call_type ?? "");
        const tabCfg = parseTabConfig(ct.tab_config);
        const restored = buildInitialTabConfig();
        if (tabCfg) {
            for (const tab of MAIN_TABS) {
                const saved = tabCfg[tab.id];
                if (!saved) continue;
                if (tab.subTabs) {
                    restored[tab.id].enabled = saved.enabled ?? false;
                    for (const sub of tab.subTabs) {
                        const savedSub = saved.subTabs?.[sub.id];
                        if (savedSub) {
                            restored[tab.id].subTabs[sub.id] = {
                                ...restored[tab.id].subTabs[sub.id],
                                ...savedSub,
                                customFields: (savedSub.customFields ?? []).map((f) => ({ ...f, id: `cf-${Date.now()}-${Math.random()}` })),
                            };
                        }
                    }
                } else {
                    restored[tab.id] = {
                        ...restored[tab.id],
                        ...saved,
                        customFields: (saved.customFields ?? []).map((f) => ({ ...f, id: `cf-${Date.now()}-${Math.random()}` })),
                    };
                }
            }
        }
        setTabConfig(restored);
        setOpenMainTab(null);
        setOpenSubTab(null);
        const savedCustomTabs = tabCfg?.customTabs ?? tabCfg?._customTabs ?? [];
        setCustomTabs(savedCustomTabs.map((t) => ({
            ...t,
            id: `ct-${Date.now()}-${Math.random()}`,
            fields: (t.fields ?? []).map((f) => ({ ...f, id: `cf-${Date.now()}-${Math.random()}` })),
        })));
        setOpenCustomTab(null);
        setCallTypeError("");
    };

    const handleToggleOpenMain = (mainId) => {
        setOpenMainTab((prev) => (prev === mainId ? null : mainId));
        setOpenSubTab(null);
    };

    const handleToggleOpenSub = (subId) =>
        setOpenSubTab((prev) => (prev === subId ? null : subId));

    const handleToggleMainTab = (mainId, checked) =>
        setTabConfig((prev) => updateScope(prev, mainId, null, (scope) => {
            if (checked) {
                const tab = MAIN_TABS.find((t) => t.id === mainId);
                if (tab && (tab.fields || tab.groups)) {
                    const allFields = getTabFieldList(tab);
                    const deletedSet = new Set(scope.deletedFields ?? []);
                    return { ...scope, enabled: true, fields: Object.fromEntries(allFields.map((f) => [f, !deletedSet.has(f)])) };
                }
            }
            return { ...scope, enabled: checked };
        }));

    const handleToggleSubTab = (mainId, subId, checked) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => {
            if (checked) {
                const mainTab = MAIN_TABS.find((t) => t.id === mainId);
                const sub = mainTab?.subTabs?.find((s) => s.id === subId);
                if (sub?.fields) {
                    return { ...scope, enabled: true, fields: Object.fromEntries(sub.fields.map((f) => [f, true])) };
                }
            }
            return { ...scope, enabled: checked };
        }));

    const handleToggleField = (mainId, subId, field, checked) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => ({
            ...scope,
            fields: { ...scope.fields, [field]: checked },
        })));

    const handleSelectAll = (mainId, subId, fieldsList, checked) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => ({
            ...scope,
            fields: Object.fromEntries(fieldsList.map((f) => [f, checked])),
        })));

    const handleAddCustomField = (mainId, subId) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => ({
            ...scope,
            customFields: [...(scope.customFields ?? []), { id: `cf-${Date.now()}-${Math.random()}`, label: "", type: "text" }],
        })));

    const handleUpdateCustomField = (mainId, subId, fieldId, key, value) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => ({
            ...scope,
            customFields: scope.customFields.map((cf) => (cf.id === fieldId ? { ...cf, [key]: value } : cf)),
        })));

    const handleRemoveCustomField = (mainId, subId, fieldId) =>
        setTabConfig((prev) => updateScope(prev, mainId, subId, (scope) => ({
            ...scope,
            customFields: scope.customFields.filter((cf) => cf.id !== fieldId),
        })));

    const handleAddCustomTab = useCallback(() => {
        const newTab = { id: `ct-${Date.now()}-${Math.random()}`, label: "", enabled: true, fields: [] };
        setCustomTabs((prev) => [...prev, newTab]);
        setOpenCustomTab(newTab.id);
    }, []);

    const handleToggleCustomTab = (tabId, checked) =>
        setCustomTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, enabled: checked } : t)));

    const handleRenameCustomTab = (tabId, label) =>
        setCustomTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, label } : t)));

    const handleRemoveCustomTab = (tabId) => {
        setCustomTabs((prev) => prev.filter((t) => t.id !== tabId));
        setOpenCustomTab((prev) => (prev === tabId ? null : prev));
    };

    const handleToggleOpenCustomTab = (tabId) =>
        setOpenCustomTab((prev) => (prev === tabId ? null : tabId));

    const handleAddCustomTabField = (tabId) =>
        setCustomTabs((prev) => prev.map((t) =>
            t.id === tabId
                ? { ...t, fields: [...t.fields, { id: `cf-${Date.now()}-${Math.random()}`, label: "", type: "text" }] }
                : t
        ));

    const handleUpdateCustomTabField = (tabId, fieldId, key, val) =>
        setCustomTabs((prev) => prev.map((t) =>
            t.id === tabId
                ? { ...t, fields: t.fields.map((f) => (f.id === fieldId ? { ...f, [key]: val } : f)) }
                : t
        ));

    const handleRemoveCustomTabField = (tabId, fieldId) =>
        setCustomTabs((prev) => prev.map((t) =>
            t.id === tabId ? { ...t, fields: t.fields.filter((f) => f.id !== fieldId) } : t
        ));

    const handleRenameReportField = (mainId, fieldName, newLabel) =>
        setTabConfig((prev) => updateScope(prev, mainId, null, (scope) => ({
            ...scope,
            fieldOverrides: { ...scope.fieldOverrides, [fieldName]: newLabel },
        })));

    const handleDeleteReportField = (mainId, fieldName) =>
        setTabConfig((prev) => updateScope(prev, mainId, null, (scope) => ({
            ...scope,
            fields: { ...scope.fields, [fieldName]: false },
            deletedFields: [...(scope.deletedFields ?? []), fieldName],
        })));

    const handleSave = async () => {
        if (isCreateTemplate && !templateName.trim()) {
            setCallTypeError("Please select a call type or enter a template name");
            return;
        }
        setCallTypeError("");
        const callTypeLabel = CALL_TYPE_OPTIONS.find((o) => o.value === selectedCallType)?.label ?? "";
        const stripCustomFieldIds = (cfg) => {
            const out = {};
            for (const [k, v] of Object.entries(cfg)) {
                if (!v || typeof v !== "object") { out[k] = v; continue; }
                if (v.subTabs) {
                    const subs = {};
                    for (const [sid, sv] of Object.entries(v.subTabs)) {
                        subs[sid] = { ...sv, customFields: (sv.customFields ?? []).map(({ id: _i, ...f }) => f) };
                    }
                    out[k] = { ...v, subTabs: subs };
                } else {
                    out[k] = { ...v, customFields: (v.customFields ?? []).map(({ id: _i, ...f }) => f) };
                }
            }
            return out;
        };
        const savedTabConfig = {
            ...stripCustomFieldIds(tabConfig),
            customTabs: customTabs.map(({ id: _id, ...rest }) => ({
                ...rest,
                fields: (rest.fields ?? []).map(({ id: _fid, ...frest }) => frest),
            })),
        };
        const payload = {
            call_type_name: isCreateTemplate ? templateName.trim() : callTypeLabel,
            selected_call_type: selectedCallType,
            tab_config: savedTabConfig,
        };
        if (editingCallType?.call_type_id) {
            await updateCallType({
                formData: { call_type_id: editingCallType.call_type_id, ...payload },
                cb: () => {
                    setEditingCallType((prev) => prev ? { ...prev, tab_config: savedTabConfig } : prev);
                    getCallTypes({});
                },
            });
        } else {
            await addCallType({
                formData: payload,
                cb: () => { handleNew(); getCallTypes({}); },
            });
        }
    };

    const handleDelete = async (e, ct) => {
        e.stopPropagation();
        if (!window.confirm(`Delete "${ct.call_type_name || "this template"}"?`)) return;
        await deleteCallType(ct.call_type_id);
        if (editingCallType?.call_type_id === ct.call_type_id) handleNew();
        getCallTypes({});
    };

    if (!show) return null;

    const list = Array.isArray(callTypes) ? callTypes : [];
    const isEditMode = !!editingCallType?.call_type_id;

    const enabledMainTabs = MAIN_TABS.filter((t) => tabConfig[t.id]?.enabled);
    const enabledCustomPreviewTabs = customTabs.filter((t) => t.enabled).map((t) => ({ ...t, _isCustom: true }));
    const allEnabledTabs = [...enabledMainTabs, ...enabledCustomPreviewTabs];
    const enabledTabCount = allEnabledTabs.length;

    const effectivePreviewMain = allEnabledTabs.find((t) => t.id === previewActiveMain) ?? allEnabledTabs[0] ?? null;
    const allPreviewSubTabs = effectivePreviewMain?._isCustom ? [] : (effectivePreviewMain?.subTabs ?? []);
    const enabledSubTabs = allPreviewSubTabs.filter(
        (s) => tabConfig[effectivePreviewMain?.id]?.subTabs?.[s.id]?.enabled
    );
    const effectivePreviewSub = allPreviewSubTabs.find((s) => s.id === previewActiveSub) ?? allPreviewSubTabs[0] ?? null;
    const isPreviewSubEnabled = effectivePreviewSub
        ? Boolean(tabConfig[effectivePreviewMain?.id]?.subTabs?.[effectivePreviewSub.id]?.enabled)
        : false;

    const previewGroups = !effectivePreviewSub ? effectivePreviewMain?.groups : null;
    const previewHasFieldDefs = effectivePreviewSub
        ? Array.isArray(effectivePreviewSub.fields)
        : Boolean(effectivePreviewMain?.fields || effectivePreviewMain?.groups);
    const previewFieldDefsList = effectivePreviewSub
        ? (effectivePreviewSub.fields ?? [])
        : (effectivePreviewMain ? getTabFieldList(effectivePreviewMain) : []);
    const previewScopeConfig = effectivePreviewSub
        ? tabConfig[effectivePreviewMain.id]?.subTabs?.[effectivePreviewSub.id]
        : tabConfig[effectivePreviewMain?.id ?? ""];
    const previewFieldsList = previewHasFieldDefs
        ? [
            ...previewFieldDefsList.filter((f) => previewScopeConfig?.fields?.[f]),
            ...(previewScopeConfig?.customFields ?? []).filter((cf) => cf.label).map((cf) => cf.label),
        ]
        : [];

    const isSimplePreviewTab = effectivePreviewMain && !effectivePreviewMain._isCustom
        && !effectivePreviewMain.fields && !effectivePreviewMain.groups && !effectivePreviewMain.subTabs;
    const simpleTabCustomFields = isSimplePreviewTab
        ? (tabConfig[effectivePreviewMain.id]?.customFields ?? []).filter((cf) => cf.label)
        : [];

    const isSimplePreviewSubTab = Boolean(effectivePreviewSub && !Array.isArray(effectivePreviewSub.fields));
    const subTabCustomFields = isSimplePreviewSubTab
        ? (previewScopeConfig?.customFields ?? []).filter((cf) => cf.label)
        : [];

    return (
        <div className="cardform-overlay ct-modal-overlay">
            <div className="cardform-panel">

                {/* Top bar */}
                <div className="cardform-topbar ct-modal-topbar">
                    <div>
                        <span className="ct-topbar-title">CALL TYPE BUILDER</span>
                    </div>
                    <div className="cardform-topbar-right">
                        <button type="button" className="cardform-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Split body */}
                <div className="ct-split-body">

                    {/* ── Left panel ── */}
                    <div className="ct-split-left">

                        {/* Saved templates list */}
                        <div className="ct-saved-section">
                            <div className="ct-saved-header">
                                <div className="ct-saved-header-actions">
                                    <button type="button" className="ct-clear-btn" onClick={handleClearAll}>Clear All</button>
                                </div>
                            </div>
                            <div className="ct-saved-list">
                                {list.map((ct) => (
                                    <div
                                        key={ct.call_type_id}
                                        className={`ct-saved-item ${editingCallType?.call_type_id === ct.call_type_id ? "is-active" : ""}`}
                                        onClick={() => handleSelectCallType(ct)}
                                    >
                                        <div className="ct-saved-dot" />
                                        <span className="ct-saved-name">{ct.call_type_name || "Unnamed"}</span>
                                        <button
                                            type="button"
                                            className="ct-saved-del"
                                            disabled={isLoadingDelete}
                                            onClick={(e) => handleDelete(e, ct)}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form area */}
                        <div className="ct-split-form-area">

                            {/* Call Type + Template Name */}
                            <div className="ct-form-top">
                                <div className="cf-field">
                                    <label>
                                        Call Type <span className="text-danger">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={selectedCallType}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedCallType(val);
                                            setCallTypeError("");
                                            if (val !== "create_template") setTemplateName("");
                                        }}
                                        options={CALL_TYPE_OPTIONS}
                                        placeholder="Select Call Type"
                                        hasError={Boolean(callTypeError)}
                                        menuPortalTarget={document.body}
                                        menuPlacement="auto"
                                    />
                                    {callTypeError && <span className="cf-field-error">{callTypeError}</span>}
                                </div>

                                {isCreateTemplate && (
                                    <div className="cf-field">
                                        <label>Template Name</label>
                                        <div className="cf-input">
                                            <input
                                                type="text"
                                                placeholder="e.g. Bunker Call Template"
                                                value={templateName}
                                                onChange={(e) => setTemplateName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tab configuration */}
                            <div className="ct-tabs-section">
                                <div className="ct-tabs-section-header">
                                    {enabledTabCount > 0 && (
                                        <span className="ct-tabs-count">{enabledTabCount} selected</span>
                                    )}
                                </div>

                                <div className="ct-accordion-group">
                                    {MAIN_TABS.map((tab) => (
                                        <MainTabAccordion
                                            key={tab.id}
                                            tab={tab}
                                            config={tabConfig}
                                            openMainTab={openMainTab}
                                            openSubTab={openSubTab}
                                            onToggleOpenMain={handleToggleOpenMain}
                                            onToggleOpenSub={handleToggleOpenSub}
                                            onToggleMainTab={handleToggleMainTab}
                                            onToggleSubTab={handleToggleSubTab}
                                            onToggleField={handleToggleField}
                                            onSelectAll={handleSelectAll}
                                            onAddCustomField={handleAddCustomField}
                                            onUpdateCustomField={handleUpdateCustomField}
                                            onRemoveCustomField={handleRemoveCustomField}
                                            onRenameReportField={handleRenameReportField}
                                            onDeleteReportField={handleDeleteReportField}
                                        />
                                    ))}
                                </div>

                                {/* Custom tabs */}
                                <div className="ct-custom-tabs-section">
                                    <div className="ct-custom-tabs-divider">
                                        <span>Custom Tabs</span>
                                    </div>
                                    <div className="ct-accordion-group">
                                        {customTabs.map((tab) => (
                                            <CustomTabAccordion
                                                key={tab.id}
                                                tab={tab}
                                                isOpen={openCustomTab === tab.id}
                                                onToggleOpen={handleToggleOpenCustomTab}
                                                onToggle={handleToggleCustomTab}
                                                onRename={handleRenameCustomTab}
                                                onRemove={handleRemoveCustomTab}
                                                onAddField={handleAddCustomTabField}
                                                onUpdateField={handleUpdateCustomTabField}
                                                onRemoveField={handleRemoveCustomTabField}
                                            />
                                        ))}
                                    </div>
                                    <button type="button" className="ct-add-tab-btn" onClick={handleAddCustomTab}>
                                        <FiPlus size={13} /> Add New Tab
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="ct-split-footer">
                            <button type="button" className="btn-common close" onClick={handleNew}>
                                Cancel
                            </button>
                            <button type="button" className="subtasks-tab-save-btn" disabled={isBeingUpdated} onClick={handleSave}>
                                {isBeingUpdated ? "Saving..." : isEditMode ? "Update" : "Save"}
                            </button>
                        </div>
                    </div>

                    {/* ── Right panel: live preview ── */}
                    <div className="ct-split-right">

                        {allEnabledTabs.length > 0 && (
                            // Reuses the real kanban card modal's own classes (cardform-tabs/tab,
                            // operation-wrapper/operation-left/op-tab/operation-right from CardForm.css)
                            // so the preview's fonts and colors are pixel-identical to the live modal.
                            <div className="ct-preview-modal">
                                <div className="cardform-topbar ct-preview-topbar">
                                    <span className="cardform-title">
                                        {isCreateTemplate
                                            ? (templateName || "Untitled Call")
                                            : (CALL_TYPE_OPTIONS.find((o) => o.value === selectedCallType)?.label || "Untitled Call")}
                                    </span>
                                </div>

                                <div className="cardform-tabs">
                                    {allEnabledTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`tab ${effectivePreviewMain?.id === tab.id ? "active" : ""}`}
                                            onClick={() => { setPreviewActiveMain(tab.id); setPreviewActiveSub(null); }}
                                        >
                                            {tab.label || "Unnamed Tab"}
                                        </button>
                                    ))}
                                </div>

                                {effectivePreviewMain && (
                                    <>
                                        <div className="operation-wrapper">
                                            {allPreviewSubTabs.length > 0 && effectivePreviewMain.id !== "husbandry" && (
                                                <div className="operation-left">
                                                    {allPreviewSubTabs.map((sub) => {
                                                        const isEnabled = Boolean(tabConfig[effectivePreviewMain?.id]?.subTabs?.[sub.id]?.enabled);
                                                        return (
                                                            <button
                                                                key={sub.id}
                                                                type="button"
                                                                className={`op-tab ${effectivePreviewSub?.id === sub.id ? "active" : ""} ${!isEnabled ? "ct-preview-op-tab-off" : ""}`}
                                                                onClick={() => setPreviewActiveSub(sub.id)}
                                                            >
                                                                {sub.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="operation-right">
                                                {effectivePreviewMain._isCustom ? (
                                                    <div className="ct-preview-custom-tab-wrap">
                                                        <div className="ct-preview-custom-tab-header">
                                                            <span className="ct-preview-custom-tab-title">{effectivePreviewMain.label || "Unnamed Tab"}</span>
                                                            <span className="ct-preview-custom-tab-badge">Custom</span>
                                                        </div>
                                                        {(effectivePreviewMain.fields ?? []).filter((f) => f.label).length === 0 ? (
                                                            <p className="ct-summary-no-fields">No fields yet — add fields in the left panel.</p>
                                                        ) : (
                                                            <div className="ct-preview-custom-fields-grid">
                                                                {effectivePreviewMain.fields.filter((f) => f.label).map((f) => (
                                                                    <CustomFieldPreviewItem key={f.id} field={f} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : effectivePreviewMain.id === "husbandry" ? (
                                                    <div className="husbandry-service-selection" style={{ "--card-color": "#00368c" }}>
                                                        <div className="husbandry-service-selection-content">
                                                            <div className="husbandry-service-hero">
                                                                <p className="husbandry-service-hero-eyebrow">Husbandry Dashboard</p>
                                                                <h2 className="husbandry-service-selection-title">What services do you need?</h2>
                                                                <p className="husbandry-service-hero-subtitle">Select a service to initiate requests, monitor progress and keep vessel support activities in one place.</p>
                                                            </div>
                                                            <div className="husbandry-service-summary-grid">
                                                                {[
                                                                    { label: "Total Services", value: 6 },
                                                                    { label: "Booked Services", value: 0 },
                                                                    { label: "Pending", value: 0 },
                                                                    { label: "Completed", value: 0 },
                                                                ].map((stat) => (
                                                                    <div key={stat.label} className="husbandry-service-summary-card">
                                                                        <span className="husbandry-service-summary-label">{stat.label}</span>
                                                                        <span className="husbandry-service-summary-value">{stat.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="husbandry-service-options">
                                                                {[
                                                                    {
                                                                        id: "crewManagement", label: "Crew Management", summary: "Crew transport, hotel, medical and launch hire support.", badges: ["Sign In: 0", "Sign Off: 0"],
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="16" r="7" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M10 40C10 32.268 16.268 26 24 26C31.732 26 38 32.268 38 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                                                    },
                                                                    {
                                                                        id: "materialManagement", label: "Material Management", summary: "Inbound orders, landing note and dispatch note handling.", badges: ["Inbound: 0", "Dispatch: 0"],
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 16L24 8L40 16V34L24 42L8 34V16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /><path d="M24 8V42M8 16L24 24L40 16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                                                                    },
                                                                    {
                                                                        id: "wasteDisposal", label: "Waste Disposal", summary: "Waste request initiation and disposal progress tracking.",
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 14H34M18 14V12C18 10.8954 18.8954 10 20 10H28C29.1046 10 30 10.8954 30 12V14M20 22V34M28 22V34M16 14L18 38H30L32 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                                    },
                                                                    {
                                                                        id: "launchHire", label: "Launch Hire", summary: "Launch booking, transfer coordination and movement support.",
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 30H38L34 38H14L10 30Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" /><path d="M24 10V30M20 14L24 10L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 30C12 26 16 24 24 24C32 24 36 26 40 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                                                    },
                                                                    {
                                                                        id: "mwpRenewal", label: "MWP Renewal", summary: "Monitor MWP renewal requests and expected completion updates.",
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M28 16L32 12L28 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 32L16 36L20 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M32 12C30 16 28 20 28 24C28 28 30 32 32 36M16 12C18 16 20 20 20 24C20 28 18 32 16 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                                                    },
                                                                    {
                                                                        id: "thirdPartyServices", label: "Third-Party Services", summary: "Raise and monitor external vendor service requests.",
                                                                        icon: <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="18" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M16 18V14C16 11.7909 17.7909 10 20 10H28C30.2091 10 32 11.7909 32 14V18" stroke="currentColor" strokeWidth="2" /><path d="M10 26H38M20 26V32M28 26V32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                                                    },
                                                                ].map((svc) => (
                                                                    <button key={svc.id} type="button" className="husbandry-service-option" style={{ "--card-color": "#00368c" }}>
                                                                        <div className="husbandry-service-option-icon">{svc.icon}</div>
                                                                        <div className="husbandry-service-option-content">
                                                                            <span className="husbandry-service-option-label">{svc.label}</span>
                                                                            <p className="husbandry-service-option-summary">{svc.summary}</p>
                                                                        </div>
                                                                        {svc.badges && (
                                                                            <div className="husbandry-service-option-footer">
                                                                                {svc.badges.map((b) => <span key={b} className="husbandry-service-option-meta">{b}</span>)}
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : effectivePreviewMain.id === "sales_order" ? (
                                                    (() => {
                                                        const SO_CARD_COLOR = "#e2e6ff";
                                                        const SO_COL_CLASS = {
                                                            "Item No": "col-item-no",
                                                            "Item Description": "col-item-desc",
                                                            "Quantity": "col-qty",
                                                            "Unit Price": "col-unit-price",
                                                            "Discount %": "col-discount",
                                                            "Tax Code": "col-tax",
                                                            "Total Amount": "col-total",
                                                            "Type of PO": "col-type-po",
                                                            "Document Picker": "col-documents",
                                                            "Supplier Code": "col-supplier",
                                                        };
                                                        const SO_READONLY_FIELDS = new Set([
                                                            "Customer Code", "Customer Name", "Contact Person", "Contact Email",
                                                            "SRT Number", "Branch", "SO No", "Posting Date",
                                                        ]);
                                                        const SO_REQUIRED_FIELDS = new Set(["PO No", "Project Name"]);
                                                        const SO_DATE_FIELDS = new Set(["Posting Date", "Delivery Date", "Document Date"]);
                                                        const SO_SELECT_FIELDS = { Port: "Select Port...", "BP Currency": "SAR / USD / EURO" };
                                                        const soGroups = effectivePreviewMain.groups ?? [];
                                                        const headerFields = soGroups[0]?.fields ?? [];
                                                        const lineItemFields = soGroups[1]?.fields ?? [];
                                                        const fieldMap = previewScopeConfig?.fields ?? {};
                                                        
                                                        // Always include read-only fields, then append selected optional fields
                                                        const selectedHeaderFields = [
                                                            ...Array.from(SO_READONLY_FIELDS),
                                                            ...headerFields.filter((f) => fieldMap[f])
                                                        ];
                                                        const selectedColumns = lineItemFields.filter((f) => fieldMap[f]);
                                                        const hasAnySelected = selectedHeaderFields.length > 0 || selectedColumns.length > 0;
                                                        const headerRows = [];
                                                        for (let i = 0; i < selectedHeaderFields.length; i += 4) {
                                                            headerRows.push(selectedHeaderFields.slice(i, i + 4));
                                                        }
                                                        const SAMPLE_ROW = {
                                                            "Item No": "OFM0076",
                                                            "Item Description": "Road Transport for Agent",
                                                            "Quantity": "1",
                                                            "Unit Price": "SAR 175.00",
                                                            "Discount %": "0%",
                                                            "Tax Code": "15%",
                                                            "Total Amount": "SAR 201.25",
                                                            "Type of PO": "— Select —",
                                                            "Document Picker": "—",
                                                            "Supplier Code": "—",
                                                        };
                                                        const renderSoHeaderField = (f) => {
                                                            const label = SO_REQUIRED_FIELDS.has(f)
                                                                ? <>{f} <span className="so-required">*</span></>
                                                                : f;
                                                            if (f === "Status") {
                                                                return (
                                                                    <div key={f} className="so-header-field so-header-field-status">
                                                                        <label className="so-header-label">{label}</label>
                                                                        <span className="so-status-badge so-status-open">Open</span>
                                                                    </div>
                                                                );
                                                            }
                                                            if (SO_DATE_FIELDS.has(f)) {
                                                                return (
                                                                    <div key={f} className="so-header-field">
                                                                        <label className="so-header-label">{label}</label>
                                                                        <input
                                                                            type="date"
                                                                            className={`so-header-input${SO_READONLY_FIELDS.has(f) ? " so-header-input-readonly" : ""}`}
                                                                            readOnly={SO_READONLY_FIELDS.has(f)}
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                            if (SO_SELECT_FIELDS[f]) {
                                                                return (
                                                                    <div key={f} className="so-header-field">
                                                                        <label className="so-header-label">{label}</label>
                                                                        <select className="so-header-select">
                                                                            <option>{SO_SELECT_FIELDS[f]}</option>
                                                                        </select>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={f} className="so-header-field">
                                                                    <label className="so-header-label">{label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className={`so-header-input${SO_READONLY_FIELDS.has(f) ? " so-header-input-readonly" : ""}${SO_REQUIRED_FIELDS.has(f) ? " so-input-required" : ""}`}
                                                                        placeholder={`Enter ${f.toLowerCase()}...`}
                                                                        readOnly={SO_READONLY_FIELDS.has(f)}
                                                                    />
                                                                </div>
                                                            );
                                                        };
                                                        const renderSoTableCell = (col) => {
                                                            const val = SAMPLE_ROW[col] ?? "—";
                                                            if (col === "Type of PO") {
                                                                return (
                                                                    <td key={col}>
                                                                        <div className="sales-order-table-cell">
                                                                            <select className="sales-order-type-po-select" defaultValue="">
                                                                                <option>{val}</option>
                                                                            </select>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            }
                                                            if (col === "Document Picker" || col === "Supplier Code") {
                                                                return (
                                                                    <td key={col}>
                                                                        <div className="sales-order-table-cell sales-order-supplier-cell">
                                                                            <span className="sales-order-supplier-code-text is-empty">{val}</span>
                                                                            <button type="button" className="sales-order-supplier-select-btn">Select</button>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            }
                                                            const cellClass = col === "Total Amount"
                                                                ? "sales-order-table-cell sales-order-table-cell-total"
                                                                : "sales-order-table-cell";
                                                            return (
                                                                <td key={col}>
                                                                    <div className={cellClass}>{val}</div>
                                                                </td>
                                                            );
                                                        };
                                                        return (
                                                            <div className="sales-order-content-wrapper" style={{ "--card-color": SO_CARD_COLOR }}>
                                                                <div className="sales-order-list-header">
                                                                    <h3 className="sales-order-list-title">
                                                                        <span className="sales-order-list-title-bar" />
                                                                        SALES ORDER LIST
                                                                    </h3>
                                                                    <button type="button" className="sales-order-add-button">+ Add Item</button>
                                                                </div>
                                                                {!hasAnySelected ? (
                                                                    <p className="ct-summary-no-fields">No specific fields selected — full tab will be included</p>
                                                                ) : (
                                                                    <>
                                                                        {selectedHeaderFields.length > 0 && (
                                                                            <div className="so-header-panel">
                                                                                {headerRows.map((row, idx) => (
                                                                                    <div key={idx} className="so-header-row">
                                                                                        {row.map(renderSoHeaderField)}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {selectedColumns.length > 0 && (
                                                                            <div className="table-wrapper sales-order-table-container">
                                                                                <table
                                                                                    className="table table-striped sales-order-table sales-order-list-table"
                                                                                    style={{ "--card-color": SO_CARD_COLOR }}
                                                                                >
                                                                                    <thead>
                                                                                        <tr>
                                                                                            {selectedColumns.map((col) => (
                                                                                                <th key={col} className={SO_COL_CLASS[col] || undefined}>{col}</th>
                                                                                            ))}
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        <tr>
                                                                                            {selectedColumns.map(renderSoTableCell)}
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })()) : effectivePreviewMain.id === "reports" ? (
                                                        (() => {
                                                            const enabledReports = previewFieldsList;
                                                            const extraReports = (previewScopeConfig?.customFields ?? []).filter((cf) => cf.label);
                                                            const hasAny = enabledReports.length > 0 || extraReports.length > 0;
                                                            return (
                                                                <div className="ct-preview-reports-wrap">
                                                                    <div className="ct-preview-reports-header">
                                                                        <span className="ct-preview-reports-title-bar" />
                                                                        REPORT LIST
                                                                    </div>
                                                                    {!hasAny ? (
                                                                        <p className="ct-summary-no-fields">No report types selected. Enable some on the left.</p>
                                                                    ) : (
                                                                        <div className="ct-preview-reports-list">
                                                                            {[
                                                                                ...enabledReports.map((f) => previewScopeConfig?.fieldOverrides?.[f] ?? f),
                                                                                ...extraReports.map((cf) => cf.label),
                                                                            ].map((label) => (
                                                                                <div key={label} className="ct-preview-report-row">
                                                                                    <div className="ct-preview-report-icon">
                                                                                        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                                                                                            <rect width="32" height="32" rx="6" fill="#DC2626" />
                                                                                            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="600">PDF</text>
                                                                                        </svg>
                                                                                    </div>
                                                                                    <span className="ct-preview-report-name">{label}</span>
                                                                                    <div className="ct-preview-report-actions">
                                                                                        <button type="button" className="ct-preview-report-btn" title="View report">
                                                                                            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                                                                                                <path d="M9 4C5 4 2.27 6.11 1 9C2.27 11.89 5 14 9 14C13 14 15.73 11.89 17 9C15.73 6.11 13 4 9 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                                                <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
                                                                                            </svg>
                                                                                        </button>
                                                                                        <button type="button" className="ct-preview-report-btn" title="Download report">
                                                                                            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                                                                                                <path d="M9 12V3M9 12L6 9M9 12L12 9M3 15H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                                            </svg>
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()
                                                    ) : previewGroups ? (
                                                        // Mirrors the real "General Information" panel (General.jsx) — same
                                                        // cf-section / form-group / cf-field structure, including the
                                                        // document-upload-zone + file-display row for Appointment Email,
                                                        // extraction-mode buttons, and date-time pickers for time fields.
                                                        <div className="general-tab-body general-tab-body--view-mode" style={{ padding: 0, overflow: "visible" }}>
                                                            <div className="general-sections-wrapper" style={{ gap: 0 }}>
                                                                <div className="cf-section general-info-section">
                                                                    <div className="cf-section-header">
                                                                        <div className="cf-section-title">General Information</div>
                                                                    </div>
                                                                    <div className="cf-section-body">
                                                                        <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout">

                                                                            {/* Left column — form fields */}
                                                                            <div className="general-info-left">
                                                                                <div className="general-view-form-scroll">
                                                                                    <div className="pre-arrival-form">

                                                                                        {/* Owner — always present */}
                                                                                        <div className="cf-field">
                                                                                            <label>Owner</label>
                                                                                            <div className="cf-owner-row">
                                                                                                <div className="cf-owner-avatar">M</div>
                                                                                                <div className="cf-owner-select ct-preview-owner-input">Martech</div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {previewFieldsList.length === 0 ? (
                                                                                            <p className="ct-summary-no-fields">No specific fields selected — full tab will be included</p>
                                                                                        ) : (
                                                                                            <>
                                                                                                {previewGroups.map((group) => {
                                                                                                    const checkedInGroup = group.fields.filter((f) => previewScopeConfig?.fields?.[f]);
                                                                                                    if (checkedInGroup.length === 0) return null;
                                                                                                    return (
                                                                                                        <div key={group.label} className="form-group">
                                                                                                            <h3 className="form-group-title">{group.label}</h3>

                                                                                                            {checkedInGroup.map((f) => {

                                                                                                                /* ── Appointment Email — upload zone + file row ── */
                                                                                                                if (f === "Appointment Email") {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            {/* Label row with extraction-mode toggles */}
                                                                                                                            <div className="appointment-email-label-row">
                                                                                                                                <label className="appointment-email-label">Appointment Email</label>
                                                                                                                                <div className="appointment-extraction-mode-group" role="group" aria-label="Extraction mode">
                                                                                                                                    {["Manual", "AI", "Server"].map((mode, i) => (
                                                                                                                                        <span
                                                                                                                                            key={mode}
                                                                                                                                            className={`appointment-extraction-mode-btn${i === 0 ? " active" : ""}`}
                                                                                                                                            style={{ cursor: "default" }}
                                                                                                                                        >
                                                                                                                                            {mode}
                                                                                                                                        </span>
                                                                                                                                    ))}
                                                                                                                                </div>
                                                                                                                            </div>

                                                                                                                            {/* Upload zone — same document-upload-zone class from general.scss */}
                                                                                                                            <div className="document-upload-wrapper">
                                                                                                                                <div
                                                                                                                                    className="document-upload-zone"
                                                                                                                                    style={{ pointerEvents: "none", opacity: 0.85 }}
                                                                                                                                    aria-label="Drag and drop or click to upload"
                                                                                                                                >
                                                                                                                                    <div className="upload-zone-content">
                                                                                                                                        <div className="upload-text-content">
                                                                                                                                            <p className="upload-main-text">
                                                                                                                                                Drag and drop your file here, or{" "}
                                                                                                                                                <span className="upload-link">click to browse</span>
                                                                                                                                            </p>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>

                                                                                                                                {/* Existing file display row — same appointment-email-file-row classes */}
                                                                                                                                <div className="document-file-display-list" style={{ marginTop: 8 }}>
                                                                                                                                    <div className="appointment-email-file-row document-file-display-item">
                                                                                                                                        <div className="appointment-email-file-left">
                                                                                                                                            <div className="document-file-icon" style={{ color: "#3e5cb6" }}>
                                                                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                                                                                                                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                                                                                                    <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                                                                                                </svg>
                                                                                                                                            </div>
                                                                                                                                            <span className="appointment-email-file-name document-file-name">
                                                                                                                                                2_IMP_-_Horizon_Client_Appointment_Email.pdf
                                                                                                                                            </span>
                                                                                                                                        </div>
                                                                                                                                        {/* View action button */}
                                                                                                                                        <div className="appointment-email-file-actions">
                                                                                                                                            <button
                                                                                                                                                type="button"
                                                                                                                                                className="appointment-email-file-action-btn"
                                                                                                                                                title="View appointment email"
                                                                                                                                                style={{ pointerEvents: "none" }}
                                                                                                                                                aria-label="View appointment email"
                                                                                                                                            >
                                                                                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                                                                                                    <circle cx="12" cy="12" r="3" />
                                                                                                                                                </svg>
                                                                                                                                            </button>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── Appointment Received — date+time picker ── */
                                                                                                                if (f === "Appointment Received") {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            <label>Appointment Received *</label>
                                                                                                                            <div className="cf-input ct-preview-dt-input">
                                                                                                                                <input type="text" placeholder="2026-06-11  10:00" />
                                                                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                                                                                                                </svg>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── Time Objects ── */
                                                                                                                if (f === "Time Objects") {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            <label>Expected Time of Arrival</label>
                                                                                                                            <div className="cf-input ct-preview-dt-input">
                                                                                                                                <input type="text" placeholder="YYYY-MM-DD  hh:mm" />
                                                                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                                                                                                                </svg>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── General datetime fields ── */
                                                                                                                if (PREVIEW_DATETIME_FIELDS.has(f)) {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            <label>{f}</label>
                                                                                                                            <div className="cf-input ct-preview-dt-input">
                                                                                                                                <input type="text" placeholder="YYYY-MM-DD  hh:mm" />
                                                                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                                                                                                                </svg>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── Searchable selects ── */
                                                                                                                if (["Main Billing Entity", "Appointment Type", "Vessel Type", "Vessel Name", "Barge Type", "Assigned Operator"].includes(f)) {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            <label>{f}</label>
                                                                                                                            <div className="cf-input ct-preview-select-input">
                                                                                                                                <input type="text" placeholder={`Select ${f.toLowerCase()}...`} />
                                                                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                                                    <polyline points="6 9 12 15 18 9" />
                                                                                                                                </svg>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── Multi-select email tags ── */
                                                                                                                if (["Daily Report Emails", "Billing Instructions"].includes(f)) {
                                                                                                                    return (
                                                                                                                        <div key={f} className="cf-field">
                                                                                                                            <label>{f}</label>
                                                                                                                            <div className="cf-multi-select-email-input disabled">
                                                                                                                                <div className="cf-multi-select-email-tags">
                                                                                                                                    <span className="cf-email-tag">
                                                                                                                                        ops@example.com
                                                                                                                                        <span className="cf-email-tag-remove" style={{ pointerEvents: "none" }}>×</span>
                                                                                                                                    </span>
                                                                                                                                    <span className="cf-email-tag">
                                                                                                                                        mgr@example.com
                                                                                                                                        <span className="cf-email-tag-remove" style={{ pointerEvents: "none" }}>×</span>
                                                                                                                                    </span>
                                                                                                                                </div>
                                                                                                                                <span className="cf-multi-select-arrow">▼</span>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }

                                                                                                                /* ── Default text input ── */
                                                                                                                return (
                                                                                                                    <div key={f} className="cf-field">
                                                                                                                        <label>{f}</label>
                                                                                                                        <div className="cf-input">
                                                                                                                            <input type="text" placeholder={f} />
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            })}
                                                                                                        </div>
                                                                                                    );
                                                                                                })}

                                                                                                {/* Custom fields */}
                                                                                                {(previewScopeConfig?.customFields ?? []).some((cf) => cf.label) && (
                                                                                                    <div className="form-group">
                                                                                                        <h3 className="form-group-title">Custom Fields</h3>
                                                                                                        {previewScopeConfig.customFields.filter((cf) => cf.label).map((cf) => (
                                                                                                            <div key={cf.id} className="cf-field">
                                                                                                                <label>{cf.label}</label>
                                                                                                                <div className="cf-input">
                                                                                                                    <input type="text" placeholder={cf.label} />
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                )}
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Middle column — Daily Tasks */}
                                                                            <div className="general-info-middle">
                                                                                <div className="general-info-tasks-card general-info-tasks-card--daily">
                                                                                    <div className="daily-task-box-wrapper">
                                                                                        <DailyTaskTodo tasks={PREVIEW_DAILY_TASKS} accentColor="#2e7d32" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Right column — Operation Tasks */}
                                                                            <div className="general-info-right">
                                                                                <div className="general-info-tasks-card general-info-tasks-card--operation">
                                                                                    <OperationTasksPanel embedded taskSections={PREVIEW_OPERATION_TASK_SECTIONS} />
                                                                                </div>
                                                                            </div>

                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : effectivePreviewSub ? (
                                                        <>
                                                            <div className="operation-content-header">
                                                                <h3 className="operation-content-title">
                                                                    {effectivePreviewMain?.id === "husbandry"
                                                                        ? effectivePreviewSub.label
                                                                        : (OPERATION_SUBTAB_TITLES[effectivePreviewSub.id] || effectivePreviewSub.label)}
                                                                </h3>
                                                            </div>
                                                            {!isPreviewSubEnabled ? (
                                                                <div className="ct-preview-sub-off-msg">
                                                                    This {effectivePreviewMain?.id === "husbandry" ? "service" : "sub-tab"} is not enabled. Tick it in the left panel to include it.
                                                                </div>
                                                            ) : effectivePreviewMain?.id === "husbandry" ? (
                                                                <div className="operation-content-box">
                                                                    <p className="ct-summary-no-fields">This service will be available in the Husbandry tab.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="operation-tab-layout">
                                                                    <div className="operation-two-column-grid">
                                                                        <div className="operation-form-column">
                                                                            {previewFieldsList.length > 0 ? previewFieldsList.map((f) => {
                                                                                if (PREVIEW_DATETIME_FIELDS.has(f)) {
                                                                                    return (
                                                                                        <div key={f} className="cf-field">
                                                                                            <label>{f}</label>
                                                                                            <div className="cf-input ct-preview-dt-input">
                                                                                                <input type="text" placeholder="YYYY-MM-DD hh:mm" />
                                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                                                                                </svg>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (PREVIEW_SELECT_FIELDS.has(f)) {
                                                                                    return (
                                                                                        <div key={f} className="cf-field">
                                                                                            <label>{f}</label>
                                                                                            <div className="cf-input ct-preview-select-input">
                                                                                                <input type="text" placeholder={`Select ${f.toLowerCase()}...`} />
                                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                                    <polyline points="6 9 12 15 18 9" />
                                                                                                </svg>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (PREVIEW_FILE_FIELDS.has(f)) {
                                                                                    return (
                                                                                        <div key={f} className="cf-field">
                                                                                            <label>{f}</label>
                                                                                            <div className="ct-preview-file-zone">Upload document</div>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <div key={f} className="cf-field">
                                                                                        <label>{f}</label>
                                                                                        <div className="cf-input">
                                                                                            <input type="text" placeholder={f} />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }) : subTabCustomFields.length > 0 ? (
                                                                                <div className="ct-preview-custom-fields-grid">
                                                                                    {subTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="ct-summary-no-fields">No specific fields selected.</p>
                                                                            )}
                                                                        </div>

                                                                        <div className="operation-email-preview-panel">
                                                                            <div className="operation-email-preview-header">
                                                                                <h4>Email Preview</h4>
                                                                                <div className="operation-email-preview-header-tools">
                                                                                    <button type="button" className="operation-email-send-btn" title="Save and send report" aria-label="Save and send report">
                                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                                                        </svg>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="operation-email-preview-body">
                                                                                {[
                                                                                    { label: "From", placeholder: "operations@shipping.com" },
                                                                                    { label: "To", placeholder: "Recipient emails" },
                                                                                    { label: "Cc", placeholder: "CC emails" },
                                                                                    { label: "Subject", placeholder: OPERATION_SUBTAB_EMAIL_SUBJECTS[effectivePreviewSub.id] || "Report" },
                                                                                ].map(({ label, placeholder }) => (
                                                                                    <div key={label} className="cf-field">
                                                                                        <label>{label}</label>
                                                                                        <div className="cf-input"><input type="text" placeholder={placeholder} /></div>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="cf-field operation-email-preview-attachments-field">
                                                                                    <label>Attachments</label>
                                                                                    <div className="email-preview-attachments-list">
                                                                                        {[
                                                                                            { id: "a1", name: "Appointment_Acceptance.pdf", size: "245K" },
                                                                                            { id: "a2", name: "Port_Details.xlsx", size: "128K" },
                                                                                            { id: "a3", name: "Vessel_Image.jpg", size: "932K" },
                                                                                        ].map((a) => (
                                                                                            <div key={a.id} className="email-preview-attachment-chip">
                                                                                                <button type="button" className="email-preview-attachment-link">
                                                                                                    <span className="email-preview-attachment-name">{a.name}</span>
                                                                                                    <span className="email-preview-attachment-size"> ({a.size})</span>
                                                                                                </button>
                                                                                                <button type="button" className="email-preview-attachment-remove" aria-label="Remove">×</button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="cf-field operation-email-preview-message-field">
                                                                                    <label>Message</label>
                                                                                    <div className="ct-preview-message-area">
                                                                                        <div className="ct-preview-msg-toolbar">
                                                                                            {["Normal ▾", "B", "I", "U", "S", "≡", "☰", "A", "Tx"].map((t) => (
                                                                                                <span key={t} className="ct-preview-msg-tool">{t}</span>
                                                                                            ))}
                                                                                        </div>
                                                                                        <p className="ct-preview-msg-body">
                                                                                            {OPERATION_SUBTAB_EMAIL_SUBJECTS[effectivePreviewSub.id] || "Report"} report
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : effectivePreviewMain.id === "document_library" ? (
                                                        <>
                                                            <DocumentLibrary card={{ color: "#2A00FF" }} />
                                                            {simpleTabCustomFields.length > 0 && (
                                                                <div className="ct-preview-simple-custom-fields">
                                                                    <p className="ct-preview-custom-fields-label">Custom Fields</p>
                                                                    <div className="ct-preview-custom-fields-grid">
                                                                        {simpleTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : effectivePreviewMain.id === "comments" ? (
                                                        <>
                                                            <Comments card={{ comments: [] }} />
                                                            {simpleTabCustomFields.length > 0 && (
                                                                <div className="ct-preview-simple-custom-fields">
                                                                    <p className="ct-preview-custom-fields-label">Custom Fields</p>
                                                                    <div className="ct-preview-custom-fields-grid">
                                                                        {simpleTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : effectivePreviewMain.id === "kpi" ? (
                                                        <>
                                                            <KPIAnalytics
                                                                kpiData={PREVIEW_KPI_DATA}
                                                                tasks={PREVIEW_KPI_TASKS}
                                                                cardColor="#2A00FF"
                                                            />
                                                            {simpleTabCustomFields.length > 0 && (
                                                                <div className="ct-preview-simple-custom-fields">
                                                                    <p className="ct-preview-custom-fields-label">Custom Fields</p>
                                                                    <div className="ct-preview-custom-fields-grid">
                                                                        {simpleTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : effectivePreviewMain.id === "subtasks" ? (
                                                        <>
                                                            <Subtasks card={{}} />
                                                            {simpleTabCustomFields.length > 0 && (
                                                                <div className="ct-preview-simple-custom-fields">
                                                                    <p className="ct-preview-custom-fields-label">Custom Fields</p>
                                                                    <div className="ct-preview-custom-fields-grid">
                                                                        {simpleTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : effectivePreviewMain.id === "notes" ? (
                                                        <>
                                                            <Notes card={{ notes: [] }} />
                                                            {simpleTabCustomFields.length > 0 && (
                                                                <div className="ct-preview-simple-custom-fields">
                                                                    <p className="ct-preview-custom-fields-label">Custom Fields</p>
                                                                    <div className="ct-preview-custom-fields-grid">
                                                                        {simpleTabCustomFields.map((cf) => <CustomFieldPreviewItem key={cf.id} field={cf} />)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                    <div className="operation-content-box">
                                                        <p className="ct-summary-no-fields">This tab is included as-is</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ct-preview-stepper">
                                            {["Appointment Received", "Enroute", "Ops in Progress", "Ops Completed", "Done", "Ready to Archive"].map((step, i) => (
                                                <div key={step} className={`ct-preview-step${i === 0 ? " ct-preview-step--done" : ""}`}>
                                                    <div className="ct-preview-step-circle">{i + 1}</div>
                                                    <span className="ct-preview-step-label">{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default CallTypeBuilderModal;
