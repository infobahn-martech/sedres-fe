import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
    FiHome,
    FiClock,
    FiFileText,
    FiDollarSign,
    FiUpload,
} from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';
import UploadInvoiceModal from '../../../components/UploadInvoiceModal';
import useVendorReducer from '../../../store/VendorReducer';
import vendorService from '../../../services/vendorService';
import { notify } from '../../../components/Toaster';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';
import '../../../design/scss/general.scss';
import DateTimePickerField from '../../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField';

const formatDate = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : value;
};

// API datetimes ("YYYY-MM-DD HH:mm:ss") -> the { date, time } parts DateTimePickerField works with.
const toDateTimeParts = (value) => {
    const parsed = value ? dayjs(value) : null;
    return parsed?.isValid()
        ? { date: parsed.format('YYYY-MM-DD'), time: parsed.format('HH:mm') }
        : { date: '', time: '' };
};

// { date, time } parts -> "YYYY-MM-DD HH:mm:ss" for update_hotel_request_dates; "" when incomplete.
const toApiDateTime = (parts) =>
    parts?.date && parts?.time ? `${parts.date} ${parts.time}:00` : '';

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
    // Check-in / check-out belong to the hotel request (hotel/update_hotel_request_dates), so every
    // crew row of an order shares them. Edits are keyed by hotel_request_id as { date, time } parts;
    // untouched orders fall back to the API's checkin_datetime / checkout_datetime.
    const [stayEdits, setStayEdits] = useState({});
    const saveTimersRef = useRef({});
    // Last values the server accepted per request, used to roll back a failed save.
    const savedStayRef = useRef({});

    useEffect(() => () => {
        Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    }, []);

    const getStayValue = (row, field) =>
        stayEdits[row.hotelRequestId]?.[field] ?? toDateTimeParts(row[field]);

    const saveStayDates = async (row, stay) => {
        const requestId = row.hotelRequestId;
        try {
            await vendorService.updateHotelRequestDates({
                hotel_request_id: Number(requestId) || requestId,
                checkin_datetime: toApiDateTime(stay.checkin_datetime),
                checkout_datetime: toApiDateTime(stay.checkout_datetime),
            });
            savedStayRef.current[requestId] = stay;
            notify('Stay dates updated.', 'success');
        } catch (error) {
            const message =
                error?.response?.data?.message || error?.message || 'Could not update stay dates.';
            notify(typeof message === 'string' ? message : 'Could not update stay dates.', 'error');
            const lastSaved = savedStayRef.current[requestId];
            setStayEdits((prev) => {
                const next = { ...prev };
                if (lastSaved) next[requestId] = lastSaved;
                else delete next[requestId];
                return next;
            });
        }
    };

    const handleStayChange = (row, field, parts) => {
        const requestId = row.hotelRequestId;
        if (requestId == null) return;
        const stay = {
            checkin_datetime: getStayValue(row, 'checkin_datetime'),
            checkout_datetime: getStayValue(row, 'checkout_datetime'),
            [field]: parts,
        };
        setStayEdits((prev) => ({ ...prev, [requestId]: stay }));

        window.clearTimeout(saveTimersRef.current[requestId]);
        const checkIn = toApiDateTime(stay.checkin_datetime);
        const checkOut = toApiDateTime(stay.checkout_datetime);
        if (!checkIn || !checkOut) return;
        if (!dayjs(checkOut).isAfter(dayjs(checkIn))) {
            notify('Check-out must be after check-in.', 'error');
            return;
        }
        // Typing into the field emits on each segment; save once the user pauses.
        saveTimersRef.current[requestId] = window.setTimeout(() => {
            delete saveTimersRef.current[requestId];
            void saveStayDates(row, stay);
        }, 600);
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

    const tableColumns = [
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
                                        <tr key={crew.hotel_request_crew_id ?? `${row.hotelRequestId}-${i}`}>
                                            <td>{crew.crew_name || '—'}</td>
                                            <td>{crew.rank || '—'}</td>
                                            <td>{crew.nationality || '—'}</td>
                                            <td>{crew.passport_no || '—'}</td>
                                            {(() => {
                                                const checkIn = getStayValue(row, 'checkin_datetime');
                                                const checkOut = getStayValue(row, 'checkout_datetime');
                                                return (
                                                    <>
                                                        <td className="vendor-crew-datetime-cell">
                                                            <DateTimePickerField
                                                                dateValue={checkIn.date}
                                                                timeValue={checkIn.time}
                                                                onDateTimeChange={(next) =>
                                                                    handleStayChange(row, 'checkin_datetime', next)
                                                                }
                                                                placeholder="Select check-in"
                                                            />
                                                        </td>
                                                        <td className="vendor-crew-datetime-cell">
                                                            <DateTimePickerField
                                                                dateValue={checkOut.date}
                                                                timeValue={checkOut.time}
                                                                minDate={checkIn.date || undefined}
                                                                onDateTimeChange={(next) =>
                                                                    handleStayChange(row, 'checkout_datetime', next)
                                                                }
                                                                placeholder="Select check-out"
                                                            />
                                                        </td>
                                                    </>
                                                );
                                            })()}
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
