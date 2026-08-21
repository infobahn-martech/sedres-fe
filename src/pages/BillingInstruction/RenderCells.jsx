import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({
    onEditClick,
    row,
    onDeleteClick,
    hideDelete,
    canEditBillingInstruction = false,
    canDeleteBillingInstruction = false,
}) => {
    return (
        <>
            {canEditBillingInstruction && <Tooltip id="edit" place="top" content="Edit" />}
            {!hideDelete && canDeleteBillingInstruction && <Tooltip id="delete" place="top" content="Delete" />}
            <div className="actions">
                {canEditBillingInstruction && (
                    <span
                        data-tooltip-id="edit"
                        type="button"
                        onClick={() => onEditClick(row)}
                        className="edit"
                    >
                        <img src={edit} alt="edit" />
                    </span>
                )}
                {!hideDelete && canDeleteBillingInstruction && (
                    <span
                        data-tooltip-id="delete"
                        type="button"
                        onClick={() => onDeleteClick(row)}
                        className="delete"
                    >
                        <img src={trash} alt="delete" />
                    </span>
                )}
            </div>
        </>
    );
};

export const RenderName = ({ row }) => {
    return (
        <>
            <span className="name-letter bg-ltr">
                {getInitials(`${row?.billingInstructionName}`)}
            </span>
            {row?.billingInstructionName}
        </>
    );
};

export const DateFormat = ({ row, selector }) => {
    const formattedDate = moment(row[selector]).format('DD MMMM YYYY hh:mm a');
    return formattedDate;
};
