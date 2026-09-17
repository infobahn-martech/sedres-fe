import { useState } from "react";
import {
    FiSearch, FiChevronRight, FiEdit2, FiTrash2, FiPlus,
    FiType, FiAlignLeft, FiHash, FiCalendar, FiClock,
    FiChevronDown, FiCheckSquare, FiDisc, FiPaperclip,
} from "react-icons/fi";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import CustomTemplateBuilderModal from "./CustomTemplateBuilderModal";
import "../../design/css/common/CardForm.css";
import "../../design/scss/general.scss";
import "../../design/scss/pages/callTypeBuilder.scss";
import "../../design/scss/pages/customTemplateBuilder.scss";
import "../../design/scss/pages/customTemplateList.scss";

const FIELD_TYPE_LABELS = {
    text: "Text",
    textarea: "Text Area",
    number: "Number",
    date: "Date",
    time: "Time",
    datetime: "Date & Time",
    dropdown: "Dropdown",
    checkbox: "Checkbox",
    radio: "Radio Button",
    file: "File",
};

const FIELD_TYPE_ICONS = {
    text: FiType,
    textarea: FiAlignLeft,
    number: FiHash,
    date: FiCalendar,
    time: FiClock,
    datetime: FiCalendar,
    dropdown: FiChevronDown,
    checkbox: FiCheckSquare,
    radio: FiDisc,
    file: FiPaperclip,
};

const DUMMY_TEMPLATES = [
    {
        id: "tpl-import-call",
        name: "Import Call",
        billingEntityLabel: "Sedres UAE",
        tabs: [
            {
                name: "General Information",
                fields: [
                    { label: "Call Reference", type: "text", required: true },
                    { label: "Port", type: "dropdown", required: true },
                    { label: "ETA", type: "datetime", required: true },
                    { label: "Vessel Agent", type: "text", required: false },
                ],
            },
            {
                name: "Vessel Details",
                fields: [
                    { label: "Vessel Name", type: "text", required: true },
                    { label: "IMO Number", type: "text", required: true },
                    { label: "Flag", type: "dropdown", required: false },
                    { label: "Gross Tonnage", type: "number", required: false },
                ],
            },
            {
                name: "Cargo Details",
                fields: [
                    { label: "Cargo Type", type: "dropdown", required: true },
                    { label: "Cargo Quantity", type: "number", required: false },
                    { label: "Discharge Port", type: "dropdown", required: false },
                ],
            },
            {
                name: "Documents",
                fields: [
                    { label: "Manifest Upload", type: "file", required: false },
                    { label: "Bill of Lading", type: "file", required: false },
                    { label: "Remarks", type: "textarea", required: false },
                ],
            },
        ],
    },
    {
        id: "tpl-export-call",
        name: "Export Call",
        billingEntityLabel: "Sedres UAE",
        tabs: [
            {
                name: "General Information",
                fields: [
                    { label: "Export Reference", type: "text", required: true },
                    { label: "Port", type: "dropdown", required: true },
                    { label: "ETD", type: "datetime", required: true },
                    { label: "Vessel Agent", type: "text", required: false },
                ],
            },
            {
                name: "Vessel Details",
                fields: [
                    { label: "Vessel Name", type: "text", required: true },
                    { label: "IMO Number", type: "text", required: true },
                    { label: "Flag", type: "dropdown", required: false },
                ],
            },
            {
                name: "Cargo Details",
                fields: [
                    { label: "Cargo Type", type: "dropdown", required: true },
                    { label: "Cargo Quantity", type: "number", required: false },
                    { label: "Loading Port", type: "dropdown", required: false },
                    { label: "Destination Port", type: "dropdown", required: false },
                ],
            },
            {
                name: "Documents",
                fields: [
                    { label: "Shipping Instructions", type: "file", required: false },
                    { label: "Cargo Manifest", type: "file", required: false },
                    { label: "Remarks", type: "textarea", required: false },
                ],
            },
        ],
    },
    {
        id: "tpl-port-agency-call",
        name: "Port Agency Call",
        billingEntityLabel: "Sedres KSA",
        tabs: [
            {
                name: "General Information",
                fields: [
                    { label: "Call Reference", type: "text", required: true },
                    { label: "Port", type: "dropdown", required: true },
                    { label: "ETA", type: "datetime", required: true },
                    { label: "Agent", type: "text", required: false },
                ],
            },
            {
                name: "Vessel Details",
                fields: [
                    { label: "Vessel Name", type: "text", required: true },
                    { label: "IMO Number", type: "text", required: true },
                ],
            },
            {
                name: "Cargo Details",
                fields: [
                    { label: "Cargo Type", type: "dropdown", required: false },
                ],
            },
            {
                name: "Documents",
                fields: [
                    { label: "Remarks", type: "textarea", required: false },
                ],
            },
        ],
    },
];

function TemplateListCard({ template, isActive, onSelect, onDelete }) {
    const tabCount = template.tabs?.length ?? 0;
    return (
        <div className={`ctl-template-card ${isActive ? "is-active" : ""}`} onClick={onSelect}>
            <span className={`ctl-template-checkbox ${isActive ? "is-checked" : ""}`} aria-hidden="true" />
            <div className="ctl-template-card-body">
                <span className="ctl-template-name">{template.name}</span>
                <span className="ctl-template-meta">
                    {template.billingEntityLabel} · {tabCount} tab{tabCount === 1 ? "" : "s"}
                </span>
            </div>
            <button
                type="button"
                className="ctl-template-delete-btn"
                aria-label="Delete template"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
                <FiTrash2 size={14} />
            </button>
            <FiChevronRight size={16} className="ctl-template-arrow" />
        </div>
    );
}

