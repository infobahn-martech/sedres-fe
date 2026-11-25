import { useEffect, useMemo, useState } from "react";
import { Spinner } from "react-bootstrap";
import { FiSearch, FiChevronRight, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiAlertCircle, FiRotateCcw, FiFileText } from "react-icons/fi";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { TemplateBuilderBody, buildTabsFromTemplate } from "./CustomTemplateBuilderModal";
import { buildFieldGrid } from "./templateFieldGrid";
import TemplateFieldPreview from "./TemplateFieldPreview";
import TemplateEmailPreview, { TemplateEmailFieldsColumn } from "./TemplateEmailPreview";
import { getEmailPreviewSubject } from "./emailPreviewSubjects";
import TemplateFeaturePreview from "./TemplateFeaturePreview";
import TemplatePreviewSkeleton from "./TemplatePreviewSkeleton";
import { getFeaturePreviewKind } from "./templateFeaturePreviews";
import useFormTemplateReducer from "../../store/FormTemplateReducer";
import "../../design/css/common/CardForm.css";
import "../../design/scss/general.scss";
import "../../design/scss/operations.scss";
import "../../design/scss/pages/callTypeBuilder.scss";
import "../../design/scss/pages/customTemplateBuilder.scss";
import "../../design/scss/pages/customTemplateList.scss";

// Normalizes a raw form_template/list item (template_name/tab_count, tabs in
// the API's own tab_label/field_label/... shape) into the shape this modal's
// list/preview UI and TemplateFieldPreview already render.
const normalizeTemplateSummary = (tpl) => ({
    id: tpl.templateId ?? tpl.template_id,
    name: tpl.name ?? tpl.template_name ?? "",
    tabCount: tpl.tabCount ?? tpl.tab_count ?? tpl.tabs?.length ?? 0,
    tabs: buildTabsFromTemplate(tpl),
});

const SKELETON_CARD_COUNT = 6;

