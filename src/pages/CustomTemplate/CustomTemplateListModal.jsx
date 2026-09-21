import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiChevronRight, FiEdit2, FiTrash2, FiPlus, FiArrowLeft } from "react-icons/fi";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { TemplateBuilderBody, buildTabsFromTemplate } from "./CustomTemplateBuilderModal";
import TemplateFieldPreview from "./TemplateFieldPreview";
import useFormTemplateReducer from "../../store/FormTemplateReducer";
import "../../design/css/common/CardForm.css";
import "../../design/scss/general.scss";
import "../../design/scss/operations.scss";
import "../../design/scss/pages/callTypeBuilder.scss";
import "../../design/scss/pages/customTemplateBuilder.scss";
import "../../design/scss/pages/customTemplateList.scss";

// Normalizes a raw form_template/list item (template_name/billing_entity/tab_count,
// tabs in the API's own tab_label/field_label/... shape) into the shape this
// modal's list/preview UI and TemplateFieldPreview already render.
const normalizeTemplateSummary = (tpl) => ({
    id: tpl.templateId ?? tpl.template_id,
    name: tpl.name ?? tpl.template_name ?? "",
    billingEntityLabel: tpl.billingEntityLabel ?? tpl.billing_entity ?? "General",
    tabCount: tpl.tabCount ?? tpl.tab_count ?? tpl.tabs?.length ?? 0,
    tabs: buildTabsFromTemplate(tpl),
});

