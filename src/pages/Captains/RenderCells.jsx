import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({ onEditClick, row, onDeleteClick, onStatusClick }) => {
    const isActive = row?.status === 'Active' || Number(row?.status) === 1;
    const toggleTipId = `captain-toggle-${row?.taxiboat_captain_id ?? 'row'}`;

    return (
        <>
            <Tooltip id={toggleTipId} place="top" content={isActive ? 'Deactivate' : 'Activate'} />
            <Tooltip id="edit" place="top" content="Edit" />
            <Tooltip id="delete" place="top" content="Delete" />
            <div className="actions">
                <span data-tooltip-id={toggleTipId} className="captain-toggle-wrap">
                    <label className="captain-toggle-switch">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => onStatusClick(row)}
                        />
                        <span className="captain-toggle-slider" />
                    </label>
                </span>
                <span
                    data-tooltip-id="edit"
                    type="button"
                    onClick={() => onEditClick(row)}
                    className="edit"
                >
                    <img src={edit} alt="edit" />
                </span>
                <span
                    data-tooltip-id="delete"
                    type="button"
                    className="delete"
                    onClick={() => onDeleteClick(row)}
                >
                    <img src={trash} alt="delete" />
                </span>
            </div>
        </>
    );
};

export const RenderName = ({ row }) => {
    const name = row?.captain_name ?? row?.captainName;
    return (
        <>
            <span className="name-letter bg-ltr">
                {getInitials(`${name}`)}
            </span>
            {name}
        </>
    );
};

export const DateFormat = ({ row, selector }) => {
    const formattedDate = moment(row[selector]).format('DD/MM/YYYY hh:mm a');
    return formattedDate;
};
