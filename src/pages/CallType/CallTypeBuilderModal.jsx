import { useEffect, useState, useCallback } from "react";
import { FiX, FiChevronDown, FiChevronRight, FiPlus, FiTrash2 } from "react-icons/fi";
import useCallTypeReducer from "../../store/CallTypeReducer";
import "../../design/css/common/CardForm.css";
import "../../design/scss/pages/callTypeBuilder.scss";

const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
];

const CALL_TYPE_OPTIONS = [
    { value: "", label: "Select Call Type" },
    { value: "import_call", label: "Import Call" },
    { value: "export_call", label: "Export Call" },
    { value: "husbandry_call", label: "Husbandry Call" },
    { value: "husbandry_monthly_call", label: "Husbandry Monthly Call" },
];

// Operation tabs — have individual field checkboxes
const OPERATION_TABS = [
    {
        id: "appointment_acceptance",
        label: "Appointment Acceptance",
        fields: [
            "Time Objects",
            "Appointment Email",
            "Billing Entity",
            "Tug",
            "Barge & Tug",
            "Daily Report Emails",
        ],
    },
    {
        id: "pre_arrival",
        label: "Pre-arrival",
        fields: [
            "Time Objects",
            "Sale Order",
            "Coordinates",
        ],
    },
    {
        id: "arrival",
        label: "Arrival",
        fields: [
            "Time Objects",
            "Arrival Notice",
            "Port Clearance",
            "Berth Confirmation",
        ],
    },
    {
        id: "departure",
        label: "Departure",
        fields: [
            "Time Objects",
            "Departure Notice",
            "Customs Clearance",
            "Final Documents",
        ],
    },
];

// Simple tabs — include/exclude only, no field breakdown
const SIMPLE_TABS = [
    { id: "checklist", label: "Checklist" },
    { id: "document_library", label: "Document Library" },
    { id: "subtasks", label: "Subtasks" },
    { id: "notes", label: "Notes" },
    { id: "comments", label: "Comments" },
];

