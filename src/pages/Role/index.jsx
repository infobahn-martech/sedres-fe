import { useState, useEffect } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { RoleModal } from "./Modals/AddEditRole";
import { RenderAction, RenderDescription } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useRoleReducer from "../../store/RoleReducer";

const Role = () => {
  const [params, setParams] = useState({
    page: 1,
    searchTerm: "",
    limit: 10,
    sortBy: "name",
    sortOrder: 1,
  });

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleForDelete, setSelectedRoleForDelete] = useState(null);

  const {
    fetchRoles,
    roles,
    createRole,
    updateRole,
    deleteRole,
    archiveUnarchiveRole,
    isBeingUpdated,
    isLoading,
    totalRoleCount,
  } = useRoleReducer((state) => state);

  const getApiParams = () => ({
    page: params.page,
    limit: params.limit,
    ...(params.searchTerm && { search: params.searchTerm }),
    ...(params.sortBy && { sort_by: params.sortBy }),
  });

  useEffect(() => {
    fetchRoles({ params: getApiParams() });
  }, [params]);

  const cols = [
    {
      name: "Name",
      selector: "name",
      sort: true,
      width: "200",
      thclass: "tb-head",
      contentClass: "table-content",
    },
    {
      name: "Description",
      selector: "description",
      sort: true,
      width: "600",
      thclass: "tb-head",
      contentClass: "table-content",
      cell: RenderDescription,
    },
    {
      name: 'Actions',
      selector: 'linksInfo',
      tableClasses: 'table-striped',
      contentClass: 'table-content',
      thclass: 'tb-head',
      onEditClick: (row) => { setShowRoleModal(row); },
      onDeleteClick: (row) => { setSelectedRoleForDelete(row); },
      onArchiveClick: (row) => {
        archiveUnarchiveRole({
          role_id: row._id,
          cb: () => fetchRoles({ params: getApiParams() }),
        });
      },
      cell: RenderAction,
      width: '150',
    },
  ];

  return (
    <>
      <div className="page-body">
        <div className="prospect employee">
          <div className="container-fluid">
            <CommonHeader
              tableTitle="Roles"
              isAddEnabled
              addModalLabel="Add Role"
              setSearch={(e) =>
                setParams({ ...params, searchTerm: e, page: 1 })
              }
              searchValue={params.searchTerm}
              onAddModalClick={() => setShowRoleModal(true)}
              exportTitle="Export"
              exportLoader={false}
            />
          </div>

          <CustomTable
            Sl
            pagination={{ currentPage: params.page, limit: params.limit }}
            tableClasses="px-start"
            count={totalRoleCount ?? 0}
            columns={cols}
            data={roles ?? []}
            isLoading={isLoading}
            onPageChange={(currentPage) =>
              setParams({ ...params, page: currentPage })
            }
            setLimit={(newLimit) =>
              setParams({ ...params, limit: newLimit, page: 1 })
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

          {!!showRoleModal && (
            <RoleModal
              showModal={showRoleModal}
              closeModal={() => setShowRoleModal(false)}
              createRole={createRole}
              updateRole={updateRole}
              onSuccess={() => {
                setShowRoleModal(false);
                fetchRoles({ params: getApiParams() });
              }}
              isBeingUpdated={isBeingUpdated}
            />
          )}
          {!!selectedRoleForDelete && (
            <DeleteConfirmationModal
              show={!!selectedRoleForDelete}
              onCancel={() => setSelectedRoleForDelete(null)}
              onConfirm={() => {
                deleteRole({
                  id: selectedRoleForDelete._id,
                  cb: () => {
                    setSelectedRoleForDelete(null);
                    fetchRoles({ params: getApiParams() });
                  },
                });
              }}
              deleteText={`Are you sure you want to delete the role "${selectedRoleForDelete?.name}"?`}
              isLoading={isBeingUpdated}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Role;
