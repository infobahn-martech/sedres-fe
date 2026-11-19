import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import edit from '../../assets/images/edit.svg';
import trash from '../../assets/images/delete.svg';
import permissionIcon from '../../assets/images/icon-lock.svg';
import unarchiveIcon from '../../assets/images/CircleTick.svg';
import { getInitials } from '../../shared/utils/utils';

export const RenderAction = ({
  onEditClick,
  row,
  onDeleteClick,
  onToggleClick,
  onPermissionClick,
  onUnarchiveClick,
  // New module/action permission system (User Management → Users is fully
  // migrated: these flags are the sole gate for visibility, no legacy role
  // fallback). Default to false so controls fail closed if a caller forgets
  // to pass them.
  canEditUser = false,
  canManagePermission = false,
  canArchiveUser = false,
  canToggleUserStatus = false,
}) => {
  const isActive = row?.user_status === "Active";
  const isArchived = row?.user_status === "Archive";

  if (isArchived) {
    if (!canArchiveUser) return null;
    const unarchiveTipId = `unarchive-user-${row?.user_id ?? 'row'}`;
    return (
      <>
        <Tooltip id={unarchiveTipId} place="top" content="Unarchive" />
        <div className="actions">
          <span
            data-tooltip-id={unarchiveTipId}
            type="button"
            className="edit"
            onClick={() => onUnarchiveClick(row)}
            style={{ cursor: 'pointer' }}
          >
            <img src={unarchiveIcon} alt="unarchive" />
          </span>
        </div>
      </>
    );
  }

  const toggleTipId = `toggle-user-${row?.user_id ?? 'row'}`;
  const editTipId = `edit-user-${row?.user_id ?? 'row'}`;
  const archiveTipId = `archive-user-${row?.user_id ?? 'row'}`;
  const permissionTipId = `permission-user-${row?.user_id ?? 'row'}`;

  return (
    <>
      {canToggleUserStatus && <Tooltip id={toggleTipId} place="top" content={isActive ? "Deactivate" : "Activate"} />}
      {canEditUser && <Tooltip id={editTipId} place="top" content="Edit" />}
      {canArchiveUser && <Tooltip id={archiveTipId} place="top" content="Archive" />}
      {canManagePermission && <Tooltip id={permissionTipId} place="top" content="Permission" />}
      <div className="actions">
        {canToggleUserStatus && (
          <span
            data-tooltip-id={toggleTipId}
            type="button"
            className="toggle-action"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginRight: '8px',
              cursor: 'pointer'
            }}
          >
            <label
              className="user-toggle-switch"
              style={{
                margin: 0,
                position: 'relative',
                display: 'inline-block',
                width: '36px',
                height: '20px',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggleClick(row)}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span
                className="user-toggle-slider"
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isActive ? '#00368c' : '#d1d5db',
                  transition: '0.3s',
                  borderRadius: '20px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: '14px',
                    width: '14px',
                    left: isActive ? 'calc(100% - 17px)' : '3px',
                    top: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </span>
            </label>
          </span>
        )}
        {canEditUser && (
          <span
            data-tooltip-id={editTipId}
            type="button"
            onClick={() => onEditClick(row)}
            className="edit"
          >
            <img src={edit} alt="edit" />
          </span>
        )}
        {canManagePermission && (
          <span
            data-tooltip-id={permissionTipId}
            type="button"
            onClick={() => onPermissionClick(row)}
            className="permission"
            style={{ marginRight: '8px', cursor: 'pointer' }}
          >
            <img src={permissionIcon} alt="permission" />
          </span>
        )}
        {canArchiveUser && (
          <span
            data-tooltip-id={archiveTipId}
            type="button"
            className="delete"
            onClick={() => onDeleteClick(row)}
          >
            <img src={trash} alt="archive" />
          </span>
        )}
      </div>
    </>
  );
};

export const RenderName = ({ row }) => {
  const hasAvatar = row?.avatar_path;

  return (
    <>
      <span className="name-letter bg-ltr">
        {hasAvatar ? (
          <img
            src={row.avatar_path}
            alt={row?.name || 'User avatar'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%'
            }}
            onError={(e) => {
              // Hide image and show initials on error
              e.target.style.display = 'none';
              const initialsSpan = e.target.nextElementSibling;
              if (initialsSpan) {
                initialsSpan.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <span style={{ display: hasAvatar ? 'none' : 'flex' }}>
          {getInitials(`${row?.name}`)}
        </span>
      </span>
      {row?.name}
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD/MM/YYYY hh:mm a');
  return formattedDate;
};
