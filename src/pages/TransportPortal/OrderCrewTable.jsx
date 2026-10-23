import dayjs from 'dayjs';
import { FiUsers, FiGlobe } from 'react-icons/fi';
import { StatusBadge } from '../Dashboard/dashboardWidgets';
import '../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../design/scss/vendor-portal.scss';

const PICKUP_STATUS_META = {
    pending: { label: 'Pending', tone: 'warning' },
    'picked up': { label: 'Picked Up', tone: 'info' },
    'dropped off': { label: 'Dropped Off', tone: 'success' },
    completed: { label: 'Completed', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const AVATAR_TONES = ['blue', 'violet', 'green', 'amber'];

const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = dayjs(value);
    // Backend sends 1899-12-30 (SQL zero date) when no date is set
    return parsed.isValid() && parsed.year() >= 1900 ? parsed.format('DD MMM YYYY, HH:mm') : '—';
};

const getInitials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || '?';

/** Expanded order view: crew list with pickup status and pick-up / drop-off times. `row` comes from toOrderRow. */
function OrderCrewTable({ row }) {
    return (
        <div className="trip-details">
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
                                    <th>Nationality</th>
                                    <th>Passport No</th>
                                    <th>Status</th>
                                    <th>Pick Up</th>
                                    <th>Drop Off</th>
                                </tr>
                            </thead>
                            <tbody>
                                {row.crew.map((crew, i) => {
                                    // Field names differ between order APIs.
                                    const name = crew.crew_name ?? crew.name;
                                    const passport = crew.passport_no ?? crew.passport;
                                    const status = (crew.pickup_status || '').toLowerCase();
                                    return (
                                        <tr key={`${row.poNo}-crew-${i}`}>
                                            <td>
                                                <span className="trip-details__person">
                                                    <span className={`trip-details__avatar tone-${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                                                        {getInitials(name)}
                                                    </span>
                                                    {name || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                {crew.rank ? <span className="trip-details__rank">{crew.rank}</span> : '—'}
                                            </td>
                                            <td>
                                                <span className="trip-details__person">
                                                    <FiGlobe className="trip-details__muted-icon" />
                                                    {crew.nationality || '—'}
                                                </span>
                                            </td>
                                            <td className="trip-details__mono">{passport || '—'}</td>
                                            <td>
                                                {status ? <StatusBadge status={status} meta={PICKUP_STATUS_META} /> : '—'}
                                            </td>
                                            <td>{formatDateTime(crew.pickup_datetime)}</td>
                                            <td>{formatDateTime(crew.drop_offdatetime)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="trip-details__empty">No crew details available</p>
                )}
            </div>
        </div>
    );
}

export default OrderCrewTable;
