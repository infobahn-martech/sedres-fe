import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
    FiTruck,
    FiClock,
    FiFileText,
    FiDollarSign,
    FiList,
    FiUpload,
} from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';
import UploadInvoiceModal from '../../../components/UploadInvoiceModal';
import useVendorReducer from '../../../store/VendorReducer';
import OrderCrewTable from '../OrderCrewTable';
import { ORDER_TABLE_COLUMNS, toOrderRow } from '../orderRows';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';

// The full list lives in Order Management.
const RECENT_ORDERS_LIMIT = 10;

function TransportDashboard() {
    const {
        isDashboardLoading,
        dashboardData,
        isOrdersLoading,
        ordersData,
        getVendorDashboard,
        getVendorOrders,
    } = useVendorReducer();

    const [invoiceMonth, setInvoiceMonth] = useState(dayjs().format('YYYY-MM'));
    const [showUploadModal, setShowUploadModal] = useState(false);

    useEffect(() => {
        getVendorDashboard();
        getVendorOrders();
    }, [getVendorDashboard, getVendorOrders]);

    const summaryCards = useMemo(
        () => [
            {
                title: 'Total Orders',
                value: String(dashboardData?.total_orders ?? 0),
                icon: <FiTruck />,
                color: '#00368c',
            },
            {
                title: 'Submitted Invoices',
                value: String(dashboardData?.invoices_submitted ?? 0),
                icon: <FiFileText />,
                color: '#3b82f6',
            },
            {
                title: 'Pending Invoices',
                value: String(dashboardData?.pending_invoices ?? 0),
                icon: <FiClock />,
                color: '#f59e0b',
            },
            {
                title: 'Paid Amount',
                value: String(dashboardData?.paid_amount ?? 0),
                icon: <FiDollarSign />,
                color: '#10b981',
            },
        ],
        [dashboardData]
    );

    const statusCards = useMemo(
        () => [
            { label: 'Pending', value: dashboardData?.invoice_status?.pending ?? 0, statusClass: 'status-pending' },
            { label: 'Approved', value: dashboardData?.invoice_status?.approved ?? 0, statusClass: 'status-approved' },
            { label: 'Rejected', value: dashboardData?.invoice_status?.rejected ?? 0, statusClass: 'status-rejected' },
            { label: 'Paid', value: dashboardData?.invoice_status?.paid ?? 0, statusClass: 'status-paid' },
        ],
        [dashboardData]
    );

    const quickActions = [
        { label: 'View Orders', icon: <FiList />, onClick: () => {} },
        { label: 'Manage Vehicles', icon: <FiTruck />, onClick: () => {} },
    ];

    const tableHeaderAction = (
        <div className="vendor-table-header-actions">
            <input
                type="month"
                className="form-control form-control-sm vendor-month-input"
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
                aria-label="Invoice month"
            />
            <button
                type="button"
                className="vendor-upload-btn"
                onClick={() => setShowUploadModal(true)}
            >
                <FiUpload />
                Upload Invoice
            </button>
        </div>
    );

    const tableRows = useMemo(
        () => (ordersData || []).slice(0, RECENT_ORDERS_LIMIT).map(toOrderRow),
        [ordersData]
    );

    return (
        <>
            <PortalDashboard
                title="Transport Company Dashboard"
                subtitle="Overview of trips, vehicles, and pending bookings."
                summaryCards={summaryCards}
                statusTitle="Invoice Status Overview"
                statusCards={statusCards}
                quickActions={quickActions}
                tableTitle="Recent Orders"
                tableHeaderAction={tableHeaderAction}
                tableColumns={ORDER_TABLE_COLUMNS}
                tableRows={tableRows}
                isTableLoading={isDashboardLoading || isOrdersLoading}
                emptyMessage="No orders found"
                expandable
                rowKey={(row) => row.poNo}
                renderExpandedRow={(row) => <OrderCrewTable row={row} />}
            />

            {!!showUploadModal && (
                <UploadInvoiceModal
                    show={showUploadModal}
                    contextLabel={`Month: ${dayjs(invoiceMonth).format('MMMM YYYY')}`}
                    closeModal={() => setShowUploadModal(false)}
                    onUploadComplete={() => {
                        setShowUploadModal(false);
                        getVendorDashboard();
                        getVendorOrders();
                    }}
                />
            )}
        </>
    );
}

export default TransportDashboard;
