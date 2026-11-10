import { Tooltip } from 'react-tooltip';
import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({ onEditClick, row, onDeleteClick }) => {
    return (
        <>
            <Tooltip id="edit" place="top" content="Edit" />
            <Tooltip id="delete" place="top" content="Delete" />
            <div className="actions">
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
    return (
        <>
            <span className="name-letter bg-ltr">
                {getInitials(`${row?.name}`)}
            </span>
            {row?.name}
        </>
    );
};

export const RenderDescription = ({ row, selector }) => {
    const description = row[selector] || '';
    const MAX_LENGTH = 120;
    const isTruncated = description.length > MAX_LENGTH;
    const tooltipId = `tps-desc-${row?._id || row?.third_party_service_id || Math.random()}`;

    if (!description) {
        return <span>-</span>;
    }

    return (
        <>
            {isTruncated && (
                <Tooltip
                    id={tooltipId}
                    place="top"
                    content={description}
                    className="third-party-description-tooltip"
                />
            )}
            <span
                data-tooltip-id={isTruncated ? tooltipId : undefined}
                className={`third-party-description-text${isTruncated ? " is-truncated" : ""}`}
            >
                {description}
            </span>
        </>
    );
};
