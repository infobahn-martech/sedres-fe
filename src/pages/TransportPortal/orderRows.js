import dayjs from 'dayjs';

// Shared by the Transport Company Dashboard (recent orders) and Order Management (full list).

const formatDate = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD MMM YYYY') : value;
};

export const ORDER_TABLE_COLUMNS = [
    { label: 'PO No', key: 'poNo' },
    { label: 'WO No', key: 'woNo' },
    { label: 'Subject', key: 'subject' },
    { label: 'Company', key: 'company' },
    { label: 'Order Date', key: 'orderDate' },
    { label: 'Purchaser', key: 'purchaser' },
    { label: 'Amount', key: 'amount' },
    { label: 'Currency', key: 'currency' },
    { label: 'Status', key: 'status', isStatus: true },
];

export const toOrderRow = (order) => ({
    poNo: order.po_number,
    woNo: order.wo_number,
    subject: `${order.vehicle_type || 'Transport'} - Crew transfer`,
    company: order.company,
    orderDate: formatDate(order.order_date),
    rawOrderDate: order.order_date,
    purchaser: order.requested_by,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    crew: order.crew || [],
});
