import React, { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { GroupEmailBEModal } from "./Modals/AddEditGroupEmail";
import { RenderAction } from "./renderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useGroupEmailBEReducer from "../../store/GroupEmailBEReducer";
import useBillingEntityReducer from "../../store/BillingEntityReducer";
import usePermissions from "../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../shared/constants/permissions";

const GroupEmailBE = () => {
    const { hasPermission } = usePermissions();
    const canAddGroupEmail = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.GROUP_EMAIL,
        actionKey: PERMISSION_ACTIONS.ADD,
    });
    const canEditGroupEmail = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.GROUP_EMAIL,
        actionKey: PERMISSION_ACTIONS.EDIT,
    });
    const canDeleteGroupEmail = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.GROUP_EMAIL,
        actionKey: PERMISSION_ACTIONS.DELETE,
    });

    const {
        getGroupEmailBEs,
        groupEmailBEs,
        isLoading,
        deleteGroupEmailBE,
        isDeleteLoading,
        totalCount,
    } = useGroupEmailBEReducer((state) => state);

    const { getBillingEntities, billingEntities } =
        useBillingEntityReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        search: "",
        limit: 10,
        sortBy: "billing_entity",
        sortOrder: 1,
    });

    const [filterValues, setFilterValues] = useState({ entity_id: "" });

    const [showGroupEmailModal, setShowGroupEmailModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getBillingEntities({ params: { page: 1, limit: 1000 } });
    }, []);

    const apiParams = useMemo(
        () => ({
            search: params.search || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder === 1 ? "ASC" : "DESC",
            ...(params.entity_id && { entity_id: params.entity_id }),
        }),
        [params]
    );

    useEffect(() => {
        getGroupEmailBEs({ params: apiParams });
    }, [params]);

    const list = groupEmailBEs || [];

    const billingEntityOptions = (billingEntities ?? []).map((be) => ({
        value: String(be.entity_id ?? ""),
        label: String(be.billing_entity ?? ""),
    }));

    const handleOpenAdd = () => {
        if (!canAddGroupEmail) return;
        setSelectedRow(null);
        setShowGroupEmailModal({});
    };

    const handleOpenEdit = (row) => {
        if (!canEditGroupEmail) return;
        setSelectedRow(row);
        setShowGroupEmailModal(row);
    };

    const handleOpenDelete = (row) => {
        if (!canDeleteGroupEmail) return;
        setSelectedRow(row);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!canDeleteGroupEmail) return;
        if (!selectedRow?.entity_id) return;

        await deleteGroupEmailBE({
            groupEmailBE_id: selectedRow.entity_id,
            cb: () => {
                setShowDeleteModal(false);
                setSelectedRow(null);
                getGroupEmailBEs({ params: apiParams });
            },
        });
    };

    const cols = [
        {
            name: "Billing Entity",
            selector: "billing_entity",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Email Count",
            selector: "email_count",
            sort: false,
            width: "140",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Actions",
            selector: "linksInfo",
            tableClasses: "table-striped",
            contentClass: "table-content",
            thclass: "tb-head",
            canEditGroupEmail,
            canDeleteGroupEmail,
            onEditClick: (row) => handleOpenEdit(row),
            onDeleteClick: (row) => handleOpenDelete(row),
            cell: RenderAction,
            width: "180",
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Billing Entity Group Email"
                            isAddEnabled={canAddGroupEmail}
                            addModalLabel="Add Group Email"
                            setSearch={(e) => setParams({ ...params, search: e, page: 1 })}
                            onAddModalClick={handleOpenAdd}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        isLoading={isLoading}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalCount}
                        columns={cols}
                        data={list}
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

                    {!!showGroupEmailModal && (
                        <GroupEmailBEModal
                            showModal={showGroupEmailModal}
                            closeModal={() => {
                                setShowGroupEmailModal(false);
                                setSelectedRow(null);
                            }}
                            onSuccess={() => {
                                setShowGroupEmailModal(false);
                                setSelectedRow(null);
                                getGroupEmailBEs({ params: apiParams });
                            }}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            isLoading={isDeleteLoading}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setSelectedRow(null);
                            }}
                            onConfirm={handleConfirmDelete}
                            deleteText="Are you sure you want to delete this group email?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default GroupEmailBE;
