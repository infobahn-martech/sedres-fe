import { FiSearch } from "react-icons/fi";
import CrewListUploadBox from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/components/CrewListUploadBox";
import CrewUploadDropzones from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/components/CrewUploadDropzones";
import ChecklistTypeBlock from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/checklistTab/ChecklistTypeBlock";
import "../../design/scss/checklist.scss";

const noop = () => {};

const PENDING_CREW_STEPS = {
    crewList: { status: "pending", files: [], progress: 0 },
    passport: { status: "pending", files: [], progress: 0 },
    iqama: { status: "pending", files: [], progress: 0 },
    visa: { status: "pending", files: [], progress: 0 },
};

const DUMMY_CHECKLIST_TREE = [
    {
        id: "preview-sec-a",
        title: "Documents required for import and inward clearence for vessels",
        subSections: [],
        items: [
            {
                id: "preview-item-1",
                title: "Commercial invoice with shipper stamp and sign, for Taxi boat not applicable.",
                requirement: { label: "Req Original" },
                documentDescription: "Original Required",
            },
            {
                id: "preview-item-2",
                title: "Bill of lading - Surrender / Seaway bill, for Taxi boat not applicable.",
                requirement: { label: "Req Copy" },
            },
            {
                id: "preview-item-3",
                title: "Last port Clearance for Tug, Barge, Crew boat",
                requirement: { label: "Req Original" },
                documentDescription: "Original required onboard",
                taskNames: ["Inward Clearance"],
            },
            {
                id: "preview-item-4",
                title: "Stamped crew List from last port COPY SIGNED AND STAMPED BY MASTER",
                requirement: { label: "Req Copy" },
                documentDescription: "Copy signed and stamped by master",
                taskNames: ["Inward Clearance"],
            },
        ],
    },
];

// Read-only replica of CrewImmigrationDashboard's empty state, built from the
// real upload components so the template preview matches the actual card.
function CrewImmigrationPreview() {
    return (
        <div className="husbandry-service-selection">
            <div className="husbandry-service-selection-content">
                <div className="husbandry-service-hero">
                    <div className="crew-mgmt-hero-row">
                        <div className="crew-mgmt-hero-left">
                            <div className="crew-mgmt-hero-text">
                                <h2 className="husbandry-service-selection-title">Crew Immigration</h2>
                            </div>
                            <div className="crew-mgmt-hero-middle crew-immigration-batches">
                                <div className="crew-mgmt-crewlist-block">
                                    <CrewListUploadBox
                                        movementType="crew-list"
                                        movementTypeLabel="Crew List"
                                        status="pending"
                                        onSelectFile={noop}
                                    />
                                    <CrewUploadDropzones
                                        steps={PENDING_CREW_STEPS}
                                        onSelectPassportFiles={noop}
                                        onSelectIqamaFiles={noop}
                                        onSelectVisaFiles={noop}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="crew-uploaded-lists-panel">
                            <div className="crew-uploaded-lists-panel__header">
                                <span className="crew-mgmt-section-label">Uploaded Crew Lists</span>
                            </div>
                            <div className="crew-uploaded-lists-panel__empty">
                                <span className="crew-uploaded-lists-panel__empty-title">No crew lists uploaded yet</span>
                                <span className="crew-uploaded-lists-panel__empty-subtitle">Upload a crew list to get started.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="crew-mgmt-summary-section">
                    <div className="crew-listing-header">
                        <div>
                            <h2 className="crew-listing-title">Crew Listing</h2>
                            <p className="crew-listing-subtitle">Crew documents uploaded so far.</p>
                        </div>
                        <div className="crew-summary-header-actions">
                            <div className="crew-summary-search">
                                <FiSearch size={14} className="crew-summary-search__icon" />
                                <input
                                    type="text"
                                    className="crew-summary-search__input"
                                    placeholder="Search crew name"
                                    readOnly
                                    tabIndex={-1}
                                />
                            </div>
                        </div>
                    </div>
                    <p className="crew-summary-empty">No crew uploaded yet. Upload a crew list to see it here.</p>
                </div>
            </div>
        </div>
    );
}

// Read-only replica of the Check List tab — the real ChecklistTypeBlock fed
// with dummy rows. isViewOnly stays false so the upload/remarks columns
// render as on the real card; the wrapper blocks interaction instead.
function ChecklistPreview() {
    return (
        <>
            <div className="operation-content-header checklist-page-header">
                <h3 className="operation-content-title">Checklist Information</h3>
            </div>
            <div className="checklist-tab-layout checklist-tab-layout--full">
                <div className="checklist-form checklist-form--compact">
                    <div className="checklist-type-group cl-excel-type-group">
                        <ChecklistTypeBlock
                            typeTitle="AL JUBAIL PORT"
                            sectionTree={DUMMY_CHECKLIST_TREE}
                            itemsData={{}}
                            onItemChange={noop}
                            openSections={{}}
                            onSectionToggle={noop}
                            onSelectAll={noop}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

const PREVIEWS = {
    "crew-immigration": CrewImmigrationPreview,
    checklist: ChecklistPreview,
};

function TemplateFeaturePreview({ kind }) {
    const Preview = PREVIEWS[kind];
    if (!Preview) return null;
    return (
        <div className="ctm-feature-preview" aria-hidden="true">
            <Preview />
        </div>
    );
}

export default TemplateFeaturePreview;
