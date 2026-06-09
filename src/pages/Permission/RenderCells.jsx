/* eslint-disable react/prop-types */
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
// import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({ onEditClick, row, onDeleteClick }) => {
  return (
    <div className="actions">
      <span type="button" onClick={() => onEditClick(row)} className="edit">
        <img src={edit} alt="edit" />
      </span>
      <span type="button" className="delete" onClick={() => onDeleteClick(row)}>
        <img src={trash} alt="archive" />
      </span>
    </div>
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
