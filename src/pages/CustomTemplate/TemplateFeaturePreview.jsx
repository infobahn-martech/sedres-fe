import { FiSearch } from "react-icons/fi";
import CrewListUploadBox from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/components/CrewListUploadBox";
import CrewUploadDropzones from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/components/CrewUploadDropzones";
import ChecklistTypeBlock from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/checklistTab/ChecklistTypeBlock";
import DocumentLibrary from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/DocumentLibrary";
import Comments from "../KanbanBoard/CardFormTabs/Import/tabs/comments/Comments";
import Subtasks from "../KanbanBoard/CardFormTabs/Import/tabs/subTasks/SubTasks";
import Notes from "../KanbanBoard/CardFormTabs/Import/tabs/notes/Notes";
import { ServiceSelection } from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/Husbandry";
import { CREW_MANAGEMENT_SUBTABS } from "../KanbanBoard/CardFormTabs/Import/tabs/husbandry/components/Husbandry.constants";
import SalesOrderList from "../KanbanBoard/CardFormTabs/Import/tabs/salesOrder/SalesOrderList";
import { ReportsLibrary } from "../KanbanBoard/CardFormTabs/Import/tabs/reports/Reports";
import ActivityLog from "../KanbanBoard/CardFormTabs/Import/tabs/activityLog/ActivityLog";
import Approval from "../KanbanBoard/CardFormTabs/Export/tabs/approval/Approval";
import { mapSalesOrderResponse } from "../../shared/helpers/mapSalesOrderResponse";
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

const PREVIEW_CARD_COLOR = "#00368c";

const HUSBANDRY_SERVICES_SUMMARY = {
    categories: {
        crew_change: { sign_on: 8, sign_off: 0 },
        material_management: { inbound: 1, dispatch: 0 },
        waste_disposal: { total: 1 },
        launch_hire: { total: 0 },
        mwp_renewal: { total: 1 },
        third_party_service: { total: 0 },
    },
};

