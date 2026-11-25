import {
    FiPaperclip,
    FiAnchor,
    FiBriefcase,
    FiHome,
    FiUsers,
    FiCalendar,
    FiMessageSquare,
    FiGlobe,
} from 'react-icons/fi';
import useInhouseDriverReducer from '../../store/InhouseDriverReducer';
import TripUpdatePanel from '../../components/TripUpdatePanel';
import '../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../design/scss/vendor-portal.scss';

const AVATAR_TONES = ['blue', 'violet', 'green', 'amber'];

const getInitials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || '?';

const hasValue = (value) => value != null && value !== '' && value !== '—';

/** Expanded trip view (route, status update, info, crew, attachments). `row` comes from toTripRow. */
function TripDetails({ row }) {
    const { isUpdatingTripStatus, updateTripStatus, getDriverTripStats } = useInhouseDriverReducer();

    const handleTripSave = async (changes) => {
        await updateTripStatus({ transportRequestId: row.id, ...changes });
        getDriverTripStats();
    };

    const infoTiles = [
        { label: 'Vessel', value: row.vesselName, icon: <FiAnchor />, tone: 'blue' },
        { label: 'Billing Entity', value: row.billingEntity, icon: <FiBriefcase />, tone: 'violet' },
        { label: 'Branch', value: row.invoiceBranch, icon: <FiHome />, tone: 'green' },
        { label: 'Seater', value: row.seater, icon: <FiUsers />, tone: 'amber' },
        { label: 'Created', value: row.createdDate, icon: <FiCalendar />, tone: 'blue' },
    ].filter(({ value }) => hasValue(value));

    return (
        <div className="trip-details">
            <TripUpdatePanel
                from={row.from}
                to={row.to}
                fromDet={row.fromDet}
                toDet={row.toDet}
                status={row.status}
                rawPickup={row.rawPickup}
                rawDropOff={row.rawDropOff}
                isSaving={isUpdatingTripStatus}
                onSave={handleTripSave}
            />

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
}

export default TripDetails;
