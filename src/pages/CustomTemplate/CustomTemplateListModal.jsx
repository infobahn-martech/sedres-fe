import { useState } from "react";
import {
    FiSearch, FiChevronRight, FiEdit2, FiTrash2, FiPlus,
    FiType, FiAlignLeft, FiHash, FiCalendar, FiClock,
    FiChevronDown, FiCheckSquare, FiDisc, FiPaperclip, FiMail,
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
    file: "File Upload",
    email: "Email",
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
    email: FiMail,
};

// Appointment Details is identical across all three call types, matching the
// real Sedres Appointment Details tab (General.jsx) at /kanban-board/:id.
const buildAppointmentDetailsTab = () => ({
    name: "Appointment Details",
    fields: [
        { label: "Owner", type: "dropdown", required: false },
        { label: "Appointment Email", type: "file", required: false },
        { label: "Appointment Type", type: "dropdown", required: true },
        { label: "Appointment Received", type: "datetime", required: true },
        { label: "Call Type", type: "dropdown", required: true },
        { label: "Port", type: "dropdown", required: true },
        { label: "Expected Time of Arrival", type: "datetime", required: true },
        { label: "Expected Time of Departure", type: "datetime", required: false },
        { label: "Last Port", type: "text", required: false },
        { label: "Vessel Type", type: "dropdown", required: false },
        { label: "Vessel Name", type: "text", required: true },
        { label: "Billing Entity", type: "dropdown", required: true },
        { label: "Vessel Owner", type: "text", required: false },
        { label: "Vessel Charterer", type: "text", required: false },
        { label: "Vessel Manager", type: "text", required: false },
        { label: "Checklist", type: "dropdown", required: false },
        { label: "Assigned Operator", type: "dropdown", required: false },
        { label: "Service Requestor Name", type: "text", required: false },
        { label: "Service Requestor Email", type: "email", required: false },
        { label: "Daily Report Emails", type: "text", required: false },
        { label: "Billing Instructions", type: "textarea", required: false },
    ],
});

// Tabs not detailed in the dummy data still appear (for the 9-tab count / tab row)
// but carry no fields yet.
const buildTrailingEmptyTabs = () => [
    { name: "Husbandry", fields: [] },
    { name: "Sales Order", fields: [] },
    { name: "Reports", fields: [] },
    { name: "Document Library", fields: [] },
    { name: "Comments", fields: [] },
    { name: "Subtasks", fields: [] },
    { name: "Notes", fields: [] },
];

