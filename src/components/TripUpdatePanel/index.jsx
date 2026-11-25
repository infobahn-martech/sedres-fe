import { useState } from 'react';
import dayjs from 'dayjs';
import { notify } from '../Toaster';
import { FiCheckCircle, FiClock, FiMapPin, FiCheck, FiActivity } from 'react-icons/fi';
import DateTimePickerField from '../../pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField';
import '../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../design/scss/vendor-portal.scss';

const TRIP_STATUS_OPTIONS = [
    { value: 'Pending', tone: 'amber', icon: <FiClock /> },
    { value: 'In Progress', tone: 'blue', icon: <FiActivity /> },
    { value: 'Completed', tone: 'green', icon: <FiCheckCircle /> },
];

const hasValue = (value) => value != null && value !== '' && value !== '—';

const EMPTY_PARTS = { date: '', time: '' };

/** API datetime → DateTimePickerField parts (empty when unset / SQL zero date). */
const toPickerParts = (value) => {
    if (!value) return EMPTY_PARTS;
    const parsed = dayjs(value);
    if (!parsed.isValid() || parsed.year() < 1900) return EMPTY_PARTS;
    return { date: parsed.format('YYYY-MM-DD'), time: parsed.format('HH:mm') };
};

/** DateTimePickerField parts → API datetime ('' when not fully set). */
const toApiValue = ({ date, time }) => (date && time ? `${date} ${time}:00` : '');

const toDayjs = (parts) => (parts.date && parts.time ? dayjs(`${parts.date} ${parts.time}`) : null);

/** Matches the API status case-insensitively to one of the selectable options. */
const normalizeStatus = (status) =>
    TRIP_STATUS_OPTIONS.find(({ value }) => value.toLowerCase() === String(status || '').toLowerCase())?.value ??
    status;

/**
 * Route with editable pickup / drop-off times plus the trip status selector.
 * Shared by the Inhouse Driver trip view and the Transport Company order view.
 * `onSave({ status, pickupDatetime, dropOffDatetime })` must throw on failure.
 */
function TripUpdatePanel({ from, to, fromDet, toDet, status, rawPickup, rawDropOff, isSaving, onSave }) {
    const initialStatus = normalizeStatus(status);
    const initialPickup = toApiValue(toPickerParts(rawPickup));
    const initialDropOff = toApiValue(toPickerParts(rawDropOff));

    const [selectedStatus, setSelectedStatus] = useState(initialStatus);
    const [pickupParts, setPickupParts] = useState(() => toPickerParts(rawPickup));
    const [dropOffParts, setDropOffParts] = useState(() => toPickerParts(rawDropOff));

    const pickupValue = toApiValue(pickupParts);
    const dropOffValue = toApiValue(dropOffParts);
    const pickupDayjs = toDayjs(pickupParts);
    const dropOffDayjs = toDayjs(dropOffParts);

    const isUnchanged =
        selectedStatus === initialStatus && pickupValue === initialPickup && dropOffValue === initialDropOff;
    const isDropOffBeforePickup = !!pickupDayjs && !!dropOffDayjs && dropOffDayjs.isBefore(pickupDayjs);

    const handleSave = async () => {
        if (isUnchanged) return;
        if (isDropOffBeforePickup) {
            notify('Drop-off time cannot be before pickup time', 'error');
            return;
        }
        try {
            await onSave({ status: selectedStatus, pickupDatetime: pickupValue, dropOffDatetime: dropOffValue });
            notify('Trip updated successfully', 'success');
        } catch (error) {
            const message = error?.response?.data?.message;
            notify(typeof message === 'string' ? message : 'Failed to update trip', 'error');
        }
    };

    return (
        <div className="trip-details__top">
            <div className="trip-details__card trip-details__route">
                <div className="trip-details__stop">
                    <span className="trip-details__stop-dot trip-details__stop-dot--from" />
                    <div className="trip-details__stop-body">
                        <div className="trip-details__stop-info">
                            <p className="trip-details__eyebrow">Pickup</p>
                            <p className="trip-details__place">{from || '—'}</p>
                            {hasValue(fromDet) && <p className="trip-details__note">{fromDet}</p>}
                        </div>
                        <div className="trip-details__stop-time">
                            <span className="trip-details__eyebrow">
                                <FiClock /> Pickup time
                            </span>
                            <DateTimePickerField
                                dateValue={pickupParts.date}
                                timeValue={pickupParts.time}
                                onDateTimeChange={setPickupParts}
                                placeholder="Select pickup time"
                            />
                        </div>
                    </div>
                </div>
                <div className="trip-details__stop">
                    <span className="trip-details__stop-dot trip-details__stop-dot--to">
                        <FiMapPin />
                    </span>
                    <div className="trip-details__stop-body">
                        <div className="trip-details__stop-info">
                            <p className="trip-details__eyebrow">Drop-off</p>
                            <p className="trip-details__place">{to || '—'}</p>
                            {hasValue(toDet) && <p className="trip-details__note">{toDet}</p>}
                        </div>
                        <div className="trip-details__stop-time">
                            <span className="trip-details__eyebrow">
                                <FiClock /> Drop-off time
                            </span>
                            <DateTimePickerField
                                dateValue={dropOffParts.date}
                                timeValue={dropOffParts.time}
                                onDateTimeChange={setDropOffParts}
                                minDate={pickupParts.date || undefined}
                                hasError={isDropOffBeforePickup}
                                placeholder="Select drop-off time"
                            />
                            {isDropOffBeforePickup && (
                                <p className="trip-details__error">Drop-off cannot be before pickup</p>
                            )}
                        </div>
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
                            onClick={() => setSelectedStatus(value)}
                        >
                            {icon} {value}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="trip-details__save"
                    disabled={isSaving || isUnchanged || isDropOffBeforePickup}
                    onClick={handleSave}
                >
                    <FiCheck /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

export default TripUpdatePanel;