function FieldPreviewCard({ field }) {
    const Icon = FIELD_TYPE_ICONS[field.type] ?? FiType;
    return (
        <div className="ctl-preview-field-card">
            <span className="ctl-preview-field-icon">
                <Icon size={15} />
            </span>
            <div className="ctl-preview-field-content">
                <span className="ctl-preview-field-label">{field.label}</span>
                <div className="ctl-preview-field-meta">
                    <span className="ctl-preview-field-badge">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
                    {field.required && <span className="ctl-preview-field-required">Required</span>}
                </div>
            </div>
        </div>
    );
}

function CustomTemplateListModal({ show, onClose }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [templates, setTemplates] = useState(DUMMY_TEMPLATES);
    const [selectedId, setSelectedId] = useState(DUMMY_TEMPLATES[0]?.id ?? null);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [deleteRequestId, setDeleteRequestId] = useState(null);
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderInitialTemplate, setBuilderInitialTemplate] = useState(null);

    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;
    const activeTab = selectedTemplate?.tabs?.[activeTabIndex] ?? null;

    const handleSelectTemplate = (id) => {
        setSelectedId(id);
        setActiveTabIndex(0);
    };

    const handleConfirmDelete = () => {
        setTemplates((prev) => prev.filter((t) => t.id !== deleteRequestId));
        if (selectedId === deleteRequestId) {
            setSelectedId(null);
            setActiveTabIndex(0);
        }
        setDeleteRequestId(null);
    };

    const handleCreateClick = () => {
        setBuilderInitialTemplate(null);
        setBuilderOpen(true);
    };

    const handleEditClick = () => {
        if (!selectedTemplate) return;
        setBuilderInitialTemplate({
            name: selectedTemplate.name,
            billingEntityId: "",
            tabs: selectedTemplate.tabs.map((tab) => ({
                name: tab.name,
                fields: tab.fields.map((f) => ({
                    label: f.label,
                    type: f.type,
                    required: f.required,
                    options: f.options ?? [],
                })),
            })),
        });
        setBuilderOpen(true);
    };

    if (!show) return null;

    return (
        <>
            <div className="cardform-overlay ct-modal-overlay">
                    <div className="cardform-panel">
                        <div className="cardform-topbar ctl-modal-topbar">
                            <div>
                                <span className="ctl-topbar-title">Custom Templates List</span>
                            </div>
                            <div className="cardform-topbar-right">
                                <button type="button" className="cardform-close-btn" onClick={onClose}>✕</button>
                            </div>
                        </div>

                        <div className="ct-split-body">
                            <div className="ct-split-left">
                                <div className="ctl-left-top">
                                    <button type="button" className="ctl-create-btn" onClick={handleCreateClick}>
                                        <FiPlus size={14} /> Create Custom Template
                                    </button>
                                    <div className="ctl-search-box">
                                        <FiSearch size={14} className="ctl-search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search templates"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="ct-split-scroll-area">
                                    <div className="ctl-template-list">
                                        {filteredTemplates.length === 0 ? (
                                            <p className="ctl-list-empty">No templates found.</p>
                                        ) : (
                                            filteredTemplates.map((tpl) => (
                                                <TemplateListCard
                                                    key={tpl.id}
                                                    template={tpl}
                                                    isActive={tpl.id === selectedId}
                                                    onSelect={() => handleSelectTemplate(tpl.id)}
                                                    onDelete={() => setDeleteRequestId(tpl.id)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="ct-split-right ctl-preview-panel">
                                {selectedTemplate ? (
                                    <>
                                        <div className="ctl-preview-header">
                                            <div>
                                                <h2 className="ctl-preview-title">{selectedTemplate.name}</h2>
                                                <p className="ctl-preview-entity">Billing Entity: {selectedTemplate.billingEntityLabel}</p>
                                            </div>
                                            <button type="button" className="ctl-edit-btn" onClick={handleEditClick}>
                                                <FiEdit2 size={13} /> Edit Template
                                            </button>
                                        </div>

                                        <div className="ctl-preview-tabs">
                                            {selectedTemplate.tabs.map((tab, idx) => (
                                                <button
                                                    key={tab.name}
                                                    type="button"
                                                    className={`ctl-preview-tab-pill ${idx === activeTabIndex ? "is-active" : ""}`}
                                                    onClick={() => setActiveTabIndex(idx)}
                                                >
                                                    {tab.name}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="ctl-preview-fields-scroll">
                                            {activeTab && activeTab.fields.length > 0 ? (
                                                <div className="ctl-preview-fields-grid">
                                                    {activeTab.fields.map((field, idx) => (
                                                        <FieldPreviewCard key={idx} field={field} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="ctl-preview-empty">No fields in this tab.</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="ct-preview-empty">
                                        <p>Select a template from the list to preview its structure.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ctm-footer">
                            <span className="ctm-required-note">{templates.length} template{templates.length === 1 ? "" : "s"}</span>
                            <div className="ctm-footer-actions">
                                <button type="button" className="btn-common close" onClick={onClose}>
                                    Cancel
                                </button>
                                <button type="button" className="ctm-save-btn" onClick={onClose}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
            </div>

            {builderOpen && (
                <div className="ctl-nested-builder">
                    <CustomTemplateBuilderModal
                        show={builderOpen}
                        onClose={() => setBuilderOpen(false)}
                        initialTemplate={builderInitialTemplate}
                    />
                </div>
            )}

            {!!deleteRequestId && (
                <DeleteConfirmationModal
                    show={!!deleteRequestId}
                    onCancel={() => setDeleteRequestId(null)}
                    onConfirm={handleConfirmDelete}
                    deleteText="Delete this template? This cannot be undone."
                    className="ctl-delete-confirm-modal"
                    backdropClassName="ctl-delete-confirm-backdrop"
                />
            )}
        </>
    );
}

export default CustomTemplateListModal;
