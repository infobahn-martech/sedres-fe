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
import "../../design/css/common/CardForm.css";
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
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
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
                    "Customer Code", "Customer Name", "Contact Person", "Contact Email",
                    "PO No", "SRT Number", "Project Name", "Port",
                    "Branch", "SO No", "Posting Date", "Delivery Date",
                    "Document Date", "Ship Name", "BP Currency",
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
                            : { enabled: false },
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
            config[tab.id] = { enabled: false };
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
    return (
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
    const anyChecked = hasFields && (sub.fields.some((f) => fieldMap[f]) || customFields.length > 0);

    const handleLabelClick = (e) => {
        e.stopPropagation();
        if (!hasFields) return;
        if (!isOpen) onToggleOpen(sub.id);
        onSelectAll(mainId, sub.id, sub.fields, !allChecked);
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
                {hasFields ? (
                    <button type="button" className="ct-accordion-trigger" onClick={() => onToggleOpen(sub.id)}>
                        <span className="ct-accordion-label" onClick={handleLabelClick}>{sub.label}</span>
                        {anyChecked && <span className="ct-accordion-badge">{sub.fields.filter((f) => fieldMap[f]).length + customFields.length}</span>}
                        {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="ct-accordion-label ct-subtab-label-static">{sub.label}</span>
                )}
            </div>

            {hasFields && isOpen && (
                <div className="ct-accordion-body">
                    <FieldsBlock
                        fields={sub.fields}
                        fieldMap={fieldMap}
                        customFields={customFields}
                        onToggleField={(field, checked) => onToggleField(mainId, sub.id, field, checked)}
                        onAddCustomField={() => onAddCustomField(mainId, sub.id)}
                        onUpdateCustomField={(id, key, val) => onUpdateCustomField(mainId, sub.id, id, key, val)}
                        onRemoveCustomField={(id) => onRemoveCustomField(mainId, sub.id, id)}
                    />
                </div>
            )}
        </div>
    );
}

function MainTabAccordion({ tab, config, openMainTab, openSubTab, onToggleOpenMain, onToggleOpenSub, onToggleMainTab, onToggleSubTab, onToggleField, onSelectAll, onAddCustomField, onUpdateCustomField, onRemoveCustomField, onRenameReportField, onDeleteReportField }) {
    const mainConfig = config[tab.id] ?? {};
    const isEnabled = mainConfig.enabled ?? false;
    const isExpandable = Boolean(tab.fields || tab.groups || tab.subTabs);

    if (!isExpandable) {
        return (
            <label className="ct-simple-tab-row">
                <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => onToggleMainTab(tab.id, e.target.checked)}
                />
                <span className="ct-simple-tab-label">{tab.label}</span>
            </label>
        );
    }

    const isOpen = openMainTab === tab.id;
    const hasDirectFields = Boolean(tab.fields || tab.groups);
    const allFieldsList = getTabFieldList(tab);
    const fieldMap = mainConfig.fields ?? {};
    const customFields = mainConfig.customFields ?? [];
    const allChecked = hasDirectFields && allFieldsList.every((f) => fieldMap[f]);
    const enabledSubCount = tab.subTabs?.filter((s) => mainConfig.subTabs?.[s.id]?.enabled).length ?? 0;
    const anyChecked = hasDirectFields
        ? allFieldsList.some((f) => fieldMap[f]) || customFields.length > 0
        : enabledSubCount > 0;

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
                    {hasDirectFields && anyChecked && (
                        <span className="ct-accordion-badge">{allFieldsList.filter((f) => fieldMap[f]).length + customFields.length}</span>
                    )}
                    {!hasDirectFields && enabledSubCount > 0 && (
                        <span className="ct-accordion-badge">{enabledSubCount} sub-tab{enabledSubCount > 1 ? "s" : ""}</span>
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
        setCallTypeError("");
    }, []);

    const handleClearAll = useCallback(() => {
        setTabConfig(buildInitialTabConfig());
        setOpenMainTab(null);
        setOpenSubTab(null);
    }, []);

    const handleSelectCallType = (ct) => {
        setEditingCallType(ct);
        setTemplateName(ct.call_type_name ?? "");
        setSelectedCallType(ct.selected_call_type ?? "");
        const restored = buildInitialTabConfig();
        if (ct.tab_config && typeof ct.tab_config === "object") {
            for (const tab of MAIN_TABS) {
                const saved = ct.tab_config[tab.id];
                if (!saved) continue;
                if (tab.subTabs) {
                    restored[tab.id].enabled = saved.enabled ?? false;
                    for (const sub of tab.subTabs) {
                        const savedSub = saved.subTabs?.[sub.id];
                        if (savedSub) {
                            restored[tab.id].subTabs[sub.id] = { ...restored[tab.id].subTabs[sub.id], ...savedSub };
                        }
                    }
                } else {
                    restored[tab.id] = { ...restored[tab.id], ...saved };
                }
            }
        }
        setTabConfig(restored);
        setOpenMainTab(null);
        setOpenSubTab(null);
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
            customFields: [...(scope.customFields ?? []), { id: Date.now() + Math.random(), label: "", type: "text" }],
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
        const payload = {
            call_type_name: isCreateTemplate ? templateName.trim() : callTypeLabel,
            selected_call_type: selectedCallType,
            tab_config: tabConfig,
        };
        if (editingCallType?.call_type_id) {
            await updateCallType({
                formData: { call_type_id: editingCallType.call_type_id, ...payload },
                cb: () => getCallTypes({}),
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
    const enabledTabCount = enabledMainTabs.length;

    const effectivePreviewMain = enabledMainTabs.find((t) => t.id === previewActiveMain) ?? enabledMainTabs[0] ?? null;
    const allPreviewSubTabs = effectivePreviewMain?.subTabs ?? [];
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

                        {enabledMainTabs.length > 0 && (
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
                                    {enabledMainTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`tab ${effectivePreviewMain?.id === tab.id ? "active" : ""}`}
                                            onClick={() => { setPreviewActiveMain(tab.id); setPreviewActiveSub(null); }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {effectivePreviewMain && (
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
                                            {effectivePreviewMain.id === "husbandry" ? (
                                                <div className="ct-preview-husb-wrap">
                                                    <div className="ct-preview-husb-hero">
                                                        <p className="ct-preview-husb-eyebrow">Husbandry Dashboard</p>
                                                        <h2 className="ct-preview-husb-title">What services do you need?</h2>
                                                        <p className="ct-preview-husb-subtitle">Select a service to initiate requests, monitor progress and keep vessel support activities in one place.</p>
                                                    </div>
                                                    <div className="ct-preview-husb-stats">
                                                        {(() => {
                                                            const bookedCount = Object.values(tabConfig.husbandry?.subTabs ?? {}).filter((s) => s.enabled).length;
                                                            return [
                                                                { label: "Total Services", value: 8, helper: "Available now" },
                                                                { label: "Booked Services", value: bookedCount, helper: "Added to workflow" },
                                                                { label: "Pending", value: bookedCount, helper: "Awaiting action" },
                                                                { label: "Completed", value: 0, helper: "Successfully closed" },
                                                            ].map((stat) => (
                                                                <div key={stat.label} className="ct-preview-husb-stat">
                                                                    <span className="ct-preview-husb-stat-label">{stat.label}</span>
                                                                    <span className="ct-preview-husb-stat-value">{stat.value}</span>
                                                                    <span className="ct-preview-husb-stat-helper">{stat.helper}</span>
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <div className="ct-preview-husb-grid">
                                                        {[
                                                            { id: "crewManagement", label: "Crew Management", summary: "Crew transport, hotel, medical and launch hire support." },
                                                            { id: "warehouse", label: "Warehouse", summary: "Warehouse storage and inventory handling." },
                                                            { id: "onOffHireSurvey", label: "On/Off-Hire Survey", summary: "Survey scheduling and report documentation." },
                                                            { id: "onStation", label: "On Station", summary: "On-station monitoring and coordination." },
                                                            { id: "materialManagement", label: "Material Management", summary: "Inbound orders, landing note and dispatch note handling." },
                                                            { id: "wasteDisposal", label: "Waste Disposal", summary: "Waste request initiation and disposal progress tracking." },
                                                            { id: "mwpRenewal", label: "MWP Renewal", summary: "Monitor MWP renewal requests and expected completion updates." },
                                                            { id: "thirdPartyServices", label: "Third-Party Services", summary: "Raise and monitor external vendor service requests." },
                                                        ].map((svc) => {
                                                            const isEnabled = Boolean(tabConfig.husbandry?.subTabs?.[svc.id]?.enabled);
                                                            return (
                                                                <div key={svc.id} className={`ct-preview-husb-card${isEnabled ? " ct-preview-husb-card--on" : ""}`}>
                                                                    <span className="ct-preview-husb-label">{svc.label}</span>
                                                                    <p className="ct-preview-husb-summary">{svc.summary}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : effectivePreviewMain.id === "sales_order" ? (
                                                (() => {
                                                    const soGroups = effectivePreviewMain.groups ?? [];
                                                    const headerFields = soGroups[0]?.fields ?? [];
                                                    const lineItemFields = soGroups[1]?.fields ?? [];
                                                    const fieldMap = previewScopeConfig?.fields ?? {};
                                                    const selectedHeaderFields = headerFields.filter((f) => fieldMap[f]);
                                                    const selectedColumns = lineItemFields.filter((f) => fieldMap[f]);
                                                    const hasAnySelected = selectedHeaderFields.length > 0 || selectedColumns.length > 0;
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
                                                    return (
                                                        <div className="ct-preview-so">
                                                            <div className="ct-preview-so-topbar">
                                                                <div className="ct-preview-so-title">
                                                                    <span className="ct-preview-so-title-accent" />
                                                                    SALES ORDER LIST
                                                                </div>
                                                                <button type="button" className="ct-preview-so-add-btn">+ Add Item</button>
                                                            </div>
                                                            {!hasAnySelected ? (
                                                                <p className="ct-summary-no-fields">No specific fields selected — full tab will be included</p>
                                                            ) : (
                                                                <>
                                                                    {selectedHeaderFields.length > 0 && (
                                                                        <div className="ct-preview-so-fields-panel">
                                                                            {selectedHeaderFields.map((f) => {
                                                                                const DATE_FIELDS = new Set(["Posting Date", "Delivery Date", "Document Date"]);
                                                                                const SELECT_FIELDS = { "Port": "Select Port...", "BP Currency": "SAR / USD / EURO" };
                                                                                if (f === "Status") {
                                                                                    return (
                                                                                        <div key={f} className="ct-preview-so-field">
                                                                                            <label className="ct-preview-so-field-label">{f}</label>
                                                                                            <div className="ct-preview-so-field-status"><span className="ct-preview-so-status-badge">Open</span></div>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (DATE_FIELDS.has(f)) {
                                                                                    return (
                                                                                        <div key={f} className="ct-preview-so-field">
                                                                                            <label className="ct-preview-so-field-label">{f}</label>
                                                                                            <input type="date" className="ct-preview-so-input" />
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (SELECT_FIELDS[f]) {
                                                                                    return (
                                                                                        <div key={f} className="ct-preview-so-field">
                                                                                            <label className="ct-preview-so-field-label">{f}</label>
                                                                                            <select className="ct-preview-so-input">
                                                                                                <option>{SELECT_FIELDS[f]}</option>
                                                                                            </select>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <div key={f} className="ct-preview-so-field">
                                                                                        <label className="ct-preview-so-field-label">{f}</label>
                                                                                        <input type="text" className="ct-preview-so-input" placeholder={`Enter ${f.toLowerCase()}...`} />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {selectedColumns.length > 0 && (
                                                                        <div className="ct-preview-so-table-wrap">
                                                                            <table className="ct-preview-so-table">
                                                                                <thead>
                                                                                    <tr>
                                                                                        {selectedColumns.map((col) => <th key={col}>{col}</th>)}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    <tr>
                                                                                        {selectedColumns.map((col) => (
                                                                                            <td key={col}>{SAMPLE_ROW[col] ?? "—"}</td>
                                                                                        ))}
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            ) : effectivePreviewMain.id === "reports" ? (
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
                                                                                        <path d="M9 4C5 4 2.27 6.11 1 9C2.27 11.89 5 14 9 14C13 14 15.73 11.89 17 9C15.73 6.11 13 4 9 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                                        <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5"/>
                                                                                    </svg>
                                                                                </button>
                                                                                <button type="button" className="ct-preview-report-btn" title="Download report">
                                                                                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                                                                                        <path d="M9 12V3M9 12L6 9M9 12L12 9M3 15H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                                                // cf-section/form-group/cf-field classes for the configurable fields,
                                                // plus the real DailyTaskTodo/OperationTasksPanel components (with
                                                // static sample data) for the Daily Tasks and Operation Tasks rails,
                                                // since those two always appear regardless of the builder's toggles.
                                                <div className="ct-preview-general-columns">
                                                    <div className="cf-section">
                                                        <div className="cf-section-header">
                                                            <span className="cf-section-title">General Information</span>
                                                        </div>
                                                        <div className="cf-section-body">
                                                            <div className="cf-field">
                                                                <label>Owner</label>
                                                                <div className="cf-owner-row">
                                                                    <span className="cf-owner-avatar">CO</span>
                                                                    <div className="cf-input">
                                                                        <input type="text" placeholder="Select owner" />
                                                                    </div>
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
                                                                                {checkedInGroup.map((f) => (
                                                                                    <div key={f} className="cf-field">
                                                                                        <label>{f}</label>
                                                                                        <div className="cf-input">
                                                                                            <input type="text" placeholder={f} />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })}
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

                                                    <div className="general-info-tasks-card general-info-tasks-card--daily">
                                                        <div className="daily-task-box-wrapper">
                                                            <DailyTaskTodo tasks={PREVIEW_DAILY_TASKS} accentColor="#2e7d32" />
                                                        </div>
                                                    </div>

                                                    <div className="general-info-tasks-card general-info-tasks-card--operation">
                                                        <OperationTasksPanel embedded taskSections={PREVIEW_OPERATION_TASK_SECTIONS} />
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
                                                        <div className="ct-preview-op-grid">
                                                            <div className="operation-form-column">
                                                                {previewFieldsList.length > 0 ? previewFieldsList.map((f) => {
                                                                    if (PREVIEW_DATETIME_FIELDS.has(f)) {
                                                                        return (
                                                                            <div key={f} className="cf-field">
                                                                                <label>{f}</label>
                                                                                <div className="cf-input ct-preview-dt-input">
                                                                                    <input type="text" placeholder="YYYY-MM-DD hh:mm" />
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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
                                                                                        <polyline points="6 9 12 15 18 9"/>
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
                                                                }) : (
                                                                    <p className="ct-summary-no-fields">No specific fields selected.</p>
                                                                )}
                                                            </div>

                                                            <div className="operation-email-column">
                                                                <p className="ct-preview-email-title">Email Preview</p>
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
                                                                <div className="cf-field">
                                                                    <label>Attachments</label>
                                                                    <div className="ct-preview-attachments">
                                                                        {["Appointment_Acceptance.pdf(245K)", "Port_Details.xlsx(128K)", "Vessel_Image.jpg(932K)"].map((name) => (
                                                                            <span key={name} className="ct-preview-attachment-chip">{name} ×</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="cf-field">
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
                                                    )}
                                                </>
                                            ) : effectivePreviewMain.id === "document_library" ? (
                                                <DocumentLibrary card={{ color: "#2A00FF" }} />
                                            ) : effectivePreviewMain.id === "comments" ? (
                                                <Comments card={{ comments: [] }} />
                                            ) : effectivePreviewMain.id === "kpi" ? (
                                                <KPIAnalytics
                                                    kpiData={PREVIEW_KPI_DATA}
                                                    tasks={PREVIEW_KPI_TASKS}
                                                    cardColor="#2A00FF"
                                                />
                                            ) : effectivePreviewMain.id === "subtasks" ? (
                                                <Subtasks card={{}} />
                                            ) : effectivePreviewMain.id === "notes" ? (
                                                <Notes card={{ notes: [] }} />
                                            ) : (
                                                <div className="operation-content-box">
                                                    <p className="ct-summary-no-fields">This tab is included as-is</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
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
