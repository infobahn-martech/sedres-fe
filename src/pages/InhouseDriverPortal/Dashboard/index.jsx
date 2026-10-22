import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
    FiNavigation,
    FiCheckCircle,
    FiClock,
    FiMapPin,
    FiList,
    FiPaperclip,
    FiAnchor,
    FiBriefcase,
    FiHome,
    FiUsers,
    FiCalendar,
    FiMessageSquare,
    FiCheck,
    FiGlobe,
    FiActivity,
} from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';
import useInhouseDriverReducer from '../../../store/InhouseDriverReducer';

const TRIP_STATUS_OPTIONS = [
    { value: 'Pending', tone: 'amber', icon: <FiClock /> },
    { value: 'In Progress', tone: 'blue', icon: <FiActivity /> },
    { value: 'Completed', tone: 'green', icon: <FiCheckCircle /> },
];

const AVATAR_TONES = ['blue', 'violet', 'green', 'amber'];

const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    if (!parsed.isValid()) return value;
    // Backend sends 1899-12-30 (SQL zero date) when no date is set
    return parsed.year() < 1900 ? '—' : parsed.format('DD MMM YYYY, HH:mm');
};

const getInitials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || '?';

const hasValue = (value) => value != null && value !== '' && value !== '—';

const quickActions = [
    { label: 'View My Trips', icon: <FiList />, onClick: () => {} },
    { label: 'View Route Map', icon: <FiMapPin />, onClick: () => {} },
];

const tableColumns = [
    { label: 'Trip No', key: 'tripNo' },
    { label: 'From', key: 'from' },
    { label: 'To', key: 'to' },
    { label: 'Pickup', key: 'pickup' },
    { label: 'Drop-off', key: 'dropOff' },
    { label: 'Vehicle', key: 'vehicle' },
    { label: 'Status', key: 'status', isStatus: true },
];