const buildInitialTabConfig = () => {
    const config = {};
    for (const tab of OPERATION_TABS) {
        config[tab.id] = {
            enabled: false,
            fields: Object.fromEntries(tab.fields.map((f) => [f, false])),
            customFields: [],
        };
    }
    for (const tab of SIMPLE_TABS) {
        config[tab.id] = { enabled: false };
    }
    return config;
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

function OperationTabAccordion({ tab, config, openTab, onToggleOpen, onToggleTab, onToggleField, onSelectAll, onAddCustomField, onUpdateCustomField, onRemoveCustomField }) {
    const isOpen = openTab === tab.id;
    const isEnabled = config[tab.id]?.enabled ?? false;
    const fieldMap = config[tab.id]?.fields ?? {};
    const customFields = config[tab.id]?.customFields ?? [];
    const allChecked = tab.fields.every((f) => fieldMap[f]);
    const anyChecked = tab.fields.some((f) => fieldMap[f]) || customFields.length > 0;

    const handleLabelClick = (e) => {
        e.stopPropagation();
        if (!isOpen) onToggleOpen(tab.id);
        onSelectAll(tab.id, !allChecked);
    };

    return (
        <div className={`ct-accordion-item ${isEnabled ? "ct-accordion-item--enabled" : ""}`}>
            <div className="ct-accordion-header">
                <label className="ct-tab-toggle">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => onToggleTab(tab.id, e.target.checked)}
                    />
                </label>
                <button
                    type="button"
                    className="ct-accordion-trigger"
                    onClick={() => onToggleOpen(tab.id)}
                >
                    <span className="ct-accordion-label" onClick={handleLabelClick}>{tab.label}</span>
                    {anyChecked && <span className="ct-accordion-badge">{tab.fields.filter((f) => fieldMap[f]).length + customFields.length}</span>}
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </button>
            </div>

            {isOpen && (
                <div className="ct-accordion-body">
                    <div className="ct-field-list">
                        {tab.fields.map((field) => (
                            <label key={field} className="ct-field-check-label">
                                <input
                                    type="checkbox"
                                    checked={fieldMap[field] ?? false}
                                    onChange={(e) => onToggleField(tab.id, field, e.target.checked)}
                                />
                                <span>{field}</span>
                            </label>
                        ))}
                    </div>

                    {customFields.length > 0 && (
                        <div className="ct-custom-fields-list">
                            <p className="ct-custom-fields-heading">Custom Fields</p>
                            {customFields.map((cf) => (
                                <CustomFieldRow
                                    key={cf.id}
                                    field={cf}
                                    onUpdate={(id, key, val) => onUpdateCustomField(tab.id, id, key, val)}
                                    onRemove={(id) => onRemoveCustomField(tab.id, id)}
                                />
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        className="ct-add-custom-btn"
                        onClick={() => onAddCustomField(tab.id)}
                    >
                        <FiPlus size={13} /> Add Custom Field
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
    const [selectedCallType, setSelectedCallType] = useState("");
    const [tabConfig, setTabConfig] = useState(buildInitialTabConfig);
    const [openTab, setOpenTab] = useState(null);
    const [callTypeError, setCallTypeError] = useState("");

    useEffect(() => {
        if (show) getCallTypes({});
    }, [show, getCallTypes]);

    const handleNew = useCallback(() => {
        setEditingCallType(null);
        setTemplateName("");
        setSelectedCallType("");
        setTabConfig(buildInitialTabConfig());
        setOpenTab(null);
        setCallTypeError("");
    }, []);

    const handleSelectCallType = (ct) => {
        setEditingCallType(ct);
        setTemplateName(ct.call_type_name ?? "");
        setSelectedCallType(ct.selected_call_type ?? "");
        const restored = buildInitialTabConfig();
        if (ct.tab_config && typeof ct.tab_config === "object") {
            for (const key of Object.keys(restored)) {
                if (ct.tab_config[key] != null) {
                    restored[key] = { ...restored[key], ...ct.tab_config[key] };
                }
            }
        }
        setTabConfig(restored);
        setOpenTab(null);
        setCallTypeError("");
    };

    const handleToggleOpen = (tabId) =>
        setOpenTab((prev) => (prev === tabId ? null : tabId));

    const handleToggleTab = (tabId, checked) =>
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: { ...prev[tabId], enabled: checked },
        }));

    const handleToggleField = (tabId, field, checked) =>
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: {
                ...prev[tabId],
                fields: { ...prev[tabId].fields, [field]: checked },
            },
        }));

    const handleSelectAll = (tabId, checked) => {
        const tab = OPERATION_TABS.find((t) => t.id === tabId);
        if (!tab) return;
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: {
                ...prev[tabId],
                fields: Object.fromEntries(tab.fields.map((f) => [f, checked])),
            },
        }));
    };

    const handleAddCustomField = (tabId) =>
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: {
                ...prev[tabId],
                customFields: [
                    ...(prev[tabId].customFields ?? []),
                    { id: Date.now() + Math.random(), label: "", type: "text" },
                ],
            },
        }));

    const handleUpdateCustomField = (tabId, fieldId, key, value) =>
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: {
                ...prev[tabId],
                customFields: prev[tabId].customFields.map((cf) =>
                    cf.id === fieldId ? { ...cf, [key]: value } : cf
                ),
            },
        }));

    const handleRemoveCustomField = (tabId, fieldId) =>
        setTabConfig((prev) => ({
            ...prev,
            [tabId]: {
                ...prev[tabId],
                customFields: prev[tabId].customFields.filter((cf) => cf.id !== fieldId),
            },
        }));

    const handleSave = async () => {
        if (!selectedCallType) {
            setCallTypeError("Please select a call type");
            return;
        }
        setCallTypeError("");
        const payload = {
            call_type_name: templateName.trim() || null,
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

    const enabledTabCount = Object.values(tabConfig).filter((t) => t.enabled).length;

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
                                <span className="ct-saved-label">Saved Templates</span>
                                <button type="button" className="ct-new-btn" onClick={handleNew}>+ New</button>
                            </div>
                            <div className="ct-saved-list">
                                {isLoadingGet && <div className="ct-saved-empty">Loading...</div>}
                                {!isLoadingGet && list.length === 0 && (
                                    <div className="ct-saved-empty">No templates yet</div>
                                )}
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
                                <h3 className="ct-form-section-title">
                                    {isEditMode ? "Edit Template" : "New Template"}
                                </h3>

                                <div className="subtasks-tab-field">
                                    <label className="subtasks-tab-label">
                                        Call Type <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className={`subtasks-tab-select ${callTypeError ? "is-invalid" : ""}`}
                                        value={selectedCallType}
                                        onChange={(e) => { setSelectedCallType(e.target.value); setCallTypeError(""); }}
                                    >
                                        {CALL_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    {callTypeError && <span className="cf-field-error">{callTypeError}</span>}
                                </div>

                                <div className="subtasks-tab-field">
                                    <label className="subtasks-tab-label">Template Name</label>
                                    <input
                                        type="text"
                                        className="subtasks-tab-date-input"
                                        placeholder="e.g. Import Call Template (optional)"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Tab configuration */}
                            <div className="ct-tabs-section">
                                <div className="ct-tabs-section-header">
                                    <span className="ct-form-section-title">Tab Configuration</span>
                                    {enabledTabCount > 0 && (
                                        <span className="ct-tabs-count">{enabledTabCount} selected</span>
                                    )}
                                </div>

                                {/* Operation tabs — accordions with fields */}
                                <div className="ct-accordion-group">
                                    <p className="ct-group-label">Operation Tabs</p>
                                    {OPERATION_TABS.map((tab) => (
                                        <OperationTabAccordion
                                            key={tab.id}
                                            tab={tab}
                                            config={tabConfig}
                                            openTab={openTab}
                                            onToggleOpen={handleToggleOpen}
                                            onToggleTab={handleToggleTab}
                                            onToggleField={handleToggleField}
                                            onSelectAll={handleSelectAll}
                                            onAddCustomField={handleAddCustomField}
                                            onUpdateCustomField={handleUpdateCustomField}
                                            onRemoveCustomField={handleRemoveCustomField}
                                        />
                                    ))}
                                </div>

                                {/* Simple tabs — include/exclude only */}
                                <div className="ct-simple-tabs-group">
                                    <p className="ct-group-label">Other Tabs</p>
                                    {SIMPLE_TABS.map((tab) => (
                                        <label key={tab.id} className="ct-simple-tab-row">
                                            <input
                                                type="checkbox"
                                                checked={tabConfig[tab.id]?.enabled ?? false}
                                                onChange={(e) => handleToggleTab(tab.id, e.target.checked)}
                                            />
                                            <span className="ct-simple-tab-label">{tab.label}</span>
                                        </label>
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

                    {/* ── Right panel: summary ── */}
                    <div className="ct-split-right">
                        <h3 className="ct-form-section-title">Template Summary</h3>

                        <div className="ct-summary-card">
                            <div className="ct-summary-row">
                                <span className="ct-summary-label">Call Type</span>
                                <span className="ct-summary-value">
                                    {CALL_TYPE_OPTIONS.find((o) => o.value === selectedCallType)?.label || <em>Not selected</em>}
                                </span>
                            </div>
                            {templateName && (
                                <div className="ct-summary-row">
                                    <span className="ct-summary-label">Template Name</span>
                                    <span className="ct-summary-value">{templateName}</span>
                                </div>
                            )}
                        </div>

                        {enabledTabCount === 0 ? (
                            <p className="ct-summary-empty">No tabs selected yet. Enable tabs on the left to build your template.</p>
                        ) : (
                            <div className="ct-summary-tabs">
                                {OPERATION_TABS.filter((t) => tabConfig[t.id]?.enabled).map((tab) => {
                                    const enabledFields = tab.fields.filter((f) => tabConfig[tab.id]?.fields?.[f]);
                                    const customFields = tabConfig[tab.id]?.customFields ?? [];
                                    return (
                                        <div key={tab.id} className="ct-summary-tab">
                                            <p className="ct-summary-tab-name">{tab.label}</p>
                                            <ul className="ct-summary-field-list">
                                                {enabledFields.map((f) => <li key={f}>{f}</li>)}
                                                {customFields.filter((cf) => cf.label).map((cf) => (
                                                    <li key={cf.id} className="ct-summary-custom-field">
                                                        {cf.label} {cf.type && <span>({cf.type})</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                            {enabledFields.length === 0 && customFields.length === 0 && (
                                                <p className="ct-summary-no-fields">All fields included</p>
                                            )}
                                        </div>
                                    );
                                })}
                                {SIMPLE_TABS.filter((t) => tabConfig[t.id]?.enabled).map((tab) => (
                                    <div key={tab.id} className="ct-summary-tab">
                                        <p className="ct-summary-tab-name">{tab.label}</p>
                                        <p className="ct-summary-no-fields">Included</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default CallTypeBuilderModal;
