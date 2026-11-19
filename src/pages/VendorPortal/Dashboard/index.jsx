import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiShoppingCart,
    FiCheckCircle,
    FiClock,
    FiList,
    FiUpload,
    FiChevronRight,
} from 'react-icons/fi';
import '../../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../../design/scss/vendor-portal.scss';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';
import CustomModal from '../../../components/CustomModal';
import DateTimePickerField from "@/pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";

// Mock data – replace with API later
const MOCK_SUMMARY = {
    totalBookings: 24,
    completedBookings: 16,
    pendingBookings: 8,
};

const MOCK_INVOICE_STATUS = {
    submitted: 18,
    pending: 5,
    completed: 7,
};

const MOCK_RECENT_INVOICES = [
    { invoiceNo: 'INV-2024-101', refNo: 'WO-8842', company: 'Sedres Ltd', type: 'Service', amount: '3,200', currency: 'SAR', date: '12 Mar 2025', status: 'Approved' },
    { invoiceNo: 'INV-2024-100', refNo: 'WO-8839', company: 'Marine Services Co', type: 'Provisions', amount: '1,850', currency: 'SAR', date: '10 Mar 2025', status: 'Approved' },
    { invoiceNo: 'INV-2024-099', refNo: 'WO-8835', company: 'Sedres Ltd', type: 'Transport', amount: '5,100', currency: 'SAR', date: '08 Mar 2025', status: 'Paid' },
    { invoiceNo: 'INV-2024-098', refNo: 'WO-8830', company: 'Port Authority', type: 'Agency', amount: '2,400', currency: 'SAR', date: '05 Mar 2025', status: 'Rejected' },
    { invoiceNo: 'INV-2024-097', refNo: 'WO-8828', company: 'Marine Services Co', type: 'Launch hire', amount: '4,200', currency: 'SAR', date: '03 Mar 2025', status: 'Paid' },
];

const MOCK_RECENT_ORDERS = [
    {
        orderNo: 'PO-2205',
        workOrderNo: 'WO-2205',
        company: 'Sedres Ltd',
        orderDate: '10 Mar 2025',
        purchaser: 'J. Smith',
        subject: 'Launch hire – Port A',
        amount: '2,500',
        currency: 'SAR',
        status: 'In progress',
        crewDetails: [
            {
                name: 'Amina Al-Khalifa',
                rank: 'Chief Engineer',
                nationality: 'Bahrain',
                passport: 'BA1234567',
                visa: 'VISA-BA-7781',
                iqama: '2123456789',
                checkIn: '2025-03-10T08:00',
                checkOut: '2025-03-15T18:00',
            },
            {
                name: 'Omar Hassan',
                rank: 'Able Seaman',
                nationality: 'Oman',
                passport: 'OM9988776',
                visa: 'VISA-OM-4420',
                iqama: '2987654321',
                checkIn: '2025-03-10T09:30',
                checkOut: '2025-03-14T17:00',
            },
        ],
    },
    {
        orderNo: 'PO-2203',
        workOrderNo: 'WO-2203',
        company: 'Marine Services Co',
        orderDate: '08 Mar 2025',
        purchaser: 'M. Jones',
        subject: 'Transport – Crew transfer',
        amount: '1,200',
        currency: 'SAR',
        status: 'In progress',
        crewDetails: [
            {
                name: 'Lina Rodriguez',
                rank: 'Cook',
                nationality: 'Philippines',
                passport: 'PH3344556',
                visa: 'VISA-PH-1102',
                iqama: '2456123789',
                checkIn: '2025-03-08T07:00',
                checkOut: '2025-03-20T19:00',
            },
            {
                name: 'Ravi Patel',
                rank: 'Deck Officer',
                nationality: 'India',
                passport: 'IN7788990',
                visa: 'VISA-IN-2209',
                iqama: '2567890123',
                checkIn: '2025-03-08T10:15',
                checkOut: '2025-03-18T16:45',
            },
        ],
    },
    {
        orderNo: 'PO-2200',
        workOrderNo: 'WO-2200',
        company: 'Sedres Ltd',
        orderDate: '05 Mar 2025',
        purchaser: 'K. Brown',
        subject: 'Provisions supply',
        amount: '3,800',
        currency: 'SAR',
        status: 'In progress',
        crewDetails: [
            {
                name: 'Samir El-Masri',
                rank: 'Electrician',
                nationality: 'Egypt',
                passport: 'EG4455667',
                visa: 'VISA-EG-9003',
                iqama: '2345678901',
                checkIn: '2025-03-05T06:00',
                checkOut: '2025-03-25T12:00',
            },
        ],
    },
    {
        orderNo: 'PO-2197',
        workOrderNo: 'WO-2197',
        company: 'Port Authority',
        orderDate: '03 Mar 2025',
        purchaser: 'J. Smith',
        subject: 'Agency services',
        amount: '950',
        currency: 'SAR',
        status: 'In progress',
        crewDetails: [
            {
                name: 'Noah Wilson',
                rank: 'Master',
                nationality: 'United Kingdom',
                passport: 'GB1230098',
                visa: 'VISA-UK-3157',
                iqama: '2011122233',
                checkIn: '2025-03-03T14:00',
                checkOut: '2025-03-12T09:00',
            },
            {
                name: 'Fatima Zahra',
                rank: 'Steward',
                nationality: 'Morocco',
                passport: 'MA6600221',
                visa: 'VISA-MA-8842',
                iqama: '2678901234',
                checkIn: '2025-03-03T15:30',
                checkOut: '2025-03-11T11:00',
            },
        ],
    },
    {
        orderNo: 'PO-2195',
        workOrderNo: 'WO-2195',
        company: 'Marine Services Co',
        orderDate: '01 Mar 2025',
        purchaser: 'M. Jones',
        subject: 'Fresh water supply',
        amount: '600',
        currency: 'SAR',
        status: 'In progress',
        crewDetails: [
            {
                name: 'Ehsan Karim',
                rank: 'Fitter',
                nationality: 'Iran',
                passport: 'IR5566778',
                visa: 'VISA-IR-7014',
                iqama: '2789012345',
                checkIn: '2025-03-01T05:45',
                checkOut: '2025-03-28T22:00',
            },
        ],
    },
];

