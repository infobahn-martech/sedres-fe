import dayjs from 'dayjs';
import '../../design/scss/vendor-portal.scss';
import '../../design/scss/form-designs.scss';

const PICKUP_STATUS_CLASS_MAP = {
    'pending': 'status-pending',
    'picked up': 'status-approved',
    'dropped off': 'status-completed',
    'completed': 'status-completed',
    'cancelled': 'status-rejected',
};

const getPickupStatusClass = (status) =>
    PICKUP_STATUS_CLASS_MAP[(status || '').toLowerCase()] || '';

const toDateTimeLocal = (value) => {
    if (!value) return '';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm') : '';
};

/** Expanded order view: crew list with pickup status and check-in/out times. `row` comes from toOrderRow. */
function OrderCrewTable({ row }) {
    return (
        <div className="vendor-table-scroll">
            <table className="vendor-table" style={{ marginBottom: 0, minWidth: 960 }}>
                <thead>
                    <tr>
                        <th>Crew Name</th>
                        <th>Rank</th>
                        <th>Nationality</th>
                        <th>Passport No</th>
                        <th>Pickup Status</th>
                        <th>CheckIn</th>
                        <th>CheckOut</th>
                    </tr>
                </thead>
                <tbody>
                    {row.crew.length ? (
                        row.crew.map((crew, i) => (
                            <tr key={`${row.poNo}-crew-${i}`}>
                                <td>{crew.name}</td>
                                <td>{crew.rank ?? '—'}</td>
                                <td>{crew.nationality}</td>
                                <td>{crew.passport}</td>
                                <td>
                                    <span className={`vendor-status-badge ${getPickupStatusClass(crew.pickup_status)}`}>
                                        {crew.pickup_status ?? '—'}
                                    </span>
                                </td>
                                <td>
                                    <input
                                        type="datetime-local"
                                        readOnly
                                        tabIndex={-1}
                                        className="form-control form-control-sm vendor-crew-datetime-input vendor-crew-datetime-input--readonly"
                                        value={toDateTimeLocal(crew.pickup_datetime)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="datetime-local"
                                        readOnly
                                        tabIndex={-1}
                                        className="form-control form-control-sm vendor-crew-datetime-input vendor-crew-datetime-input--readonly"
                                        value={toDateTimeLocal(crew.drop_offdatetime)}
                                    />
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} style={{ color: '#6b7280' }}>
                                No crew details available
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default OrderCrewTable;
