/* eslint-disable react/prop-types */
import moment from 'moment';
import { Tooltip } from 'react-tooltip';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import unarchiveIcon from '../../assets/images/CircleTick.svg';

export const RenderAction = ({
  onEditClick,
  row,
  onDeleteClick,
  onUnarchiveClick,
  // New module/action permission system — default to false so controls fail
  // closed if a caller forgets to pass them.
  canEditPermission = false,
  canArchivePermission = false,
}) => {
  const isArchived = row?.status === '2';
  const unarchiveTipId = `unarchive-role-${row?.role_id ?? 'row'}`;

  if (isArchived) {
    if (!canArchivePermission) return null;
    return (
      <>
        <Tooltip id={unarchiveTipId} place="top" content="Unarchive" />
        <div className="actions">
          <span
            data-tooltip-id={unarchiveTipId}
            type="button"
            className="edit"
            onClick={() => onUnarchiveClick(row)}
          >
            <img src={unarchiveIcon} alt="unarchive" />
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {canEditPermission && <Tooltip id="edit-role" place="top" content="Edit" />}
      {canArchivePermission && <Tooltip id="archive-role" place="top" content="Archive" />}
      <div className="actions">
        {canEditPermission && (
          <span data-tooltip-id="edit-role" type="button" onClick={() => onEditClick(row)} className="edit">
            <img src={edit} alt="edit" />
          </span>
        )}
        {canArchivePermission && (
          <span data-tooltip-id="archive-role" type="button" className="delete" onClick={() => onDeleteClick(row)}>
            <img src={trash} alt="archive" />
          </span>
        )}
      </div>
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD MMMM YYYY hh:mm a');
  return formattedDate;
};