const DUMMY_TEMPLATES = [
    {
        id: "tpl-import-call",
        name: "Import Call",
        billingEntityLabel: "General",
        tabs: [
            buildAppointmentDetailsTab(),
            {
                name: "Operation",
                subTabs: [
                    {
                        name: "Pre Arrival",
                        fields: [
                            { label: "Expected Time of Arrival", type: "datetime", required: false },
                            { label: "Expected Commencement of Custom Inspection", type: "datetime", required: false },
                            { label: "Expected Commencement of Immigration Clearance for Crew", type: "datetime", required: false },
                            { label: "Expected Completion of Inward Clearance", type: "datetime", required: false },
                            { label: "SABER Status", type: "dropdown", required: false },
                            { label: "Weather Forecast", type: "dropdown", required: false },
                            { label: "Coordinates Type", type: "dropdown", required: false },
                        ],
                    },
                    {
                        name: "Crew Immigration",
                        fields: [
                            { label: "Crew Immigration Commenced", type: "datetime", required: false },
                            { label: "Crew Immigration Completed", type: "datetime", required: false },
                            { label: "Crew Immigration Status", type: "dropdown", required: false },
                        ],
                    },
                    {
                        name: "Arrival",
                        fields: [
                            { label: "Actual Time of Arrival", type: "datetime", required: false },
                            { label: "Custom Inspection Commenced", type: "datetime", required: false },
                            { label: "Custom Inspection Completed", type: "datetime", required: false },
                            { label: "Custom Clearance Time", type: "text", required: false },
                            { label: "Vessel Inward Formalities Completed", type: "datetime", required: false },
                            { label: "Custom Inspection Status", type: "dropdown", required: false },
                            { label: "Inward Clearance", type: "dropdown", required: false },
                        ],
                    },
                    {
                        name: "Departure",
                        fields: [
                            { label: "Email Requested Accept", type: "checkbox", required: false },
                            { label: "Outward Clearance Delivered", type: "datetime", required: false },
                            { label: "Next Port", type: "text", required: false },
                            { label: "Attachments", type: "file", required: false },
                        ],
                    },
                    {
                        name: "Check List",
                        fields: [
                            { label: "Checklist Completion Status", type: "dropdown", required: false },
                        ],
                    },
                ],
            },
            ...buildTrailingEmptyTabs(),
        ],
    },
    {
        id: "tpl-export-call",
        name: "Export Call",
        billingEntityLabel: "General",
        tabs: [
            buildAppointmentDetailsTab(),
            {
                name: "Operation",
                subTabs: [
                    { name: "Pre Arrival", fields: [] },
                    { name: "Crew Immigration", fields: [] },
                    { name: "Arrival", fields: [] },
                    {
                        name: "Departure",
                        fields: [
                            { label: "Expected Time of Departure", type: "datetime", required: true },
                            { label: "Email Requested Accept", type: "file", required: false },
                            { label: "Outward Clearance Delivered", type: "dropdown", required: false },
                            { label: "Next Port", type: "text", required: false },
                            { label: "Departure Attachments", type: "file", required: false },
                            { label: "Vessel Outward Formalities Completed", type: "datetime", required: false },
                        ],
                    },
                    { name: "Check List", fields: [] },
                ],
            },
            ...buildTrailingEmptyTabs(),
        ],
    },
    {
        id: "tpl-domestic-call",
        name: "Domestic Call",
        billingEntityLabel: "General",
        tabs: [
            buildAppointmentDetailsTab(),
            {
                name: "Operation",
                subTabs: [
                    {
                        name: "Pre Arrival",
                        fields: [
                            { label: "Expected Time of Arrival", type: "datetime", required: false },
                            { label: "Port", type: "dropdown", required: false },
                        ],
                    },
                    { name: "Crew Immigration", fields: [] },
                    {
                        name: "Arrival",
                        fields: [
                            { label: "Actual Time of Arrival", type: "datetime", required: false },
                            { label: "Vessel Name", type: "text", required: false },
                            { label: "Assigned Operator", type: "dropdown", required: false },
                        ],
                    },
                    {
                        name: "Departure",
                        fields: [
                            { label: "Expected Time of Departure", type: "datetime", required: false },
                            { label: "Actual Time of Departure", type: "datetime", required: false },
                            { label: "Next Port", type: "text", required: false },
                            { label: "Attachments", type: "file", required: false },
                            { label: "Remarks", type: "textarea", required: false },
                        ],
                    },
                    { name: "Check List", fields: [] },
                ],
            },
            ...buildTrailingEmptyTabs(),
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
    const [activeSubTabIndex, setActiveSubTabIndex] = useState(0);
    const [deleteRequestId, setDeleteRequestId] = useState(null);
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderInitialTemplate, setBuilderInitialTemplate] = useState(null);

    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;
    const activeTab = selectedTemplate?.tabs?.[activeTabIndex] ?? null;
    const hasSubTabs = Array.isArray(activeTab?.subTabs);
    const activeSubTab = hasSubTabs ? (activeTab.subTabs[activeSubTabIndex] ?? activeTab.subTabs[0]) : null;
    const fieldsToShow = hasSubTabs ? (activeSubTab?.fields ?? []) : (activeTab?.fields ?? []);

    const handleSelectTemplate = (id) => {
        setSelectedId(id);
        setActiveTabIndex(0);
        setActiveSubTabIndex(0);
    };

    const handleSelectTab = (idx) => {
        setActiveTabIndex(idx);
        setActiveSubTabIndex(0);
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

    const mapEditField = (f) => ({
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options ?? [],
    });

    const handleEditClick = () => {
        if (!selectedTemplate) return;
        setBuilderInitialTemplate({
            name: selectedTemplate.name,
            billingEntityId: "",
            tabs: selectedTemplate.tabs.map((tab) => ({
                name: tab.name,
                fields: (tab.fields ?? []).map(mapEditField),
                subTabs: (tab.subTabs ?? []).map((sub) => ({
                    name: sub.name,
                    fields: (sub.fields ?? []).map(mapEditField),
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
                                                    onClick={() => handleSelectTab(idx)}
                                                >
                                                    {tab.name}
                                                </button>
                                            ))}
                                        </div>

                                        {hasSubTabs && (
                                            <div className="ctl-preview-subtabs">
                                                {activeTab.subTabs.map((sub, idx) => (
                                                    <button
                                                        key={sub.name}
                                                        type="button"
                                                        className={`ctl-preview-subtab-pill ${idx === activeSubTabIndex ? "is-active" : ""}`}
                                                        onClick={() => setActiveSubTabIndex(idx)}
                                                    >
                                                        {sub.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="ctl-preview-fields-scroll">
                                            {fieldsToShow.length > 0 ? (
                                                <div className="ctl-preview-fields-grid">
                                                    {fieldsToShow.map((field, idx) => (
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