const HUSBANDRY_CREW_SERVICE_COUNTS = {
    [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: 1,
    [CREW_MANAGEMENT_SUBTABS.CG_PASS]: 0,
    [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: 1,
    [CREW_MANAGEMENT_SUBTABS.HOTEL]: 1,
    [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: 0,
};

// Sample call_file/get_requests_by_service `data` for the dashboard chart.
const HUSBANDRY_REQUESTS_BY_SERVICE = {
    total_requests: 19,
    services: [
        { title: "Crew Management", count: 8, percentage: 42 },
        { title: "Material Management", count: 2, percentage: 11 },
        { title: "Waste Disposal", count: 3, percentage: 16 },
        { title: "Launch Hire", count: 2, percentage: 11 },
        { title: "MWP Renewal", count: 1, percentage: 5 },
        { title: "Third-Party Services", count: 2, percentage: 11 },
        { title: "Add-on Services", count: 1, percentage: 5 },
    ],
    crew_management: {
        total_requests: 8,
        breakdown: [
            { title: "Zawil Pass", count: 2 },
            { title: "CG Pass", count: 1 },
            { title: "Transport", count: 3 },
            { title: "Hotel", count: 1 },
            { title: "Medical", count: 1 },
            { title: "Launch Hire", count: 0 },
        ],
    },
};

// Sample call_file/get_service_history `data` for the Recent History panel.
const HUSBANDRY_SERVICE_HISTORY = {
    total_updates: 3,
    history: [
        { service: "Zawil Pass", request_id: 1, status: "Issued", status_group: "Completed", description: "Zawil pass issued for 2 crew", user_name: "Ahmed", user_role: "Operations", activity_date: "2026-06-14 11:20:00" },
        { service: "Transport", request_id: 2, status: "Pending", status_group: "Pending", description: "Transport request created for 4 crew", user_name: "Shalman", user_role: "Operator", activity_date: "2026-06-14 10:42:00" },
        { service: "Material Management", request_id: 3, status: "submitted", status_group: "Pending", description: "Inbound order #IO-2031 received", user_name: "Ahmed", user_role: "Operations", activity_date: "2026-06-14 09:15:00" },
    ],
};

// Sample sales order in the API's own shape, run through the card's real
// mapper so SalesOrderList receives exactly what it gets on a live card.
const SAMPLE_SALES_ORDER = mapSalesOrderResponse({
    customer_code: "C10023",
    customer_name: "Horizon Shipping Co.",
    contact_person: "John Smith",
    contact_email: "john@horizon.com",
    currency: "SAR",
    port: "Ras Tanura",
    branch: "Dammam",
    sales_order_no: "SO-000231",
    sales_order_date: "2026-06-14",
    ship_name: "Sample Vessel 2000",
    project_name: "Crew Change - June",
    so_status: "Open",
    srt_number: "SRT-2026-0142",
    subtotal: 525,
    total_discount: 0,
    total_tax: 78.75,
    grand_total: 603.75,
    items: [
        { so_item_id: 1, item_code: "OFM0076", item_name: "Road Transport for Agent", quantity: 1, unit_price: 175, total_price: 201.25, discount_percentage: 0, tax_percentage: 15 },
        { so_item_id: 2, item_code: "OFM0112", item_name: "Launch Hire - Crew Transfer", quantity: 2, unit_price: 175, total_price: 402.5, discount_percentage: 0, tax_percentage: 15 },
    ],
});

const SAMPLE_REPORT_BODY = "<p>Dear Sir/Madam,</p><p>Please find below the latest status for <strong>Sample Vessel 2000</strong> at Ras Tanura.</p><p>Best regards,<br/>Operations Team</p>";

const SAMPLE_REPORTS = [
    { id: "r1", reportType: "Pre Arrival", subject: "Report - Pre Arrival - Sample Vessel 2000", createdAt: "2026-06-12 09:30:00" },
    { id: "r2", reportType: "Arrival", subject: "Report - Arrival - Sample Vessel 2000", createdAt: "2026-06-14 17:30:00" },
    { id: "r3", reportType: "Departure", subject: "Report - Departure - Sample Vessel 2000", createdAt: "2026-06-16 11:05:00" },
].map((report) => ({
    ...report,
    body: SAMPLE_REPORT_BODY,
    fromEmail: "noreply@sedres.com",
    toEmail: "agent@example.com",
    ccEmails: "operations@example.com",
    createdBy: "Operations",
}));

// Sample card activity in the activity API's own row shape, newest first.
const SAMPLE_ACTIVITY = [
    {
        type: "move",
        action: "card_moved",
        user_name: "Operations",
        created_date: "2026-06-16 06:54:00",
        details: { from_column: "Sailed / Awaiting 3rd party invoices", to_column: "SO Approved" },
    },
    {
        type: "update",
        action: "card_updated",
        user_name: "Operations",
        created_date: "2026-06-14 17:30:00",
        description: "Updated the vessel's ETD",
    },
    {
        type: "move",
        action: "card_moved",
        user_name: "Operations",
        created_date: "2026-06-12 13:36:00",
        details: { from_column: "New Request", to_column: "Sailed / Awaiting 3rd party invoices" },
    },
];

// The real card's Husbandry dashboard (services, requests chart, history).
const HusbandryPreview = () => (
    <ServiceSelection
        onSelectService={noop}
        cardColor={PREVIEW_CARD_COLOR}
        servicesSummary={HUSBANDRY_SERVICES_SUMMARY}
        crewServiceCounts={HUSBANDRY_CREW_SERVICE_COUNTS}
        requestsByService={HUSBANDRY_REQUESTS_BY_SERVICE}
        serviceHistory={HUSBANDRY_SERVICE_HISTORY}
        salesOrder={SAMPLE_SALES_ORDER}
    />
);

// The real card's Sales Order list, read-only, fed with the sample order.
const SalesOrderPreview = () => (
    <SalesOrderList
        card={{}}
        formValues={SAMPLE_SALES_ORDER}
        handleChange={() => noop}
        cardColor={PREVIEW_CARD_COLOR}
        readOnly
    />
);

// The real card's report list + preview pane, fed with sample sent reports.
const ReportsPreview = () => (
    <div className="cardform-body">
        <div className="cardform-left-full reports-view" style={{ "--card-color": PREVIEW_CARD_COLOR }}>
            <ReportsLibrary reports={SAMPLE_REPORTS} />
        </div>
    </div>
);

// Real tab components rendered without a card id: they skip loading card data
// and show their own empty/sample state, as the Call Type builder preview does.
const DocumentLibraryPreview = () => <DocumentLibrary card={{ color: PREVIEW_CARD_COLOR }} />;
const CommentsPreview = () => <Comments card={{ comments: [] }} />;
const SubtasksPreview = () => <Subtasks card={{}} />;
const NotesPreview = () => <Notes card={{ notes: [] }} />;

const ActivityLogPreview = () => <ActivityLog card={{}} sampleEntries={SAMPLE_ACTIVITY} />;

// Sample export approval in the get_details shape. Both stages are proceeded so
// all three party cards and the Credit Controller / Manager / CEO cards render.
const SAMPLE_EXPORT_APPROVAL = {
    basic_details: {},
    vessel_owner: {
        owner_details: "PJS OFFSHORE",
        no_of_vessels_chartered: 120,
    },
    vessel_principal: {
        principal_details: "MCD",
        no_of_vessels_chartered: 130,
    },
    vessel_charterer: {
        charterer_details: "Dialog Jubail Supply Base Co. Ltd.",
        no_of_vessels_chartered: 132,
    },
    credit_controller: {
        status: "proceed_to_operator",
        remarks: "Credit history verified. Recommended for approval.",
    },
    manager_ofm: {
        status: "proceed_to_ceo",
        comments: "Reviewed and forwarded to the CEO.",
    },
    ceo: {
        status: null,
        comments: "",
    },
    documents: {},
};

// The real card's Export Approval tab in preview mode: previewDetails replaces
// the store, and with no call id it skips every fetch and save.
const ExportApprovalPreview = () => <Approval card={{}} previewDetails={SAMPLE_EXPORT_APPROVAL} />;

const PREVIEWS = {
    "export-approval": ExportApprovalPreview,
    "crew-immigration": CrewImmigrationPreview,
    checklist: ChecklistPreview,
    husbandry: HusbandryPreview,
    "sales-order": SalesOrderPreview,
    reports: ReportsPreview,
    "document-library": DocumentLibraryPreview,
    comments: CommentsPreview,
    subtasks: SubtasksPreview,
    notes: NotesPreview,
    "activity-log": ActivityLogPreview,
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
