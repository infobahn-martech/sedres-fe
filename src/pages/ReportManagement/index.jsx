import { useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import { ViewReportModal } from "./Modals/ViewReport";
import ReportManagementDocumentLibrary from "./tabs/DocumentLibrary";
import ReportManagementComments from "./tabs/Comments";
import "../../design/scss/attachments.scss";
import "../../design/scss/pages/report-management/ReportManagement.scss";

/* ── Mock data ──────────────────────────────────────────────── */

const initialReports = [
    {
        _id: "1",
        reportName: "Monthly Operations Report",
        reportType: "Operations",
        callType: "Import",
        generatedDate: "2024-01-15",
        generatedBy: "Admin User",
        status: "Completed",
        format: "PDF",
        size: "2.5 MB",
        description: "Monthly operations summary",
    },
    {
        _id: "2",
        reportName: "Crew Attendance Report",
        reportType: "Crew",
        callType: "Export",
        generatedDate: "2024-01-14",
        generatedBy: "HR Manager",
        status: "Completed",
        format: "Excel",
        size: "1.2 MB",
        description: "Crew attendance for January",
    },
    {
        _id: "3",
        reportName: "Vessel Inspection Report",
        reportType: "Inspection",
        callType: "Import",
        generatedDate: "2024-01-13",
        generatedBy: "Inspector",
        status: "Pending",
        format: "PDF",
        size: "3.1 MB",
        description: "Vessel inspection results",
    },
    {
        _id: "4",
        reportName: "Financial Summary",
        reportType: "Finance",
        callType: "Transit",
        generatedDate: "2024-01-12",
        generatedBy: "Finance Team",
        status: "Completed",
        format: "PDF",
        size: "4.8 MB",
        description: "Q4 financial summary",
    },
    {
        _id: "5",
        reportName: "Port Activity Log",
        reportType: "Operations",
        callType: "Export",
        generatedDate: "2024-01-11",
        generatedBy: "Port Manager",
        status: "Completed",
        format: "CSV",
        size: "0.9 MB",
        description: "Daily port activities",
    },
    {
        _id: "6",
        reportName: "Maintenance Schedule",
        reportType: "Maintenance",
        callType: "Import",
        generatedDate: "2024-01-10",
        generatedBy: "Maintenance Team",
        status: "In Progress",
        format: "Excel",
        size: "1.5 MB",
        description: "Monthly maintenance schedule",
    },
    {
        _id: "7",
        reportName: "Safety Compliance Report",
        reportType: "Safety",
        callType: "Transit",
        generatedDate: "2024-01-09",
        generatedBy: "Safety Officer",
        status: "Completed",
        format: "PDF",
        size: "2.3 MB",
        description: "Safety compliance checklist",
    },
    {
        _id: "8",
        reportName: "Inventory Status",
        reportType: "Inventory",
        callType: "Export",
        generatedDate: "2024-01-08",
        generatedBy: "Warehouse Manager",
        status: "Completed",
        format: "Excel",
        size: "1.8 MB",
        description: "Current inventory levels",
    },
];

const CARD_COLOR = "#2A00FF";
const TABS = ["Reports", "Document Library", "Comments"];

/* ── helpers ──────────────────────────────────────────────────── */

const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const month = date.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
};

const getFormatIcon = (format = "") => {
    const f = format.toLowerCase();
    if (f === "pdf") {
        return (
            <div className="file-icon-default">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="6" fill="#DC2626" />
                    <text x="16" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">PDF</text>
                </svg>
            </div>
        );
    }
    if (f === "excel" || f === "xlsx" || f === "csv") {
        return (
            <div className="file-icon-default">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="6" fill="#16A34A" />
                    <text x="16" y="22" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">XLS</text>
                </svg>
            </div>
        );
    }
    return (
        <div className="file-icon-default">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="#2563EB" />
                <path d="M8 10h16M8 16h12M8 22h14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        </div>
    );
};

/* ── ReportRow ────────────────────────────────────────────────── */

