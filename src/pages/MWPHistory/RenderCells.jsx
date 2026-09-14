import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import eye from '../../assets/images/eye.svg';

export const RenderAction = ({ row, onViewClick }) => {
  return (
    <>
      <Tooltip id="view" place="top" content="View" />
      <div className="actions">
        <span
          data-tooltip-id="view"
          type="button"
          className="view"
          onClick={(e) => {
            e.stopPropagation();
            onViewClick && onViewClick(row);
          }}
        >
          <img src={eye} alt="view" />
        </span>
      </div>
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const value = row?.[selector];
  if (!value) return '—';
  const m = moment(value);
  return m.isValid() ? m.format('DD MMM YYYY') : '—';
};

export const getMwpStatus = (row) => {
  if (row?.expiry_date && moment(row.expiry_date).isBefore(moment(), 'day')) {
    return 'Expired';
  }
  if (row?.issued_date) return 'Issued';
  if (row?.approved_date) return 'Approved';
  if (row?.applied_date) return 'Applied';
  return '—';
};

export const RenderStatus = ({ row }) => {
  const status = getMwpStatus(row);
  const tone = status.toLowerCase();
  return <span className={`status-badge status-${tone}`}>{status}</span>;
};

