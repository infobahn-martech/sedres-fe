import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Truck, FileText, Clock, Banknote, CalendarDays, Upload } from 'lucide-react';
import UploadInvoiceModal from '../../../components/UploadInvoiceModal';
import useVendorReducer from '../../../store/VendorReducer';
import { formatDate } from '../../Dashboard/dashboardUtils';
import { StatusBadge, EmptyRow } from '../../Dashboard/dashboardWidgets';
import { formatAmount, toOrderRow } from '../orderRows';
import '../../../design/scss/dashboard.scss';
import '../../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../../design/scss/vendor-portal.scss';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';

// The full list lives in Order Management.
const RECENT_ORDERS_LIMIT = 10;

const ORDER_STATUS_META = {
    Pending: { label: 'Pending', tone: 'warning' },
    Assigned: { label: 'Assigned', tone: 'info' },
    'In Progress': { label: 'In Progress', tone: 'info' },
    Completed: { label: 'Completed', tone: 'success' },
    Cancelled: { label: 'Cancelled', tone: 'neutral' },
};

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

    const recentOrders = useMemo(
        () => (ordersData || []).slice(0, RECENT_ORDERS_LIMIT).map(toOrderRow),
        [ordersData]
    );

    const paidAmount = Number(dashboardData?.paid_amount ?? 0);

    const stats = [
        { title: 'Total Orders', value: dashboardData?.total_orders ?? 0, icon: <Truck />, tone: 'blue' },
        { title: 'Submitted Invoices', value: dashboardData?.invoices_submitted ?? 0, icon: <FileText />, tone: 'violet' },
        { title: 'Pending Invoices', value: dashboardData?.pending_invoices ?? 0, icon: <Clock />, tone: 'amber' },
        { title: 'Paid Amount', value: paidAmount, icon: <Banknote />, tone: 'green' },
    ];

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h2 className="dashboard-title">Transport Company Dashboard</h2>
                    <p className="dashboard-subtitle">Orders, invoices and payments at a glance.</p>
                </div>
                <span className="dashboard-date">
                    <CalendarDays />
                    {formatDate(Date.now())}
                </span>
            </div>

            {/* Summary tiles */}
            <div className="stats-grid">
                {stats.map((stat) => (
                    <div key={stat.title} className={`stat-card stat-card--${stat.tone}`}>
                        <div className="stat-card-content">
                            <div className={`stat-icon stat-icon--${stat.tone}`}>{stat.icon}</div>
                            <p className="stat-title">{stat.title}</p>
                        </div>
                        <h3 className="stat-value">{Number(stat.value).toLocaleString()}</h3>
                    </div>
                ))}
            </div>

            <div className="charts-grid">
                {/* Recent orders */}
                <div className="chart-card chart-card-full">
                    <div className="chart-header chart-header--row">
                        <div>
                            <h3 className="chart-title">Recent Orders</h3>
                            <p className="chart-subtitle">Your latest crew transport orders</p>
                        </div>
                        <div className="dash-filters">
                            <input
                                type="month"
                                className="dash-select dash-select--date"
                                value={invoiceMonth}
                                onChange={(e) => setInvoiceMonth(e.target.value)}
                                aria-label="Invoice month"
                            />
                            <button type="button" className="vendor-upload-btn" onClick={() => setShowUploadModal(true)}>
                                <Upload size={16} />
                                Upload Invoice
                            </button>
                        </div>
                    </div>

                    <div className="dash-table-wrp">
                        <table className="dash-table">
                            <thead>
                                <tr>
                                    <th>Order Date</th>
                                    <th>Company</th>
                                    <th>Vehicle</th>
                                    <th className="num">Crew</th>
                                    <th className="num">Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isDashboardLoading || isOrdersLoading ? (
                                    <EmptyRow colSpan={6} text="Loading..." />
                                ) : recentOrders.length === 0 ? (
                                    <EmptyRow colSpan={6} text="No orders found" />
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr key={order.poNo}>
                                            <td>{order.orderDate}</td>
                                            <td className="dash-table-strong">{order.company || '—'}</td>
                                            <td>{order.vehicleType}</td>
                                            <td className="num">{order.crew.length}</td>
                                            <td className="num">{formatAmount(order)}</td>
                                            <td>
                                                <StatusBadge status={order.status} meta={ORDER_STATUS_META} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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
        </div>
    );
}

export default TransportDashboard;
