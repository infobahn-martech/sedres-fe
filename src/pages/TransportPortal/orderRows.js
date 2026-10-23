import dayjs from 'dayjs';

// Shared by the Transport Company Dashboard (recent orders) and Order Management (full list).

const formatDate = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD MMM YYYY') : value;
};

export const formatAmount = (row) =>
    row.amount != null && row.amount !== '' ? `${row.currency ?? ''} ${row.amount}`.trim() : '—';

// `poNo` is kept only as the row key — it isn't shown.
export const toOrderRow = (order) => ({
    poNo: order.po_number,
    company: order.company,
    vehicleType: order.vehicle_type || 'Transport',
    orderDate: formatDate(order.order_date),
    rawOrderDate: order.order_date,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    crew: order.crew || [],
});