function UploadInvoiceModal({ show, closeModal, orderNo, onUploadComplete }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;
        setSelectedFiles([]);
        setIsUploading(false);
        setIsDragging(false);
        setError('');
    }, [show, orderNo]);

    const handleAddFiles = (filesLike) => {
        const files = Array.from(filesLike || []);
        if (!files.length) return;
        setSelectedFiles((prev) => [...prev, ...files]);
        setError('');
    };

    const handleRemoveIndex = (idx) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const renderSelected = useMemo(() => {
        if (!selectedFiles.length) return null;
        return (
            <div className="file-drop-zone__selected" style={{ justifyContent: 'flex-start' }}>
                {selectedFiles.slice(0, 3).map((f, idx) => (
                    <span key={`${f.name}-${idx}`} className="d-inline-flex align-items-center gap-2">
                        <span className="file-drop-zone__name">{f.name}</span>
                        <button
                            type="button"
                            className="file-drop-zone__clear"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveIndex(idx);
                            }}
                            aria-label={`Remove ${f.name}`}
                        >
                            Remove
                        </button>
                    </span>
                ))}
                {selectedFiles.length > 3 && (
                    <small className="text-muted" style={{ marginLeft: 8 }}>
                        +{selectedFiles.length - 3} more
                    </small>
                )}
            </div>
        );
    }, [selectedFiles]);

    const renderHeader = () => (
        <h1 className="modal-title">Upload Invoice</h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <div className="row">
                    <div className="col-md-12 mb-lg-3 mb-sm-0">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <label className="form-label mb-0">
                                Attach invoices <span className="text-danger">*</span>
                            </label>
                            <small className="text-muted">Order: {orderNo}</small>
                        </div>

                        <div className="file-drop-zone-wrapper">
                            <div
                                className={`file-drop-zone ${isDragging ? 'file-drop-zone--active' : ''} ${error ? 'file-drop-zone--error' : ''}`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    handleAddFiles(e.dataTransfer?.files);
                                }}
                                onClick={() => document.getElementById('upload-invoice-input').click()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        document.getElementById('upload-invoice-input').click();
                                    }
                                }}
                            >
                                <input
                                    id="upload-invoice-input"
                                    type="file"
                                    className="d-none"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.jpe"
                                    onChange={(e) => handleAddFiles(e.target?.files)}
                                />

                                {selectedFiles.length ? (
                                    <>
                                        <span className="file-drop-zone__icon">✓</span>
                                        <span className="file-drop-zone__text">Files selected ({selectedFiles.length})</span>
                                        {renderSelected}
                                    </>
                                ) : (
                                    <>
                                        <span className="file-drop-zone__icon">📎</span>
                                        <span className="file-drop-zone__text">
                                            {isDragging ? 'Drop your files here' : 'Drag and drop your files here'}
                                        </span>
                                        <span className="file-drop-zone__hint">or click to browse</span>
                                        <span className="file-drop-zone__formats">PDF, JPG, JPEG</span>
                                    </>
                                )}
                            </div>

                            {error && <span className="error text-danger d-block mt-1">{error}</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button
                type="button"
                className="btn btn-outline"
                onClick={() => closeModal(null)}
                disabled={isUploading}
            >
                Close
            </button>
            <button
                type="button"
                className="btn btn-primary"
                disabled={isUploading}
                onClick={() => {
                    if (!selectedFiles.length) {
                        setError('Please select at least one invoice file');
                        return;
                    }

                    setIsUploading(true);
                    // Simulate upload; in real implementation, call your API here.
                    setTimeout(() => {
                        onUploadComplete?.(selectedFiles);
                        closeModal(null);
                    }, 1500);
                }}
            >
                {isUploading ? 'Uploading...' : 'Upload'}
            </button>
        </div>
    );

    return (
        // Reuse the project’s modal shell for consistent layout.
        <CustomModal
            className="invoice-modal-sm"
            dialgName="modal-dialog modal-dialog-centered modal-lg"
            show={show}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [recentOrders, setRecentOrders] = useState(MOCK_RECENT_ORDERS);
    const [expandedRowId, setExpandedRowId] = useState(null);
    /** Keyed by `${orderNo}-${crewIndex}` — editable CheckIn / CheckOut (datetime-local values). */
    const [crewDateTimeEdits, setCrewDateTimeEdits] = useState({});

    const [uploadModalOrderNo, setUploadModalOrderNo] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadingOrderNo, setUploadingOrderNo] = useState(null);

    const summaryCards = [
        {
            title: 'Total Bookings',
            value: String(MOCK_SUMMARY.totalBookings),
            icon: <FiShoppingCart />,
            color: '#00368c',
        },
        {
            title: 'Completed Bookings',
            value: String(MOCK_SUMMARY.completedBookings),
            icon: <FiCheckCircle />,
            color: '#10b981',
        },
        {
            title: 'Pending Bookings',
            value: String(MOCK_SUMMARY.pendingBookings),
            icon: <FiClock />,
            color: '#f59e0b',
        },
    ];

    const getStatusClass = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'in progress') return 'status-pending';
        if (s === 'completed') return 'status-completed';
        if (s === 'approved') return 'status-approved';
        if (s === 'rejected') return 'status-rejected';
        if (s === 'paid') return 'status-paid';
        if (s === 'open') return 'status-open';
        if (s === 'closed') return 'status-closed';
        return '';
    };

    const isUploadDisabled = (status) => {
        const s = (status || '').toLowerCase();
        return s === 'closed' || s === 'completed';
    };

    const toggleRow = (rowId) => {
        setExpandedRowId((prev) => (prev === rowId ? null : rowId));
    };

    const crewEditKey = (orderNo, crewIndex) => `${orderNo}-${crewIndex}`;

    const getCrewCheckIn = (orderNo, crewIndex, crew) =>
        crewDateTimeEdits[crewEditKey(orderNo, crewIndex)]?.checkIn ?? crew.checkIn ?? '';

    const getCrewCheckOut = (orderNo, crewIndex, crew) =>
        crewDateTimeEdits[crewEditKey(orderNo, crewIndex)]?.checkOut ?? crew.checkOut ?? '';

    const setCrewCheckIn = (orderNo, crewIndex, value) => {
        const key = crewEditKey(orderNo, crewIndex);
        setCrewDateTimeEdits((prev) => ({
            ...prev,
            [key]: { ...prev[key], checkIn: value },
        }));
    };

    const setCrewCheckOut = (orderNo, crewIndex, value) => {
        const key = crewEditKey(orderNo, crewIndex);
        setCrewDateTimeEdits((prev) => ({
            ...prev,
            [key]: { ...prev[key], checkOut: value },
        }));
    };

    return (
        <div className="dashboard-container">
            <style>{`
                @keyframes vendorAccordionIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <div className="dashboard-header">
                <h2 className="dashboard-title">Hotel Dashboard</h2>
                <p className="dashboard-subtitle">
                    Overview of your orders and invoices.
                </p>
            </div>

            {/* 1. Top summary cards */}
            <div className="stats-grid">
                {summaryCards.map((card, index) => (
                    <div key={index} className="stat-card">
                        <div className="stat-card-content">
                            <div className="stat-icon" style={{ color: card.color }}>
                                {card.icon}
                            </div>
                            <div className="stat-info">
                                <p className="stat-title">{card.title}</p>
                                <h3 className="stat-value">{card.value}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Invoice Status Overview */}
            <div className="vendor-dashboard-section">
                <h3 className="vendor-section-title">Invoice Status Overview</h3>
                <div className="vendor-invoice-status-cards">
                    <div className="vendor-status-card status-approved">
                        <p className="vendor-status-label">Submitted</p>
                        <p className="vendor-status-value">{MOCK_INVOICE_STATUS.submitted}</p>
                    </div>
                    <div className="vendor-status-card status-pending">
                        <p className="vendor-status-label">Pending</p>
                        <p className="vendor-status-value">{MOCK_INVOICE_STATUS.pending}</p>
                    </div>
                    <div className="vendor-status-card status-completed">
                        <p className="vendor-status-label">Completed</p>
                        <p className="vendor-status-value">{MOCK_INVOICE_STATUS.completed}</p>
                    </div>
                </div>
            </div>

            {/* 5. Quick actions */}
            <div className="vendor-dashboard-section">
                <h3 className="vendor-section-title">Quick Actions</h3>
                <div className="vendor-quick-actions">
                    {/* <button
                        type="button"
                        className="vendor-quick-action-btn primary"
                        onClick={() => navigate('/vendor-portal/invoices')}
                    >
                        <FiPlusCircle /> Add Invoice
                    </button> */}
                    <button
                        type="button"
                        className="vendor-quick-action-btn"
                        onClick={() => navigate('/vendor-portal/orders')}
                    >
                        <FiList /> View Invoices
                    </button>
                    {/* <button
                        type="button"
                        className="vendor-quick-action-btn"
                        onClick={() => navigate('/vendor-portal/orders')}
                    >
                        <FiPackage /> View Orders
                    </button> */}
                </div>
            </div>

            {/* 4. Recent Orders table */}
            <div className="vendor-dashboard-section">
                <h3 className="vendor-section-title">Recent Orders</h3>
                <div className="vendor-table-wrapper">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="vendor-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 46 }} aria-label="Expand row" />
                                    <th>PO No</th>
                                    <th>WO No</th>
                                    <th>Subject</th>
                                    <th>Company</th>
                                    <th>Order date</th>
                                    <th>Purchaser</th>
                                    <th>Amount</th>
                                    <th>Currency</th>
                                    <th>Upload Invoice</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((row) => {
                                    const rowId = row.orderNo;
                                    const isExpanded = expandedRowId === rowId;

                                    return (
                                        <React.Fragment key={rowId}>
                                            <tr onClick={() => toggleRow(rowId)} style={{ cursor: 'pointer' }}>
                                                <td aria-label={isExpanded ? 'Collapse row' : 'Expand row'}>
                                                    <FiChevronRight
                                                        style={{
                                                            transition: 'transform 0.2s ease',
                                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        }}
                                                    />
                                                </td>
                                                <td>{row.orderNo}</td>
                                                <td>{row.workOrderNo}</td>
                                                <td>{row.subject}</td>
                                                <td>{row.company}</td>
                                                <td>{row.orderDate}</td>
                                                <td>{row.purchaser}</td>
                                                <td>{row.amount}</td>
                                                <td>{row.currency}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="vendor-upload-btn"
                                                        disabled={isUploadDisabled(row.status) || uploadingOrderNo === row.orderNo}
                                                        onClick={(e) => {
                                                            // Prevent row expansion when using the upload action.
                                                            e.stopPropagation();
                                                            setUploadModalOrderNo(row.orderNo);
                                                            setUploadingOrderNo(row.orderNo);
                                                            setShowUploadModal(true);
                                                        }}
                                                    >
                                                        <FiUpload />
                                                        Upload
                                                    </button>
                                                </td>
                                                <td>
                                                    <span className={`vendor-status-badge ${getStatusClass(row.status)}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={11} style={{ padding: 0 }}>
                                                        <div
                                                            style={{
                                                                padding: '14px 20px',
                                                                animation: 'vendorAccordionIn 0.18s ease-out both',
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            role="presentation"
                                                        >
                                                            <div style={{ overflowX: 'auto' }}>
                                                                <table className="vendor-table" style={{ marginBottom: 0, minWidth: 960 }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Crew Name</th>
                                                                            <th>Rank</th>
                                                                            <th>Nationality</th>
                                                                            <th>Passport No</th>
                                                                            <th>Visa No</th>
                                                                            <th>IQAMA</th>
                                                                            <th>CheckIn</th>
                                                                            <th>CheckOut</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(row.crewDetails || []).length ? (
                                                                            row.crewDetails.map((crew, i) => (
                                                                                <tr key={`${rowId}-crew-${i}`}>
                                                                                    <td>{crew.name}</td>
                                                                                    <td>{crew.rank ?? '—'}</td>
                                                                                    <td>{crew.nationality}</td>
                                                                                    <td>{crew.passport}</td>
                                                                                    <td>{crew.visa}</td>
                                                                                    <td>{crew.iqama ?? '—'}</td>
                                                                                    <td>
                                                                                        <DateTimePickerField
                                                                                            dateValue={getCrewCheckIn(rowId, i, crew)}
                                                                                            onDateTimeChange={({ date, time }) =>
                                                                                                setCrewCheckIn(rowId, i, date ? `${date}T${time || "00:00"}` : "")
                                                                                            }
                                                                                            placeholder="DD/MM/YYYY HH:mm"
                                                                                        />
                                                                                    </td>
                                                                                    <td>
                                                                                        <DateTimePickerField
                                                                                            dateValue={getCrewCheckOut(rowId, i, crew)}
                                                                                            onDateTimeChange={({ date, time }) =>
                                                                                                setCrewCheckOut(rowId, i, date ? `${date}T${time || "00:00"}` : "")
                                                                                            }
                                                                                            placeholder="DD/MM/YYYY HH:mm"
                                                                                        />
                                                                                    </td>
                                                                                </tr>
                                                                            ))
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={8} style={{ color: '#6b7280' }}>
                                                                                    No crew details available
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 3. Recent Invoices table */}
            {/* <div className="vendor-dashboard-section">
                <h3 className="vendor-section-title">Recent Invoices</h3>
                <div className="vendor-table-wrapper">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="vendor-table">
                            <thead>
                                <tr>
                                    <th>Invoice No</th>
                                    <th>Ref No</th>
                                    <th>Company</th>
                                    <th>Type</th>
                                    <th>Invoice Date</th>
                                    <th>Amount</th>
                                    <th>Currency</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_RECENT_INVOICES.map((row, idx) => (
                                    <tr key={idx}>
                                        <td>{row.invoiceNo}</td>
                                        <td>{row.refNo}</td>
                                        <td>{row.company}</td>
                                        <td>{row.type}</td>
                                        <td>{row.date}</td>
                                        <td>{row.amount}</td>
                                        <td>{row.currency}</td>
                                        <td>
                                            <span className={`vendor-status-badge ${getStatusClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div> */}



            {!!showUploadModal && (
                <UploadInvoiceModal
                    show={showUploadModal}
                    orderNo={uploadModalOrderNo}
                    closeModal={() => {
                        setShowUploadModal(false);
                        setUploadModalOrderNo(null);
                        setUploadingOrderNo(null);
                    }}
                    onUploadComplete={() => {
                        if (!uploadModalOrderNo) return;
                        setRecentOrders((prev) =>
                            prev.map((o) =>
                                o.orderNo === uploadModalOrderNo
                                    ? { ...o, status: 'Completed' }
                                    : o
                            )
                        );
                        setShowUploadModal(false);
                        setUploadModalOrderNo(null);
                        setUploadingOrderNo(null);
                    }}
                />
            )}


        </div>
    );
};

export default Dashboard;
