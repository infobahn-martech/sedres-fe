import { useState, useEffect } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { UserModal } from "./Modals/AddEditUser";
import { PermissionModal } from "../Permission/Modals/AddEditPermission";
import { RenderAction, RenderName } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useUserReducer from "../../store/UserReducer";
import usePermissions from "../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../shared/constants/permissions";

const User = () => {
  const { hasPermission } = usePermissions();
  const canAddUser = hasPermission({
    moduleKey: PERMISSION_MODULES.USER_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.USERS,
    actionKey: PERMISSION_ACTIONS.ADD,
  });
  const canEditUser = hasPermission({
    moduleKey: PERMISSION_MODULES.USER_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.USERS,
    actionKey: PERMISSION_ACTIONS.EDIT,
  });
  const canManagePermission = hasPermission({
    moduleKey: PERMISSION_MODULES.USER_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.USERS,
    actionKey: PERMISSION_ACTIONS.PERMISSION,
  });
  const canArchiveUser = hasPermission({
    moduleKey: PERMISSION_MODULES.USER_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.USERS,
    actionKey: PERMISSION_ACTIONS.ARCHIVE,
  });
  const canToggleUserStatus = hasPermission({
    moduleKey: PERMISSION_MODULES.USER_MANAGEMENT,
    submoduleKey: PERMISSION_SUBMODULES.USERS,
    actionKey: PERMISSION_ACTIONS.TOGGLE_STATUS,
  });

  const [params, setParams] = useState({
    page: 1,
    searchTerm: "",
    limit: 10,
    sortBy: "",
    sortOrder: 1,
  });

  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const {
    getUsers,
    users,
    userCount,
    isLoading,
    getUserPermissions,
    userPermissions,
    isLoadingPermissions,
    updateUserPermission,
    isUpdatingUserPermission,
    activateUser,
    archiveUser,
    unarchiveUser,
    isArchiving,
    isUnarchiving,
  } = useUserReducer((state) => state);

  useEffect(() => {
    getUsers({ params });
  }, [params]);


  // 👉 ONLY TWO COLUMNS (Name + Description)
  const cols = [
    {
      name: "Name",
      selector: "firstName",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: RenderName,
      sort: true,
    },
    {
      name: "Role",
      selector: "role",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      sort: true,
    },
    {
      name: "Username",
      selector: "username",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: ({ row }) => <span>{row.username || "-"}</span>,
      sort: true,
    },
    {
      name: "Email",
      selector: "email",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: ({ row }) => <span>{row.email || "-"}</span>,
      sort: true,
    },
    {
      name: "Phone",
      // selector: "phone",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: ({ row }) => (
        <span>
          {row.phone ? `+${row.phone}` : "-"}
        </span>
      ),
      sort: true,
    },
    {
      name: "Status",
      selector: "user_status",
      width: "150",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: ({ row }) => (
        <span
          className={
            row.user_status === "Active"
              ? "status-active"
              : row.user_status === "Inactive"
                ? "status-inactive"
                : "status-pending"
          }
        >
          {row.user_status}
        </span>
      ),
    },
    {
      name: "Actions",
      selector: "linksInfo",
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: RenderAction,
      canEditUser,
      canManagePermission,
      canArchiveUser,
      canToggleUserStatus,
      onEditClick: (row) => {
        if (!canEditUser) return;
        setShowUserModal(row);
      },
      onToggleClick: (row) => {
        if (!canToggleUserStatus) return;
        activateUser({ user_id: row?.user_id, cb: () => getUsers({ params }) });
      },
      onPermissionClick: async (row) => {
        if (!canManagePermission) return;
        setSelectedUser(row);
        await getUserPermissions({ userId: row?.user_id });
        setShowPermissionModal(true);
      },
      onDeleteClick: (row) => {
        if (!canArchiveUser) return;
        setSelectedUser(row);
        setShowDeleteModal(true);
      },
      onUnarchiveClick: (row) => {
        if (!canArchiveUser) return;
        setSelectedUser(row);
        setShowUnarchiveModal(true);
      },
    },
  ];
  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Users"
              isAddEnabled={canAddUser}
              addModalLabel="Add User"
              setSearch={(e) =>
                setParams({ ...params, searchTerm: e, page: 1 })
              }
              onAddModalClick={() => {
                if (!canAddUser) return;
                setShowUserModal(true);
              }}
              exportTitle="Export"
              exportLoader={false}
            />
          </div>

          <CustomTable
            Sl
            pagination={{ currentPage: params.page, limit: params.limit }}
            tableClasses="px-start"
            columns={cols}
            data={users ?? []}
            count={userCount ?? 0}
            isLoading={isLoading}
            onPageChange={(currentPage) =>
              setParams({ ...params, page: currentPage })
            }
            setLimit={(newLimit) =>
              setParams({ ...params, limit: newLimit })
            }
            onSorting={(sortBy) =>
              setParams({
                ...params,
                sortBy,
                sortOrder: params.sortOrder === 1 ? -1 : 1,
                page: 1,
              })
            }
          />

          {!!showUserModal && (
            <UserModal
              showModal={showUserModal}
              closeModal={() => {
                setShowUserModal(false);
              }}
              onSuccess={() => {
                getUsers({ params });
              }}
            />
          )}
          {!!showPermissionModal && (
            <PermissionModal
              showModal={showPermissionModal}
              closeModal={() => {
                setShowPermissionModal(false);
                setSelectedUser(null);
              }}
              userPermissions={userPermissions}
              isLoadingPermissions={isLoadingPermissions}
              selectedUser={selectedUser}
              updateUserPermission={updateUserPermission}
              isUpdatingUserPermission={isUpdatingUserPermission}
            />
          )}
          {!!showDeleteModal && (
            <DeleteConfirmationModal
              show={showDeleteModal}
              onCancel={() => {
                setShowDeleteModal(false);
                setSelectedUser(null);
              }}
              onConfirm={() => {
                archiveUser({ user_id: selectedUser?.user_id, cb: () => getUsers({ params }) });
                setShowDeleteModal(false);
                setSelectedUser(null);
              }}
              deleteText={`Are you sure you want to archive this user ${selectedUser?.firstName ?? selectedUser?.name ?? ""}?`}
              isLoading={isArchiving}
            />
          )}
          {!!showUnarchiveModal && (
            <DeleteConfirmationModal
              show={showUnarchiveModal}
              onCancel={() => {
                setShowUnarchiveModal(false);
                setSelectedUser(null);
              }}
              onConfirm={() => {
                unarchiveUser({ user_id: selectedUser?.user_id, cb: () => getUsers({ params }) });
                setShowUnarchiveModal(false);
                setSelectedUser(null);
              }}
              deleteText={`Are you sure you want to unarchive this user ${selectedUser?.firstName ?? selectedUser?.name ?? ""}?`}
              isLoading={isUnarchiving}
            />
          )}

        </div>
      </div>
    </>
  );
};

export default User;
