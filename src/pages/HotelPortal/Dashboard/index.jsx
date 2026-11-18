import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
    FiHome,
    FiClock,
    FiFileText,
    FiDollarSign,
    FiCalendar,
    FiUpload,
} from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';
import UploadInvoiceModal from '../../../components/UploadInvoiceModal';
import useVendorReducer from '../../../store/VendorReducer';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';

const formatDate = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD MMM YYYY') : value;
};

const toDateTimeLocal = (value) => {
    if (!value) return '';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm') : '';
};

const isUploadDisabled = (status) => {
    const s = (status || '').toLowerCase();
    return s === 'closed' || s === 'completed' || s === 'paid';
};

function HotelDashboard() {
    const {
        isHotelDashboardLoading,
        hotelDashboardData,
        isHotelOrdersLoading,
        hotelOrdersData,
        getHotelDashboard,
        getHotelOrders,
        uploadInvoice,
    } = useVendorReducer();

    const [uploadOrder, setUploadOrder] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    // Local check-in / check-out edits keyed by hotel_request_crew_id; untouched crew fall back to
    // the order's checkin_datetime / checkout_datetime.
    const [crewStayEdits, setCrewStayEdits] = useState({});

    const getCrewKey = (row, crew, index) =>
        crew.hotel_request_crew_id ?? `${row.hotelRequestId}-${index}`;

    const getCrewStayValue = (row, crew, index, field) => {
        const edited = crewStayEdits[getCrewKey(row, crew, index)]?.[field];
        if (edited !== undefined) return edited;
        return toDateTimeLocal(crew[field] ?? row[field]);
    };

    const setCrewStayValue = (row, crew, index, field, value) => {
        const key = getCrewKey(row, crew, index);
        setCrewStayEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    };

    useEffect(() => {
        getHotelDashboard();
        getHotelOrders();
    }, [getHotelDashboard, getHotelOrders]);

    const summaryCards = useMemo(
        () => [
            {
                title: 'Total Orders',
                value: String(hotelDashboardData?.total_orders ?? 0),
                icon: <FiHome />,
                color: '#00368c',
            },
            {
                title: 'Submitted Invoices',
                value: String(hotelDashboardData?.invoices_submitted ?? 0),
                icon: <FiFileText />,
                color: '#3b82f6',
            },
            {
                title: 'Pending Invoices',
                value: String(hotelDashboardData?.pending_invoices ?? 0),
                icon: <FiClock />,
                color: '#f59e0b',
            },
            {
                title: 'Paid Amount',
                value: String(hotelDashboardData?.paid_amount ?? 0),
                icon: <FiDollarSign />,
                color: '#10b981',
            },
        ],
        [hotelDashboardData]
    );

    const statusCards = useMemo(
        () => [
            { label: 'Pending', value: hotelDashboardData?.invoice_status?.pending ?? 0, statusClass: 'status-pending' },
            { label: 'Approved', value: hotelDashboardData?.invoice_status?.approved ?? 0, statusClass: 'status-approved' },
            { label: 'Rejected', value: hotelDashboardData?.invoice_status?.rejected ?? 0, statusClass: 'status-rejected' },
            { label: 'Paid', value: hotelDashboardData?.invoice_status?.paid ?? 0, statusClass: 'status-paid' },
        ],
        [hotelDashboardData]
    );

    const quickActions = [
        { label: 'View Bookings', icon: <FiCalendar />, onClick: () => {} },
        { label: 'View Invoices', icon: <FiFileText />, onClick: () => {} },
    ];

    const tableColumns = [
        { label: 'PO No', key: 'poNo' },
        { label: 'WO No', key: 'woNo' },
        { label: 'Subject', key: 'subject' },
        { label: 'Company', key: 'company' },
        { label: 'Order Date', key: 'orderDate' },
        { label: 'Purchaser', key: 'purchaser' },
        { label: 'Amount', key: 'amount' },
        { label: 'Currency', key: 'currency' },
        {
            label: 'Upload Invoice',
            key: 'uploadInvoice',
            render: (row) => (
                <button
                    type="button"
                    className="vendor-upload-btn"
                    disabled={isUploadDisabled(row.status)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setUploadOrder(row);
                        setShowUploadModal(true);
                    }}
                >
                    <FiUpload />
                    Upload
                </button>
            ),
        },
        { label: 'Status', key: 'status', isStatus: true },
    ];

    const tableRows = useMemo(
        () =>
            (hotelOrdersData || []).map((order) => ({
                hotelRequestId: order.hotel_request_id,
                checkin_datetime: order.checkin_datetime,
                checkout_datetime: order.checkout_datetime,
                poNo: order.po_number,
                woNo: order.wo_number,
                subject: `${order.hotel_name || 'Hotel'} - Accommodation`,
                company: order.company,
                orderDate: formatDate(order.order_date),
                purchaser: order.requested_by,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
                purchaseOrderId: order.purchase_order_id,
                crew: order.crew || [],
            })),
        [hotelOrdersData]
    );

    return (
        <>
            <PortalDashboard
                title="Hotel Dashboard"
                subtitle="Overview of bookings, check-ins, and guest requests."
                summaryCards={summaryCards}
                statusTitle="Invoice Status Overview"
                statusCards={statusCards}
                quickActions={quickActions}
                tableTitle="Recent Orders"
                tableColumns={tableColumns}
                tableRows={tableRows}
                isTableLoading={isHotelDashboardLoading || isHotelOrdersLoading}
                emptyMessage="No orders found"
                expandable
                rowKey={(row) => row.hotelRequestId ?? row.poNo}
                renderExpandedRow={(row) => (
                    <div className="vendor-table-scroll">
                        <table className="vendor-table" style={{ marginBottom: 0, minWidth: 960 }}>
                            <thead>
                                <tr>
                                    <th>Crew Name</th>
                                    <th>Rank</th>
                                    <th>Nationality</th>
                                    <th>Passport No</th>
                                    <th>CheckIn</th>
                                    <th>CheckOut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {row.crew.length ? (
                                    row.crew.map((crew, i) => (
                                        <tr key={getCrewKey(row, crew, i)}>
                                            <td>{crew.crew_name || '—'}</td>
                                            <td>{crew.rank || '—'}</td>
                                            <td>{crew.nationality || '—'}</td>
                                            <td>{crew.passport_no || '—'}</td>
                                            <td>
                                                <input
                                                    type="datetime-local"
                                                    className="form-control form-control-sm vendor-crew-datetime-input"
                                                    value={getCrewStayValue(row, crew, i, 'checkin_datetime')}
                                                    onChange={(e) =>
                                                        setCrewStayValue(row, crew, i, 'checkin_datetime', e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="datetime-local"
                                                    className="form-control form-control-sm vendor-crew-datetime-input"
                                                    value={getCrewStayValue(row, crew, i, 'checkout_datetime')}
                                                    min={getCrewStayValue(row, crew, i, 'checkin_datetime') || undefined}
                                                    onChange={(e) =>
                                                        setCrewStayValue(row, crew, i, 'checkout_datetime', e.target.value)
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} style={{ color: '#6b7280' }}>
                                            No crew details available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            />

            {!!showUploadModal && (
                <UploadInvoiceModal
                    show={showUploadModal}
                    orderNo={uploadOrder?.poNo}
                    closeModal={() => {
                        setShowUploadModal(false);
                        setUploadOrder(null);
                    }}
                    onUploadComplete={async (files) => {
                        if (!uploadOrder) return;
                        await uploadInvoice({
                            purchaseOrderId: uploadOrder.purchaseOrderId,
                            invoiceAmount: uploadOrder.amount,
                            invoiceDate: dayjs().format('YYYY-MM-DD'),
                            files,
                        });
                        setShowUploadModal(false);
                        setUploadOrder(null);
                        getHotelDashboard();
                        getHotelOrders();
                    }}
                />
            )}
        </>
    );
}

export default HotelDashboard;