// Placeholder list cards shown while the template list loads for the first time.
function TemplateListSkeleton() {
    return (
        <div className="ctl-template-list" aria-hidden="true">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                <div key={i} className="ctl-template-card ctl-skeleton-card">
                    <span className="ctl-bone ctl-bone--check" />
                    <div className="ctl-template-card-body">
                        <span className="ctl-bone ctl-bone--name" style={{ width: `${70 - (i % 3) * 12}%` }} />
                        <span className="ctl-bone ctl-bone--meta" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function TemplateListCard({ template, isActive, isDeleting, deleteDisabled, onSelect, onDelete }) {
    const { tabCount } = template;
    return (
        <div
            className={`ctl-template-card ${isActive ? "is-active" : ""} ${isDeleting ? "is-deleting" : ""}`}
            onClick={isDeleting ? undefined : onSelect}
            aria-busy={isDeleting || undefined}
        >
            <span className={`ctl-template-checkbox ${isActive ? "is-checked" : ""}`} aria-hidden="true" />
            <div className="ctl-template-card-body">
                <span className="ctl-template-name">{template.name}</span>
                <span className="ctl-template-meta">
                    {tabCount} tab{tabCount === 1 ? "" : "s"}
                </span>
            </div>
            <button
                type="button"
                className="ctl-template-delete-btn"
                aria-label={isDeleting ? "Deleting template" : "Delete template"}
                disabled={deleteDisabled}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
                {isDeleting
                    ? <Spinner animation="border" size="sm" className="ctl-inline-spinner" />
                    : <FiTrash2 size={14} />}
            </button>
            <FiChevronRight size={16} className="ctl-template-arrow" />
        </div>
    );
}

function CustomTemplateListModal({ show, onClose }) {
    const {
        getTemplateList, templates, isLoadingTemplates,
        getTemplateById, isLoadingTemplateDetail,
        deleteTemplate, isDeleting,
    } = useFormTemplateReducer((s) => s);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [activeSubTabIndex, setActiveSubTabIndex] = useState(0);
    const [deleteRequestId, setDeleteRequestId] = useState(null);
    // The template whose delete request is in flight (cleared by the store's isDeleting).
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    // Set once the first list request goes out, so a failed load (templates still
    // null, nothing loading) can be told apart from the moment before it starts.
    const [hasRequestedList, setHasRequestedList] = useState(templates !== null);
    // 'list' shows the template list + preview; 'create'/'edit' reuse this same
    // modal panel to show the builder form + preview instead of stacking a
    // second modal on top.
    const [viewMode, setViewMode] = useState("list");
    const [builderInitialTemplate, setBuilderInitialTemplate] = useState(null);

    useEffect(() => {
        if (show && templates === null) {
            setHasRequestedList(true);
            getTemplateList();
        }
    }, [show, templates, getTemplateList]);

    // First load shows skeletons; a later refresh (after save/delete) keeps the
    // current list on screen with a slim progress bar instead.
    const isInitialLoading = templates === null && (isLoadingTemplates || !hasRequestedList);
    const isRefreshing = isLoadingTemplates && templates !== null;
    const loadFailed = templates === null && hasRequestedList && !isLoadingTemplates;
    const deletingId = isDeleting ? pendingDeleteId : null;

    const normalizedTemplates = useMemo(
        () => (templates ?? []).map((tpl) => normalizeTemplateSummary(tpl)),
        [templates]
    );

    useEffect(() => {
        if (selectedId === null && normalizedTemplates.length > 0) {
            setSelectedId(normalizedTemplates[0].id);
        }
    }, [normalizedTemplates, selectedId]);

    const query = searchQuery.trim().toLowerCase();
    const filteredTemplates = query
        ? normalizedTemplates.filter((t) => t.name.toLowerCase().includes(query))
        : normalizedTemplates;
    const selectedTemplate = normalizedTemplates.find((t) => t.id === selectedId) ?? null;
    const activeTab = selectedTemplate?.tabs?.[activeTabIndex] ?? null;
    const hasSubTabs = Array.isArray(activeTab?.subTabs) && activeTab.subTabs.length > 0;
    const activeSubTab = hasSubTabs ? (activeTab.subTabs[activeSubTabIndex] ?? activeTab.subTabs[0]) : null;
    const fieldsToShow = hasSubTabs ? (activeSubTab?.fields ?? []) : (activeTab?.fields ?? []);
    const emailSubject = getEmailPreviewSubject(activeTab?.name, activeSubTab?.name);
    const featurePreviewKind = getFeaturePreviewKind(activeTab?.name, activeSubTab?.name);

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
        const templateId = deleteRequestId;
        setDeleteRequestId(null);
        setPendingDeleteId(templateId);
        deleteTemplate({
            templateId,
            cb: () => {
                if (selectedId === templateId) {
                    setSelectedId(null);
                    setActiveTabIndex(0);
                    setActiveSubTabIndex(0);
                }
                getTemplateList();
            },
        });
    };

    const handleCreateClick = () => {
        setBuilderInitialTemplate(null);
        setViewMode("create");
    };

    const handleBackToList = () => setViewMode("list");

    // Only a successful save changes the list, so only then is it re-fetched.
    const handleSaved = () => {
        setViewMode("list");
        getTemplateList();
    };

    const handleEditClick = () => {
        if (!selectedTemplate || isLoadingTemplateDetail) return;
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

                                    <div className="ct-split-scroll-area ctl-list-scroll" aria-busy={isLoadingTemplates || undefined}>
                                        {isRefreshing && <div className="ctl-list-progress" role="progressbar" aria-label="Refreshing templates" />}
                                        {isInitialLoading ? (
                                            <TemplateListSkeleton />
                                        ) : loadFailed ? (
                                            <div className="ctl-list-state" role="alert">
                                                <FiAlertCircle size={22} className="ctl-list-state-icon is-error" />
                                                <p>Couldn&apos;t load templates.</p>
                                                <button type="button" className="ctl-retry-btn" onClick={() => getTemplateList()}>
                                                    <FiRotateCcw size={13} /> Retry
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="ctl-template-list">
                                                {filteredTemplates.length === 0 ? (
                                                    query ? (
                                                        <p className="ctl-list-empty">No templates match &ldquo;{searchQuery.trim()}&rdquo;.</p>
                                                    ) : (
                                                        <div className="ctl-list-state">
                                                            <FiFileText size={22} className="ctl-list-state-icon" />
                                                            <p>No custom templates yet.</p>
                                                        </div>
                                                    )
                                                ) : (
                                                    filteredTemplates.map((tpl) => (
                                                        <TemplateListCard
                                                            key={tpl.id}
                                                            template={tpl}
                                                            isActive={tpl.id === selectedId}
                                                            isDeleting={tpl.id === deletingId}
                                                            deleteDisabled={isDeleting}
                                                            onSelect={() => handleSelectTemplate(tpl.id)}
                                                            onDelete={() => setDeleteRequestId(tpl.id)}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="ct-split-right ctl-preview-panel">
                                    {isInitialLoading ? (
                                        <TemplatePreviewSkeleton />
                                    ) : selectedTemplate ? (
                                            // Live preview — reuses the real kanban card's own shell
                                            // (cardform-topbar/tabs, operation-wrapper/left/right) so the
                                            // template previews pixel-identical to the actual card.
                                            <div className="ct-preview-modal">
                                                <div className="cardform-topbar ct-preview-topbar ctl-preview-topbar">
                                                    <span className="cardform-title">
                                                        {selectedTemplate.name}
                                                    </span>
                                                    <div className="cardform-topbar-right">
                                                        <button
                                                            type="button"
                                                            className="ctl-preview-edit-btn"
                                                            onClick={handleEditClick}
                                                            disabled={isLoadingTemplateDetail}
                                                            aria-busy={isLoadingTemplateDetail || undefined}
                                                        >
                                                            {isLoadingTemplateDetail ? (
                                                                <><Spinner animation="border" size="sm" className="ctl-inline-spinner" /> Opening...</>
                                                            ) : (
                                                                <><FiEdit2 size={13} /> Edit Template</>
                                                            )}
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

                                                        <div className={`operation-right${featurePreviewKind ? " operation-right--feature-preview" : ""}`}>
                                                            {featurePreviewKind ? (
                                                                <TemplateFeaturePreview kind={featurePreviewKind} />
                                                            ) : emailSubject ? (
                                                                <div className="ct-preview-custom-fields-grid ctm-email-split">
                                                                    <div className="ctm-email-fields">
                                                                        {fieldsToShow.length > 0
                                                                            ? <TemplateEmailFieldsColumn fields={fieldsToShow} />
                                                                            : <p className="ct-summary-no-fields">No fields in this tab.</p>}
                                                                    </div>
                                                                    <TemplateEmailPreview subject={emailSubject} />
                                                                </div>
                                                            ) : fieldsToShow.length > 0 ? (
                                                                <div className="ct-preview-custom-fields-grid">
                                                                    {buildFieldGrid(fieldsToShow).map(({ key, index }) => (
                                                                        index === null
                                                                            ? <div key={key} className="ctm-preview-empty-cell" />
                                                                            : <TemplateFieldPreview key={key} field={fieldsToShow[index]} />
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
                                            <FiFileText size={28} />
                                            <p>
                                                {normalizedTemplates.length
                                                    ? "Select a template from the list to preview its structure."
                                                    : "Create a custom template to see its preview here."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <TemplateBuilderBody
                                key={viewMode === "edit" ? (selectedTemplate?.id ?? "edit") : "create"}
                                initialTemplate={builderInitialTemplate}
                                onClose={handleBackToList}
                                onSaved={handleSaved}
                            />
                        )}
                    </div>
            </div>

            {!!deleteRequestId && (
                <DeleteConfirmationModal
                    show={!!deleteRequestId}
                    onCancel={() => setDeleteRequestId(null)}
                    onConfirm={handleConfirmDelete}
                    deleteText="Are you sure you want to delete this template?"
                    className="ctl-delete-confirm-modal"
                    backdropClassName="ctl-delete-confirm-backdrop"
                />
            )}
        </>
    );
}

export default CustomTemplateListModal;
