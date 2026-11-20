import { Tooltip } from 'react-tooltip';
import edit from '../../assets/images/edit.svg';

export const RenderAction = ({ onEditClick, row }) => (
  <>
    <Tooltip id="cam-edit" place="top" content="Edit" />
    <div className="actions">
      <span data-tooltip-id="cam-edit" type="button" onClick={() => onEditClick(row)} className="edit">
        <img src={edit} alt="edit" />
      </span>
    </div>
  </>
);

export const RenderFile = ({ row }) => {
  if (!row?.file_url) return row?.file_name || '—';
  return (
    <a href={row.file_url} target="_blank" rel="noopener noreferrer" title={row.file_name}>
      {row.file_name || 'View file'}
    </a>
  );
};
