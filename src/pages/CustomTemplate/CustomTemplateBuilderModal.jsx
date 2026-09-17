import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiMenu } from "react-icons/fi";
import SearchableSelect from "../../components/form/SearchableSelect";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useBillingEntityReducer from "../../store/BillingEntityReducer";
import useAlertReducer from "../../store/AlertReducer";
import "../../design/css/common/CardForm.css";
import "../../design/scss/general.scss";
import "../../design/scss/pages/customTemplateBuilder.scss";

const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "textarea", label: "Text Area" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "datetime", label: "Date & Time" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
    { value: "radio", label: "Radio Button" },
    { value: "file", label: "File Upload" },
];

const OPTIONS_FIELD_TYPES = new Set(["dropdown", "radio"]);

// Level 1 of the template structure — mirrors the real Sedres card's top-level tabs.
// A main tab optionally owns Level 2 sub-tabs (e.g. Operation > Pre Arrival); fields
// live on the sub-tab when any exist, otherwise directly on the main tab.
const MAIN_TAB_NAMES = [
    "Appointment Details",
    "Operation",
    "Husbandry",
    "Sales Order",
    "Reports",
    "Document Library",
    "Comments",
    "Subtasks",
    "Notes",
];

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBlankField = () => ({ id: makeId("field"), label: "", type: "text", required: false, options: [] });

const mapTemplateField = (f) => ({
    id: makeId("field"),
    label: f.label ?? "",
    type: f.type ?? "text",
    required: Boolean(f.required),
    options: f.options ? [...f.options] : [],
});

const buildDefaultTabs = () => MAIN_TAB_NAMES.map((name) => ({
    id: makeId("tab"),
    name,
    fields: [createBlankField()],
    subTabs: [],
}));

const buildTabsFromTemplate = (template) => {
    if (!template?.tabs?.length) return buildDefaultTabs();
    return template.tabs.map((tab) => ({
        id: makeId("tab"),
        name: tab.name,
        fields: (tab.fields ?? []).map(mapTemplateField),
        subTabs: (tab.subTabs ?? []).map((sub) => ({
            id: makeId("subtab"),
            name: sub.name,
            fields: (sub.fields ?? []).map(mapTemplateField),
        })),
    }));
};

