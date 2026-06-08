/* eslint-disable react/prop-types */
import moment from 'moment';

import { Tooltip } from 'react-tooltip';
import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import archiveIcon from '../../assets/images/archive.svg';
import unarchiveIcon from '../../assets/images/unarchive.svg';

export const RenderAction = ({ onEditClick, row, onDeleteClick, onArchiveClick }) => {
  const archiveTipId = `archive-perm-${row?.role_id ?? 'row'}`;
  return (
    <>
      <Tooltip id="edit-perm" place="bottom" content="Edit" />
      <Tooltip id={archiveTipId} place="bottom" content={row.is_archived ? 'Unarchive' : 'Archive'} />
      <Tooltip id="delete-perm" place="bottom" content="Delete" />
      <div className="actions">
        <span data-tooltip-id="edit-perm" type="button" onClick={() => onEditClick(row)} className="edit">
          <img src={edit} alt="edit" />
        </span>
        <span
          data-tooltip-id={archiveTipId}
          type="button"
          onClick={() => onArchiveClick(row)}
          className="edit"
        >
          <img src={row.is_archived ? unarchiveIcon : archiveIcon} alt={row.is_archived ? 'unarchive' : 'archive'} />
        </span>
        <span data-tooltip-id="delete-perm" type="button" className="delete" onClick={() => onDeleteClick(row)}>
          <img src={trash} alt="delete" />
        </span>
      </div>
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD MMMM YYYY hh:mm a');
  return formattedDate;
};

// export const RenderName = ({ row }) => {
//   return (
//     <>
//       <span className="name-letter bg-ltr">
//         {getInitials(`${row?.firstName} ${row?.lastName}`)}
//       </span>
//       {row?.firstName}&nbsp;
//       {row?.lastName}
//     </>
//   );
// };