function InhouseDriverDashboard() {
    const {
        isTripStatsLoading,
        tripStatsData,
        isRequestsLoading,
        requestsData,
        isUpdatingTripStatus,
        getDriverTripStats,
        getRequestsByDriver,
        updateTripStatus,
    } = useInhouseDriverReducer();

    const [statusEdits, setStatusEdits] = useState({});

    useEffect(() => {
        getDriverTripStats();
        getRequestsByDriver();
    }, [getDriverTripStats, getRequestsByDriver]);

    const handleStatusSave = async (row) => {
        const nextStatus = statusEdits[row.id] ?? row.status;
        if (nextStatus === row.status) return;
        await updateTripStatus({
            transportRequestId: row.id,
            status: nextStatus,
            pickupDatetime: row.rawPickup,
            dropOffDatetime: row.rawDropOff,
        });
        setStatusEdits((prev) => {
            const next = { ...prev };
            delete next[row.id];
            return next;
        });
        getDriverTripStats();
    };

    const summaryCards = useMemo(
        () => [
            { title: 'Total Trips', value: String(tripStatsData?.total ?? 0), icon: <FiNavigation />, color: '#00368c' },
            { title: 'Completed Trips', value: String(tripStatsData?.completed ?? 0), icon: <FiCheckCircle />, color: '#10b981' },
            { title: 'Pending Trips', value: String(tripStatsData?.pending ?? 0), icon: <FiClock />, color: '#f59e0b' },
            { title: 'In Progress Trips', value: String(tripStatsData?.in_progress ?? 0), icon: <FiMapPin />, color: '#3b82f6' },
        ],
        [tripStatsData]
    );

    const tableRows = useMemo(
        () =>
            (requestsData || []).map((req) => ({
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
            })),
        [requestsData]
    );

    const renderExpandedRow = (row) => {
        const selectedStatus = statusEdits[row.id] ?? row.status;
        const isStatusUnchanged = selectedStatus === row.status;
        const infoTiles = [
            { label: 'Vessel', value: row.vesselName, icon: <FiAnchor />, tone: 'blue' },
            { label: 'Billing Entity', value: row.billingEntity, icon: <FiBriefcase />, tone: 'violet' },
            { label: 'Branch', value: row.invoiceBranch, icon: <FiHome />, tone: 'green' },
            { label: 'Seater', value: row.seater, icon: <FiUsers />, tone: 'amber' },
            { label: 'Created', value: row.createdDate, icon: <FiCalendar />, tone: 'blue' },
        ].filter(({ value }) => hasValue(value));

        return (
            <div className="trip-details">
                <div className="trip-details__top">
                    <div className="trip-details__card trip-details__route">
                        <div className="trip-details__stop">
                            <span className="trip-details__stop-dot trip-details__stop-dot--from" />
                            <div>
                                <p className="trip-details__eyebrow">Pickup · {row.pickup}</p>
                                <p className="trip-details__place">{row.from || '—'}</p>
                                {hasValue(row.fromDet) && <p className="trip-details__note">{row.fromDet}</p>}
                            </div>
                        </div>
                        <div className="trip-details__stop">
                            <span className="trip-details__stop-dot trip-details__stop-dot--to">
                                <FiMapPin />
                            </span>
                            <div>
                                <p className="trip-details__eyebrow">Drop-off · {row.dropOff}</p>
                                <p className="trip-details__place">{row.to || '—'}</p>
                                {hasValue(row.toDet) && <p className="trip-details__note">{row.toDet}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="trip-details__card trip-details__status">
                        <p className="trip-details__card-title">Update Trip Status</p>
                        <div className="trip-details__status-options" role="radiogroup" aria-label="Trip status">
                            {TRIP_STATUS_OPTIONS.map(({ value, tone, icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selectedStatus === value}
                                    className={`trip-details__status-pill tone-${tone} ${selectedStatus === value ? 'is-active' : ''}`}
                                    onClick={() => setStatusEdits((prev) => ({ ...prev, [row.id]: value }))}
                                >
                                    {icon} {value}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="trip-details__save"
                            disabled={isUpdatingTripStatus || isStatusUnchanged}
                            onClick={() => handleStatusSave(row)}
                        >
                            <FiCheck /> {isUpdatingTripStatus ? 'Saving...' : 'Save Status'}
                        </button>
                    </div>
                </div>

                {!!infoTiles.length && (
                    <div className="trip-details__tiles">
                        {infoTiles.map(({ label, value, icon, tone }) => (
                            <div key={label} className="trip-details__tile">
                                <span className={`stat-icon stat-icon--${tone}`}>{icon}</span>
                                <div className="trip-details__tile-text">
                                    <p className="trip-details__eyebrow">{label}</p>
                                    <p className="trip-details__tile-value">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {hasValue(row.remarks) && (
                    <div className="trip-details__remarks">
                        <FiMessageSquare />
                        <p>{row.remarks}</p>
                    </div>
                )}

                <div className="trip-details__card">
                    <p className="trip-details__card-title">
                        <FiUsers /> Crew Members
                        <span className="trip-details__count">{row.crew.length}</span>
                    </p>
                    {row.crew.length ? (
                        <div className="vendor-table-scroll">
                            <table className="trip-details__crew">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Rank</th>
                                        <th>Passport No</th>
                                        <th>Nationality</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {row.crew.map((crew, i) => (
                                        <tr key={`${row.id}-crew-${i}`}>
                                            <td>
                                                <span className="trip-details__person">
                                                    <span className={`trip-details__avatar tone-${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                                                        {getInitials(crew.crew_name)}
                                                    </span>
                                                    {crew.crew_name || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                {crew.rank ? <span className="trip-details__rank">{crew.rank}</span> : '—'}
                                            </td>
                                            <td className="trip-details__mono">{crew.passport_no || '—'}</td>
                                            <td>
                                                <span className="trip-details__person">
                                                    <FiGlobe className="trip-details__muted-icon" />
                                                    {crew.nationality || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="trip-details__empty">No crew details available</p>
                    )}
                </div>

                {!!row.attachments.length && (
                    <div className="trip-details__attachments">
                        {row.attachments.map((att) => (
                            <a
                                key={att.attachment_id}
                                href={att.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="trip-details__attachment"
                            >
                                <FiPaperclip /> {att.file_name}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <PortalDashboard
            title="Inhouse Driver Dashboard"
            subtitle="Overview of your assigned, completed, and pending trips."
            summaryCards={summaryCards}
            quickActions={quickActions}
            tableTitle="Recent Trips"
            tableColumns={tableColumns}
            tableRows={tableRows}
            isTableLoading={isTripStatsLoading || isRequestsLoading}
            emptyMessage="No trips found"
            expandable
            rowKey={(row) => row.id}
            renderExpandedRow={renderExpandedRow}
        />
    );
}

export default InhouseDriverDashboard;
