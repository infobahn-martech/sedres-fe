import dayjs from 'dayjs';

// Shared by the Transport Company Dashboard (recent orders) and Order Management (full list).

const formatDate = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : value;
};

export const formatAmount = (row) =>
    row.amount != null && row.amount !== '' ? `${row.currency ?? ''} ${row.amount}`.trim() : '—';

// `poNo` is kept only as the row key — it isn't shown.
// Trip fields (request id, route, times, trip status) come from the order, falling back to its first crew row.
export const toOrderRow = (order) => {
    const firstCrew = order.crew?.[0] ?? {};
    const pick = (key) => order[key] ?? firstCrew[key];
    return {
        poNo: order.po_number,
        company: order.company,
        vehicleType: order.vehicle_type || 'Transport',
        orderDate: formatDate(order.order_date),
        rawOrderDate: order.order_date,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        crew: order.crew || [],
        transportRequestId: pick('transport_request_id'),
        from: pick('from_location'),
        to: pick('to_location'),
        fromDet: pick('from_location_det'),
        toDet: pick('to_location_det'),
        tripStatus: pick('trip_status') ?? order.status,
        rawPickup: pick('pickup_datetime'),
        rawDropOff: pick('drop_offdatetime'),
    };
};
