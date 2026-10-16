import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import { getInitials } from '../../shared/utils/utils';
import { normalizeHexColor } from '../../components/SedresColorPicker/sedresColorPickerConstants';

export const RenderAction = ({ onEditClick, row, onDeleteClick, hideDelete, canEditBillingEntity = false }) => {
  return (
    <>
      {canEditBillingEntity && <Tooltip id="edit" place="top" content="Edit" />}
      {!hideDelete && <Tooltip id="delete" place="top" content="Delete" />}
      <div className="actions">
        {canEditBillingEntity && (
          <span
            data-tooltip-id="edit"
            type="button"
            onClick={() => onEditClick(row)}
            className="edit"
          >
            <img src={edit} alt="edit" />
          </span>
        )}
        {!hideDelete && (
          <span
            data-tooltip-id="delete"
            type="button"
            className="delete"
            onClick={() => onDeleteClick(row)}
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
        {getInitials(`${row?.firstName} ${row?.lastName}`)}
      </span>
      {row?.firstName}&nbsp;
      {row?.lastName}
    </>
  );
};

export const RenderColorCode = ({ row }) => {
  if (!row?.color_code) return '—';
  const hex = normalizeHexColor(row.color_code);
  return (
    <span className="color-code-cell">
      <span className="color-code-swatch" style={{ backgroundColor: hex }} aria-hidden />
      {hex.toUpperCase()}
    </span>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD MMMM YYYY hh:mm a');
  return formattedDate;
};
