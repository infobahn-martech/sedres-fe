import { Tooltip } from 'react-tooltip';
import { FiSend } from 'react-icons/fi';
import moment from 'moment';

import eye from '../../assets/images/eye.svg';

export const RenderAction = ({ row, onViewClick, onSendClick }) => {
  return (
    <>
      <Tooltip id="view" place="top" content="View document" />
      <Tooltip id="send-reminder" place="top" content="Send reminder" />
      <div className="actions">
        {row?.mwp_document && onViewClick && (
          <span
            data-tooltip-id="view"
            type="button"
            className="view"
            onClick={(e) => {
              e.stopPropagation();
              onViewClick(row);
            }}
          >
            <img src={eye} alt="view" />
          </span>
        )}
        {onSendClick && (
          <span
            data-tooltip-id="send-reminder"
            type="button"
            className="send"
            onClick={(e) => {
              e.stopPropagation();
              onSendClick(row);
            }}
          >
            <FiSend />
          </span>
        )}
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

export const DateTimeFormat = ({ row, selector }) => {
  const value = row?.[selector];
  if (!value) return '—';
  const m = moment(value);
  return m.isValid() ? m.format('DD MMM YYYY, hh:mm A') : '—';
};

export const RenderText = ({ row, selector }) => {
  const value = row?.[selector];
  return value === null || value === undefined || value === '' ? '—' : value;
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