const ReportRow = ({ report, onView }) => {
    const metaParts = [
        formatDate(report.generatedDate),
        report.generatedBy ? `by ${report.generatedBy}` : null,
        report.status ? `Status: ${report.status}` : null,
        report.size ? report.size : null,
    ].filter(Boolean);

    return (
        <div className="attachment-item">
            <div className="attachment-icon-wrapper">
                {getFormatIcon(report.format)}
            </div>
            <div className="attachment-details">
                <div className="attachment-name">{report.reportName || "N/A"}</div>
                <div className="attachment-meta">
                    {metaParts.map((part, i) => (
                        <span key={`${part}-${i}`}>
                            {i > 0 && <span className="attachment-separator">•</span>}
                            <span className="attachment-date">{part}</span>
                        </span>
                    ))}
                    {report.callType && (
                        <span>
                            <span className="attachment-separator">•</span>
                            <span
                                className={`report-call-type-badge report-call-type-badge--${report.callType.toLowerCase()}`}
                            >
                                {report.callType}
                            </span>
                        </span>
                    )}
                </div>
            </div>
            <div className="attachment-actions">
        <button
            type="button"
            className="attachment-action-btn view"
            title="View report"
            style={{ "--card-color": CARD_COLOR }}
            onClick={() => onView(report)}
        >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                    d="M9 4C5 4 2.27 6.11 1 9C2.27 11.89 5 14 9 14C13 14 15.73 11.89 17 9C15.73 6.11 13 4 9 4Z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        </button>
        <button
            type="button"
            className="attachment-action-btn download"
            title="Download"
            style={{ "--card-color": CARD_COLOR }}
            onClick={() => console.log("Download", report.reportName)}
        >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                    d="M9 12V3M9 12L6 9M9 12L12 9M3 15H15"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
            </svg>
        </button>
    </div>
        </div >
    );
};

/* ── Reports tab ──────────────────────────────────────────────── */

const ReportsTab = ({ reports, searchTerm, onView }) => {
    const groupedByType = useMemo(() => {
        const filtered = reports.filter((r) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                r.reportName?.toLowerCase().includes(term) ||
                r.reportType?.toLowerCase().includes(term) ||
                r.callType?.toLowerCase().includes(term) ||
                r.generatedBy?.toLowerCase().includes(term)
            );
        });
        const map = {};
        filtered.forEach((r) => {
            const key = r.reportType || "Other";
            if (!map[key]) map[key] = [];
            map[key].push(r);
        });
        return map;
    }, [reports, searchTerm]);

    const categoryKeys = useMemo(
        () => Object.keys(groupedByType).sort((a, b) => a.localeCompare(b)),
        [groupedByType]
    );

    const totalCount = Object.values(groupedByType).reduce((s, arr) => s + arr.length, 0);

    return (
        <div className="attachments-content-wrapper rm-list-panel" style={{ "--card-color": CARD_COLOR }}>
            <div className="attachments-list-header">
                <h3 className="attachments-list-title">
                    <span className="attachments-list-title-bar" />
                    REPORT LIST
                </h3>
                <span className="attachments-section-badge">{totalCount}</span>
            </div>

            {totalCount === 0 ? (
                <div className="attachments-empty-state">
                    <p>No reports found.</p>
                </div>
            ) : (
                <div className="attachments-list">
                    <div className="attachments-categories">
                        {categoryKeys.map((category) => {
                            const items = groupedByType[category];
                            if (!items?.length) return null;
                            return (
                                <div className="attachment-category" key={category}>
                                    <div className="attachment-category-header">
                                        <h4 className="attachment-category-label">{category}</h4>
                                        <span className="attachment-category-count">({items.length})</span>
                                    </div>
                                    <div className="attachments-items">
                                        {items.map((report) => (
                                            <ReportRow
                                                key={report._id}
                                                report={report}
                                                onView={onView}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Main page ────────────────────────────────────────────────── */

const ReportManagement = () => {
    const [reports] = useState(initialReports);
    const [activeTab, setActiveTab] = useState("Reports");
    const [viewModal, setViewModal] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Report Management"
                            isAddEnabled={false}
                            addModalLabel="Add Report"
                            setSearch={(e) => setSearchTerm(e)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    {/* ── Tabs ── */}
                    <div className="container-fluid mt-3">
                        <div className="rm-tabs-bar">
                            {TABS.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`rm-tab-btn${activeTab === tab ? " rm-tab-btn--active" : ""}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* ── Tab content ── */}
                        <div className="rm-tab-content">
                            {activeTab === "Reports" && (
                                <ReportsTab
                                    reports={reports}
                                    searchTerm={searchTerm}
                                    onView={setViewModal}
                                />
                            )}
                            {activeTab === "Document Library" && (
                                <ReportManagementDocumentLibrary />
                            )}
                            {activeTab === "Comments" && (
                                <ReportManagementComments />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!!viewModal && (
                <ViewReportModal
                    showModal={viewModal}
                    closeModal={() => setViewModal(null)}
                />
            )}
        </>
    );
};

export default ReportManagement;