function TemplateListCard({ template, isActive, onSelect, onDelete }) {
    const tabCount = template.tabCount ?? template.tabs?.length ?? 0;
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

function CustomTemplateListModal({ show, onClose }) {
    const { getTemplateList, templates, getTemplateById } = useFormTemplateReducer((s) => s);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [activeSubTabIndex, setActiveSubTabIndex] = useState(0);
    const [deleteRequestId, setDeleteRequestId] = useState(null);
    // No confirmed delete endpoint exists yet — a deletion only hides the row for
    // this session rather than persisting server-side.
    const [dismissedIds, setDismissedIds] = useState(() => new Set());
    // 'list' shows the template list + preview; 'create'/'edit' reuse this same
    // modal panel to show the builder form + preview instead of stacking a
    // second modal on top.
    const [viewMode, setViewMode] = useState("list");
    const [builderInitialTemplate, setBuilderInitialTemplate] = useState(null);

    useEffect(() => {
        if (show && templates === null) {
            getTemplateList();
        }
    }, [show, templates, getTemplateList]);

    const normalizedTemplates = useMemo(
        () => (templates ?? []).map(normalizeTemplateSummary).filter((t) => !dismissedIds.has(t.id)),
        [templates, dismissedIds]
    );

    useEffect(() => {
        if (selectedId === null && normalizedTemplates.length > 0) {
            setSelectedId(normalizedTemplates[0].id);
        }
    }, [normalizedTemplates, selectedId]);

    const filteredTemplates = normalizedTemplates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    const selectedTemplate = normalizedTemplates.find((t) => t.id === selectedId) ?? null;
    const activeTab = selectedTemplate?.tabs?.[activeTabIndex] ?? null;
    const hasSubTabs = Array.isArray(activeTab?.subTabs) && activeTab.subTabs.length > 0;
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
        setDismissedIds((prev) => new Set(prev).add(deleteRequestId));
        if (selectedId === deleteRequestId) {
            setSelectedId(null);
            setActiveTabIndex(0);
        }
        setDeleteRequestId(null);
    };

    const handleCreateClick = () => {
        setBuilderInitialTemplate(null);
        setViewMode("create");
    };

    const handleBackToList = () => {
        setViewMode("list");
        getTemplateList();
    };

    const handleEditClick = () => {
        if (!selectedTemplate) return;
        getTemplateById({
            templateId: selectedTemplate.id,
            cb: (detail) => {
                if (!detail) return;
                setBuilderInitialTemplate(detail);
                setViewMode("edit");
            },
        });
    };

    if (!show) return null;

    const topbarTitle = viewMode === "list"
        ? "Custom Templates List"
        : (viewMode === "edit" ? "Edit Custom Template" : "Create Custom Template");

    return (
        <>
            <div className="cardform-overlay ct-modal-overlay">
                    <div className="cardform-panel">
                        <div className="cardform-topbar ctl-modal-topbar">
                            <div>
                                {viewMode !== "list" && (
                                    <button
                                        type="button"
                                        className="ctl-topbar-back-btn"
                                        aria-label="Back to template list"
                                        title="Back to template list"
                                        onClick={handleBackToList}
                                    >
                                        <FiArrowLeft size={16} />
                                    </button>
                                )}
                                <span className="ctl-topbar-title">{topbarTitle}</span>
                            </div>
                            <div className="cardform-topbar-right">
                                <button
                                    type="button"
                                    className="cardform-close-btn"
                                    onClick={viewMode === "list" ? onClose : handleBackToList}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {viewMode === "list" ? (
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
                                            // Live preview — reuses the real kanban card's own shell
                                            // (cardform-topbar/tabs, operation-wrapper/left/right) so the
                                            // template previews pixel-identical to the actual card.
                                            <div className="ct-preview-modal">
                                                <div className="cardform-topbar ct-preview-topbar ctl-preview-topbar">
                                                    <span className="cardform-title">
                                                        {selectedTemplate.name}
                                                        <span className="ctl-preview-topbar-entity"> · Billing Entity: {selectedTemplate.billingEntityLabel}</span>
                                                    </span>
                                                    <div className="cardform-topbar-right">
                                                        <button type="button" className="ctl-preview-edit-btn" onClick={handleEditClick}>
                                                            <FiEdit2 size={13} /> Edit Template
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="cardform-tabs">
                                                    {selectedTemplate.tabs.map((tab, idx) => (
                                                        <button
                                                            key={tab.name}
                                                            type="button"
                                                            className={`tab ${idx === activeTabIndex ? "active" : ""}`}
                                                            onClick={() => handleSelectTab(idx)}
                                                        >
                                                            {tab.name}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="operation-wrapper">
                                                    <div className="operation-content-container">
                                                        {hasSubTabs && (
                                                            <div className="operation-left">
                                                                {activeTab.subTabs.map((sub, idx) => (
                                                                    <button
                                                                        key={sub.name}
                                                                        type="button"
                                                                        className={`op-tab ${idx === activeSubTabIndex ? "active" : ""}`}
                                                                        onClick={() => setActiveSubTabIndex(idx)}
                                                                    >
                                                                        {sub.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="operation-right">
                                                            {fieldsToShow.length > 0 ? (
                                                                <div className="ct-preview-custom-fields-grid">
                                                                    {fieldsToShow.map((field, idx) => (
                                                                        <TemplateFieldPreview key={idx} field={field} />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="ct-summary-no-fields">No fields in this tab.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                    ) : (
                                        <div className="ct-preview-empty">
                                            <p>Select a template from the list to preview its structure.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <TemplateBuilderBody
                                key={viewMode === "edit" ? (selectedTemplate?.id ?? "edit") : "create"}
                                initialTemplate={builderInitialTemplate}
                                onClose={handleBackToList}
                            />
                        )}
                    </div>
            </div>

            {!!deleteRequestId && (
                <DeleteConfirmationModal
                    show={!!deleteRequestId}
                    onCancel={() => setDeleteRequestId(null)}
                    onConfirm={handleConfirmDelete}
                    deleteText="Remove this template from the list? (Not yet permanent — no delete API is wired up.)"
                    className="ctl-delete-confirm-modal"
                    backdropClassName="ctl-delete-confirm-backdrop"
                />
            )}
        </>
    );
}

export default CustomTemplateListModal;
