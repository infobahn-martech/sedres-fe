import dayjs from 'dayjs';

// Shared by the Inhouse Driver Dashboard (recent trips) and Trip Management (full list).

const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    if (!parsed.isValid()) return value;
    // Backend sends 1899-12-30 (SQL zero date) when no date is set
    return parsed.year() < 1900 ? '—' : parsed.format('DD MMM YYYY, HH:mm');
};

export const TRIP_TABLE_COLUMNS = [
    { label: 'Trip No', key: 'tripNo' },
    { label: 'From', key: 'from' },
    { label: 'To', key: 'to' },
    { label: 'Pickup', key: 'pickup' },
    { label: 'Drop-off', key: 'dropOff' },
    { label: 'Vehicle', key: 'vehicle' },
    { label: 'Status', key: 'status', isStatus: true },
];

export const toTripRow = (req) => ({
    id: req.transport_request_id,
    tripNo: `TR-${req.transport_request_id}`,
    from: req.from_location,
    to: req.to_location,
    pickup: formatDateTime(req.pickup_datetime),
    dropOff: formatDateTime(req.drop_offdatetime),
    rawPickup: req.pickup_datetime,
    rawDropOff: req.drop_offdatetime,
    vehicle: [req.plate_no, req.vehicle_type].filter(Boolean).join(' · ') || '—',
    status: req.status,
    fromDet: req.from_location_det,
    toDet: req.to_location_det,
    remarks: req.remarks,
    invoiceBranch: req.invoice_branch,
    vesselName: req.vessel_name,
    billingEntity: req.billing_entity,
    seater: req.seater,
    createdDate: formatDateTime(req.created_date),
    crew: req.crew || [],
    attachments: req.attachments || [],
});
