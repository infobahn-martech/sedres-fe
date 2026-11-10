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
