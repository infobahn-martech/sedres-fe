import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import archiveIcon from '../../assets/images/archive.svg';
import unarchiveIcon from '../../assets/images/unarchive.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({ onEditClick, row, onDeleteClick, onArchiveClick }) => {
  const archiveTooltipId = `archive-role-${row._id}`;
  return (
    <>
      <Tooltip id="edit-role" place="bottom" content="Edit" />
      <Tooltip id={archiveTooltipId} place="bottom" content={row.is_archived ? 'Unarchive' : 'Archive'} />
      <Tooltip id="delete-role" place="bottom" content="Delete" />
      <div className="actions">
        <span data-tooltip-id="edit-role" type="button" onClick={() => onEditClick(row)} className="edit">
          <img src={edit} alt="edit" />
        </span>
        <span
          data-tooltip-id={archiveTooltipId}
          type="button"
          onClick={() => onArchiveClick(row)}
          className="edit"
        >
          <img src={row.is_archived ? unarchiveIcon : archiveIcon} alt={row.is_archived ? 'unarchive' : 'archive'} />
        </span>
        <span data-tooltip-id="delete-role" type="button" className="delete" onClick={() => onDeleteClick(row)}>
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
        {getInitials(`${row?.firstName} ${row?.lastName}`)}
      </span>
      {row?.firstName}&nbsp;
      {row?.lastName}
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD MMMM YYYY hh:mm a');
  return formattedDate;
};

export const RenderDescription = ({ row, selector }) => {
  const description = row[selector] || '';
  const MAX_LENGTH = 120;
  const isTruncated = description.length > MAX_LENGTH;
  const truncatedText = isTruncated ? `${description.substring(0, MAX_LENGTH)}...` : description;
  const tooltipId = `desc-${row._id || Math.random()}`;

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
          className="role-description-tooltip"
        />
      )}
      <span
        data-tooltip-id={isTruncated ? tooltipId : undefined}
        style={{ cursor: isTruncated ? 'help' : 'default' }}
      >
        {truncatedText}
      </span>
    </>
  );
};