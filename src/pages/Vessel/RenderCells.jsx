import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import unarchiveIcon from '../../assets/images/CircleTick.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({ onEditClick, row, onArchiveClick, onUnarchiveClick }) => {
  const isArchived = row?.status === '2';
  const unarchiveTipId = `unarchive-vessel-${row?.vessel_id ?? 'row'}`;

  if (isArchived) {
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
      <Tooltip id="edit-vessel" place="top" content="Edit" />
      <Tooltip id="archive-vessel" place="top" content="Archive" />
      <div className="actions">
        <span
          data-tooltip-id="edit-vessel"
          type="button"
          onClick={() => onEditClick(row)}
          className="edit"
        >
          <img src={edit} alt="edit" />
        </span>
        <span
          data-tooltip-id="archive-vessel"
          type="button"
          className="delete"
          onClick={() => onArchiveClick(row)}
        >
          <img src={trash} alt="archive" />
        </span>
      </div>
    </>
  );
};

export const RenderName = ({ row }) => {
  return (
    <>
      <span className="name-letter bg-ltr">
        {getInitials(`${row?.firstName} ${row?.lastName}`)}
      </span>
      {row?.firstName}&nbsp;
      {row?.lastName}
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD/MM/YYYY hh:mm a');
  return formattedDate;
};