function FieldOptionsEditor({ field, onAddOption, onUpdateOption, onRemoveOption }) {
    const options = field.options ?? [];
    return (
        <div className="ctm-field-options">
            <div className="ctm-field-options-header">
                <p className="ctm-field-options-label">Options</p>
                <button type="button" className="ctm-add-option-btn" onClick={onAddOption}>
                    <FiPlus size={12} /> Add Option
                </button>
            </div>
            {options.map((opt, idx) => (
                <div key={idx} className="ctm-option-row">
                    <span className="ctm-option-index">{idx + 1}</span>
                    <input
                        type="text"
                        className="ctm-option-input"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => onUpdateOption(idx, e.target.value)}
                    />
                    <button
                        type="button"
                        className="ctm-option-del-btn"
                        aria-label="Remove option"
                        onClick={() => onRemoveOption(idx)}
                        disabled={options.length <= 1}
                    >
                        <FiX size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function FieldCard({ field, index, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd, onUpdate, onRequestDelete, onAddField, onAddOption, onUpdateOption, onRemoveOption }) {
    const showOptions = OPTIONS_FIELD_TYPES.has(field.type);
    return (
        <div
            className={`ctm-field-card ${isDragging ? "is-dragging" : ""} ${isDragOver ? "is-drag-over" : ""}`}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
            onDrop={(e) => { e.preventDefault(); onDrop(index); }}
            onDragEnd={onDragEnd}
        >
            <div className="ctm-field-row-top">
                <span className="ctm-field-drag-handle" title="Drag to reorder">
                    <FiMenu size={14} />
                </span>
                <input
                    type="text"
                    className="ctm-field-label-input"
                    placeholder="Field label"
                    value={field.label}
                    onChange={(e) => onUpdate(field.id, "label", e.target.value)}
                />
                <select
                    className="ctm-field-type-select"
                    value={field.type}
                    onChange={(e) => onUpdate(field.id, "type", e.target.value)}
                >
                    {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                </select>
                <label className="ctm-toggle-wrap">
                    <span className="ctm-toggle-label">Required</span>
                    <span className="ctm-toggle">
                        <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => onUpdate(field.id, "required", e.target.checked)}
                        />
                        <span className="ctm-toggle-slider" />
                    </span>
                </label>
                <button
                    type="button"
                    className="ctm-field-del-btn"
                    aria-label="Delete field"
                    onClick={() => onRequestDelete(field.id)}
                >
                    <FiTrash2 size={15} />
                </button>
                <button
                    type="button"
                    className="ctm-field-add-btn"
                    aria-label="Add field"
                    title="Add field"
                    onClick={() => onAddField(index)}
                >
                    <FiPlus size={15} />
                </button>
            </div>

            {showOptions && (
                <FieldOptionsEditor
                    field={field}
                    onAddOption={() => onAddOption(field.id)}
                    onUpdateOption={(idx, val) => onUpdateOption(field.id, idx, val)}
                    onRemoveOption={(idx) => onRemoveOption(field.id, idx)}
                />
            )}
        </div>
    );
}

function CustomTemplateBuilderModal({ show, onClose, initialTemplate = null }) {
    const { getBillingEntities, billingEntities, isLoading: billingLoading } = useBillingEntityReducer((s) => s);
    const { success } = useAlertReducer((s) => s);
    const isEditMode = Boolean(initialTemplate);

    const [templateName, setTemplateName] = useState(() => initialTemplate?.name ?? "");
    const [nameTouched, setNameTouched] = useState(false);
    const [billingEntity, setBillingEntity] = useState(() => initialTemplate?.billingEntityId ?? "");
    const [entityTouched, setEntityTouched] = useState(false);

    const [tabs, setTabs] = useState(() => buildTabsFromTemplate(initialTemplate));
    const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id);
    const [activeSubTabId, setActiveSubTabId] = useState(() => tabs[0]?.subTabs?.[0]?.id ?? null);
    const [addingTab, setAddingTab] = useState(false);
    const [newTabName, setNewTabName] = useState("");
    const [editingTabId, setEditingTabId] = useState(null);
    const [editingTabName, setEditingTabName] = useState("");

    const [addingSubTab, setAddingSubTab] = useState(false);
    const [newSubTabName, setNewSubTabName] = useState("");
    const [editingSubTabId, setEditingSubTabId] = useState(null);
    const [editingSubTabName, setEditingSubTabName] = useState("");

    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [deleteFieldRequest, setDeleteFieldRequest] = useState(null);

    const billingEntityOptions = (billingEntities ?? []).map((be) => ({
        value: String(be._id ?? be.entity_id ?? ""),
        label: String(be.name ?? be.billing_entity ?? ""),
    }));

    const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
    const hasSubTabs = Boolean(activeTab?.subTabs?.length);
    const activeSubTab = hasSubTabs
        ? (activeTab.subTabs.find((s) => s.id === activeSubTabId) ?? activeTab.subTabs[0])
        : null;
    const activeFields = hasSubTabs ? (activeSubTab?.fields ?? []) : (activeTab?.fields ?? []);

    useEffect(() => {
        if (show && billingEntities === null && !billingLoading) {
            getBillingEntities({ params: { page: 1, limit: 1000 } });
        }
    }, [show, billingEntities, billingLoading, getBillingEntities]);

    const resetState = () => {
        setTemplateName(initialTemplate?.name ?? "");
        setNameTouched(false);
        setBillingEntity(initialTemplate?.billingEntityId ?? "");
        setEntityTouched(false);
        const defaultTabs = buildTabsFromTemplate(initialTemplate);
        setTabs(defaultTabs);
        setActiveTabId(defaultTabs[0].id);
        setActiveSubTabId(defaultTabs[0].subTabs?.[0]?.id ?? null);
        setAddingTab(false);
        setNewTabName("");
        setEditingTabId(null);
        setEditingTabName("");
        setAddingSubTab(false);
        setNewSubTabName("");
        setEditingSubTabId(null);
        setEditingSubTabName("");
        setDeleteFieldRequest(null);
    };

    // Writes to the currently active fields scope — the active sub-tab's fields
    // when the active main tab has any, otherwise the main tab's own fields.
    const updateFieldsScope = (updater) => {
        setTabs((prev) => prev.map((t) => {
            if (t.id !== activeTabId) return t;
            if (t.subTabs?.length) {
                return {
                    ...t,
                    subTabs: t.subTabs.map((s) => (s.id === activeSubTabId ? { ...s, fields: updater(s.fields) } : s)),
                };
            }
            return { ...t, fields: updater(t.fields) };
        }));
    };

    const handleSelectTab = (tab) => {
        setActiveTabId(tab.id);
        setActiveSubTabId(tab.subTabs?.[0]?.id ?? null);
    };

    const handleAddTabClick = () => {
        setAddingTab(true);
        setNewTabName("");
    };

    const handleConfirmAddTab = () => {
        const trimmed = newTabName.trim();
        if (!trimmed) {
            setAddingTab(false);
            return;
        }
        const tab = { id: makeId("tab"), name: trimmed, fields: [createBlankField()], subTabs: [] };
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
        setActiveSubTabId(null);
        setAddingTab(false);
        setNewTabName("");
    };

    const handleCancelAddTab = () => {
        setAddingTab(false);
        setNewTabName("");
    };

    const handleStartRenameTab = (tab) => {
        setEditingTabId(tab.id);
        setEditingTabName(tab.name);
    };

    const handleConfirmRenameTab = () => {
        const trimmed = editingTabName.trim();
        if (trimmed) {
            setTabs((prev) => prev.map((t) => (t.id === editingTabId ? { ...t, name: trimmed } : t)));
        }
        setEditingTabId(null);
        setEditingTabName("");
    };

    const handleDeleteTab = (tabId) => {
        if (tabs.length <= 1) return;
        setTabs((prev) => {
            const next = prev.filter((t) => t.id !== tabId);
            if (activeTabId === tabId) {
                setActiveTabId(next[0]?.id);
                setActiveSubTabId(next[0]?.subTabs?.[0]?.id ?? null);
            }
            return next;
        });
    };

    const handleAddSubTabClick = () => {
        setAddingSubTab(true);
        setNewSubTabName("");
    };

    const handleConfirmAddSubTab = () => {
        const trimmed = newSubTabName.trim();
        if (!trimmed) {
            setAddingSubTab(false);
            return;
        }
        const sub = { id: makeId("subtab"), name: trimmed, fields: [createBlankField()] };
        setTabs((prev) => prev.map((t) => (
            t.id === activeTabId ? { ...t, subTabs: [...(t.subTabs ?? []), sub] } : t
        )));
        setActiveSubTabId(sub.id);
        setAddingSubTab(false);
        setNewSubTabName("");
    };

    const handleCancelAddSubTab = () => {
        setAddingSubTab(false);
        setNewSubTabName("");
    };

    const handleStartRenameSubTab = (sub) => {
        setEditingSubTabId(sub.id);
        setEditingSubTabName(sub.name);
    };

    const handleConfirmRenameSubTab = () => {
        const trimmed = editingSubTabName.trim();
        if (trimmed) {
            setTabs((prev) => prev.map((t) => (
                t.id === activeTabId
                    ? { ...t, subTabs: t.subTabs.map((s) => (s.id === editingSubTabId ? { ...s, name: trimmed } : s)) }
                    : t
            )));
        }
        setEditingSubTabId(null);
        setEditingSubTabName("");
    };

    const handleDeleteSubTab = (subTabId) => {
        setTabs((prev) => prev.map((t) => {
            if (t.id !== activeTabId) return t;
            const nextSubTabs = (t.subTabs ?? []).filter((s) => s.id !== subTabId);
            return { ...t, subTabs: nextSubTabs };
        }));
        setActiveSubTabId((prev) => {
            if (prev !== subTabId) return prev;
            const remaining = (activeTab?.subTabs ?? []).filter((s) => s.id !== subTabId);
            return remaining[0]?.id ?? null;
        });
    };

    const handleAddField = () => {
        updateFieldsScope((fields) => [...fields, createBlankField()]);
    };

    const handleAddFieldAfter = (index) => {
        updateFieldsScope((fields) => {
            const next = [...fields];
            next.splice(index + 1, 0, createBlankField());
            return next;
        });
    };

    const handleUpdateField = (fieldId, key, value) => {
        updateFieldsScope((fields) => fields.map((f) => {
            if (f.id !== fieldId) return f;
            const next = { ...f, [key]: value };
            if (key === "type" && OPTIONS_FIELD_TYPES.has(value) && (!next.options || next.options.length === 0)) {
                next.options = ["Option 1"];
            }
            return next;
        }));
    };

    const handleRequestDeleteField = (fieldId) => {
        setDeleteFieldRequest({ tabId: activeTabId, subTabId: hasSubTabs ? activeSubTab?.id : null, fieldId });
    };

    const handleConfirmDeleteField = () => {
        if (!deleteFieldRequest) return;
        setTabs((prev) => prev.map((t) => {
            if (t.id !== deleteFieldRequest.tabId) return t;
            if (deleteFieldRequest.subTabId) {
                return {
                    ...t,
                    subTabs: t.subTabs.map((s) => (
                        s.id === deleteFieldRequest.subTabId
                            ? { ...s, fields: s.fields.filter((f) => f.id !== deleteFieldRequest.fieldId) }
                            : s
                    )),
                };
            }
            return { ...t, fields: t.fields.filter((f) => f.id !== deleteFieldRequest.fieldId) };
        }));
        setDeleteFieldRequest(null);
    };

    const handleAddOption = (fieldId) => {
        updateFieldsScope((fields) => fields.map((f) => (
            f.id === fieldId ? { ...f, options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] } : f
        )));
    };

    const handleUpdateOption = (fieldId, idx, value) => {
        updateFieldsScope((fields) => fields.map((f) => {
            if (f.id !== fieldId) return f;
            const nextOptions = [...(f.options ?? [])];
            nextOptions[idx] = value;
            return { ...f, options: nextOptions };
        }));
    };

    const handleRemoveOption = (fieldId, idx) => {
        updateFieldsScope((fields) => fields.map((f) => (
            f.id === fieldId ? { ...f, options: (f.options ?? []).filter((_, i) => i !== idx) } : f
        )));
    };

    const handleDragStart = (index) => setDragIndex(index);
    const handleDragOver = (index) => setDragOverIndex(index);
    const handleDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };
    const handleDrop = (dropIndex) => {
        if (dragIndex === null || dragIndex === dropIndex) {
            handleDragEnd();
            return;
        }
        updateFieldsScope((fields) => {
            const next = [...fields];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(dropIndex, 0, moved);
            return next;
        });
        handleDragEnd();
    };

    const isNameInvalid = nameTouched && !templateName.trim();
    const isEntityInvalid = entityTouched && !billingEntity;
    const canSave = Boolean(templateName.trim()) && Boolean(billingEntity);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSave = () => {
        setNameTouched(true);
        setEntityTouched(true);
        if (!canSave) return;
        success(isEditMode ? "Custom template updated successfully" : "Custom template saved successfully");
        resetState();
        onClose();
    };

    if (!show) return null;

    return (
        <>
            <div className="cardform-overlay ctm-modal-overlay">
                <div className="cardform-panel">
                    <div className="cardform-topbar ctm-modal-topbar">
                        <div>
                            <span className="ctm-topbar-title">{isEditMode ? "Edit Custom Template" : "Create Custom Template"}</span>
                        </div>
                        <div className="cardform-topbar-right">
                            <button type="button" className="cardform-close-btn" onClick={handleClose}>✕</button>
                        </div>
                    </div>

                    <div className="ctm-body">
                        <div className="ctm-top-grid">
                            <div className="cf-field">
                                <label>
                                    Template Name <span className="text-danger">*</span>
                                </label>
                                <div className="cf-input">
                                    <input
                                        type="text"
                                        placeholder="Enter template name"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        onBlur={() => setNameTouched(true)}
                                    />
                                </div>
                                {isNameInvalid && <span className="cf-field-error">Template name is required</span>}
                            </div>

                            <div className="cf-field">
                                <label>
                                    Billing Entity <span className="text-danger">*</span>
                                </label>
                                <SearchableSelect
                                    value={billingEntity}
                                    onChange={(e) => { setBillingEntity(e.target.value); setEntityTouched(true); }}
                                    options={billingEntityOptions}
                                    placeholder={billingLoading ? "Loading..." : "Select billing entity"}
                                    hasError={isEntityInvalid}
                                    disabled={billingLoading}
                                    className="ctm-billing-select"
                                    menuPortalTarget={document.body}
                                    menuPlacement="auto"
                                />
                                {isEntityInvalid && <span className="cf-field-error">Billing entity is required</span>}
                            </div>
                        </div>

                        <p className="ctm-section-title">Template Structure</p>
                        <p className="ctm-section-subtext">Create tabs and add custom fields for this template.</p>

                        <div className="ctm-tabs-row">
                            {tabs.map((tab) => (
                                editingTabId === tab.id ? (
                                    <div key={tab.id} className="ctm-add-tab-inline">
                                        <input
                                            type="text"
                                            className="ctm-tab-name-input"
                                            value={editingTabName}
                                            autoFocus
                                            onChange={(e) => setEditingTabName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleConfirmRenameTab();
                                                if (e.key === "Escape") setEditingTabId(null);
                                            }}
                                        />
                                        <button type="button" className="ctm-tab-icon-btn" onClick={handleConfirmRenameTab} aria-label="Confirm rename">
                                            <FiCheck size={14} />
                                        </button>
                                        <button type="button" className="ctm-tab-icon-btn" onClick={() => setEditingTabId(null)} aria-label="Cancel rename">
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        key={tab.id}
                                        className={`ctm-tab-pill ${activeTabId === tab.id ? "is-active" : ""}`}
                                        onClick={() => handleSelectTab(tab)}
                                    >
                                        <span className="ctm-tab-pill-name">{tab.name}</span>
                                        <button
                                            type="button"
                                            className="ctm-tab-icon-btn"
                                            aria-label="Rename tab"
                                            onClick={(e) => { e.stopPropagation(); handleStartRenameTab(tab); }}
                                        >
                                            <FiEdit2 size={12} />
                                        </button>
                                        {tabs.length > 1 && (
                                            <button
                                                type="button"
                                                className="ctm-tab-icon-btn ctm-tab-delete-btn"
                                                aria-label="Delete tab"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}
                                            >
                                                <FiTrash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                )
                            ))}

                            {addingTab ? (
                                <div className="ctm-add-tab-inline">
                                    <input
                                        type="text"
                                        className="ctm-tab-name-input"
                                        placeholder="Tab name"
                                        value={newTabName}
                                        autoFocus
                                        onChange={(e) => setNewTabName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleConfirmAddTab();
                                            if (e.key === "Escape") handleCancelAddTab();
                                        }}
                                    />
                                    <button type="button" className="ctm-tab-icon-btn" onClick={handleConfirmAddTab} aria-label="Confirm add tab">
                                        <FiCheck size={14} />
                                    </button>
                                    <button type="button" className="ctm-tab-icon-btn" onClick={handleCancelAddTab} aria-label="Cancel add tab">
                                        <FiX size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button type="button" className="ctm-add-tab-btn" onClick={handleAddTabClick}>
                                    <FiPlus size={13} /> Add Tab
                                </button>
                            )}
                        </div>

                        {activeTab && (hasSubTabs ? (
                            <div className="ctm-subtabs-row">
                                {activeTab.subTabs.map((sub) => (
                                    editingSubTabId === sub.id ? (
                                        <div key={sub.id} className="ctm-add-tab-inline">
                                            <input
                                                type="text"
                                                className="ctm-tab-name-input"
                                                value={editingSubTabName}
                                                autoFocus
                                                onChange={(e) => setEditingSubTabName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleConfirmRenameSubTab();
                                                    if (e.key === "Escape") setEditingSubTabId(null);
                                                }}
                                            />
                                            <button type="button" className="ctm-tab-icon-btn" onClick={handleConfirmRenameSubTab} aria-label="Confirm rename">
                                                <FiCheck size={14} />
                                            </button>
                                            <button type="button" className="ctm-tab-icon-btn" onClick={() => setEditingSubTabId(null)} aria-label="Cancel rename">
                                                <FiX size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            key={sub.id}
                                            className={`ctm-subtab-pill ${activeSubTabId === sub.id ? "is-active" : ""}`}
                                            onClick={() => setActiveSubTabId(sub.id)}
                                        >
                                            <span className="ctm-tab-pill-name">{sub.name}</span>
                                            <button
                                                type="button"
                                                className="ctm-tab-icon-btn"
                                                aria-label="Rename subtab"
                                                onClick={(e) => { e.stopPropagation(); handleStartRenameSubTab(sub); }}
                                            >
                                                <FiEdit2 size={11} />
                                            </button>
                                            <button
                                                type="button"
                                                className="ctm-tab-icon-btn ctm-tab-delete-btn"
                                                aria-label="Delete subtab"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSubTab(sub.id); }}
                                            >
                                                <FiTrash2 size={11} />
                                            </button>
                                        </div>
                                    )
                                ))}

                                {addingSubTab ? (
                                    <div className="ctm-add-tab-inline">
                                        <input
                                            type="text"
                                            className="ctm-tab-name-input"
                                            placeholder="Subtab name"
                                            value={newSubTabName}
                                            autoFocus
                                            onChange={(e) => setNewSubTabName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleConfirmAddSubTab();
                                                if (e.key === "Escape") handleCancelAddSubTab();
                                            }}
                                        />
                                        <button type="button" className="ctm-tab-icon-btn" onClick={handleConfirmAddSubTab} aria-label="Confirm add subtab">
                                            <FiCheck size={14} />
                                        </button>
                                        <button type="button" className="ctm-tab-icon-btn" onClick={handleCancelAddSubTab} aria-label="Cancel add subtab">
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="ctm-add-subtab-btn" onClick={handleAddSubTabClick}>
                                        <FiPlus size={12} /> Add Subtab
                                    </button>
                                )}
                            </div>
                        ) : addingSubTab ? (
                            <div className="ctm-add-tab-inline ctm-add-subtab-inline-standalone">
                                <input
                                    type="text"
                                    className="ctm-tab-name-input"
                                    placeholder="Subtab name"
                                    value={newSubTabName}
                                    autoFocus
                                    onChange={(e) => setNewSubTabName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleConfirmAddSubTab();
                                        if (e.key === "Escape") handleCancelAddSubTab();
                                    }}
                                />
                                <button type="button" className="ctm-tab-icon-btn" onClick={handleConfirmAddSubTab} aria-label="Confirm add subtab">
                                    <FiCheck size={14} />
                                </button>
                                <button type="button" className="ctm-tab-icon-btn" onClick={handleCancelAddSubTab} aria-label="Cancel add subtab">
                                    <FiX size={14} />
                                </button>
                            </div>
                        ) : (
                            <button type="button" className="ctm-add-subtab-link" onClick={handleAddSubTabClick}>
                                <FiPlus size={12} /> Add Subtab
                            </button>
                        ))}

                        <div className="ctm-fields-header">
                            <p className="ctm-section-title" style={{ margin: 0 }}>Fields</p>
                        </div>

                        {activeFields.length === 0 && (
                            <div className="ctm-fields-empty">
                                <p>No fields added yet. Add fields to capture the required information.</p>
                                <button type="button" className="ctm-add-field-btn" onClick={handleAddField} aria-label="Add field" title="Add field">
                                    <FiPlus size={16} />
                                </button>
                            </div>
                        )}

                        {activeFields.length > 0 && (
                            <div className="ctm-fields-list">
                                {activeFields.map((field, index) => (
                                    <FieldCard
                                        key={field.id}
                                        field={field}
                                        index={index}
                                        isDragging={dragIndex === index}
                                        isDragOver={dragOverIndex === index && dragIndex !== index}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onDragEnd={handleDragEnd}
                                        onUpdate={handleUpdateField}
                                        onRequestDelete={handleRequestDeleteField}
                                        onAddField={handleAddFieldAfter}
                                        onAddOption={handleAddOption}
                                        onUpdateOption={handleUpdateOption}
                                        onRemoveOption={handleRemoveOption}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ctm-footer">
                        <span className="ctm-required-note">* Required fields</span>
                        <div className="ctm-footer-actions">
                            <button type="button" className="btn-common close" onClick={handleClose}>
                                Cancel
                            </button>
                            <button type="button" className="ctm-save-btn" disabled={!canSave} onClick={handleSave}>
                                {isEditMode ? "Update Template" : "Save Template"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {!!deleteFieldRequest && (
                <DeleteConfirmationModal
                    show={!!deleteFieldRequest}
                    onCancel={() => setDeleteFieldRequest(null)}
                    onConfirm={handleConfirmDeleteField}
                    deleteText="Delete this field? This cannot be undone."
                    className="ctm-delete-confirm-modal"
                    backdropClassName="ctm-delete-confirm-backdrop"
                />
            )}
        </>
    );
}

export default CustomTemplateBuilderModal;
