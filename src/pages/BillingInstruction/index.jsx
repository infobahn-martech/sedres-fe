import { useEffect, useMemo, useState } from "react";
import { RenderAction } from "./RenderCells";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { BillingInstructionModal } from "./Modals/AddEditBillingInstruction";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useBillingInstructionReducer from "../../store/BillingInstructionReducer";
import usePermissions from "../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../shared/constants/permissions";

const formatEmailsCell = (row) => {
    if (row?.instruction_type !== "Email") return "—";
    const raw = row?.emails;
    if (!Array.isArray(raw) || raw.length === 0) return "—";
    return raw
        .map((e) => (typeof e === "string" ? e : e?.email))
        .filter(Boolean)
        .join(", ");
};

const formatDescriptionCell = (row) => {
    if (row?.instruction_type === "Email") return "—";
    const d = row?.description;
    return d && String(d).trim() ? d : "—";
};

const BillingInstruction = () => {
    const { hasPermission } = usePermissions();
    const canAddBillingInstruction = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.BILLING_INSTRUCTION,
        actionKey: PERMISSION_ACTIONS.ADD,
    });
    const canEditBillingInstruction = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.BILLING_INSTRUCTION,
        actionKey: PERMISSION_ACTIONS.EDIT,
    });
    const canDeleteBillingInstruction = hasPermission({
        moduleKey: PERMISSION_MODULES.ENTITY_MANAGEMENT,
        submoduleKey: PERMISSION_SUBMODULES.BILLING_INSTRUCTION,
        actionKey: PERMISSION_ACTIONS.DELETE,
    });

    const { getAllBillingInstructions, deleteBillingInstruction, billingInstructions, isLoading, totalCount, isDeleteLoading } =
        useBillingInstructionReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        search: "",
        limit: 10,
        sortBy: "billing_entity",
        sortOrder: 1,
    });

    const [showBillingInstructionModal, setShowBillingInstructionModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRowForDelete, setSelectedRowForDelete] = useState(null);

    const apiParams = useMemo(
        () => ({
            search: params.search || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder === 1 ? "ASC" : "DESC",
        }),
        [params]
    );

    useEffect(() => {
        getAllBillingInstructions({ params: apiParams });
    }, [params]);

    const list = billingInstructions || [];

    const handleOpenAdd = () => {
        if (!canAddBillingInstruction) return;
        setShowBillingInstructionModal({});
    };

    const handleOpenEdit = (row) => {
        if (!canEditBillingInstruction) return;
        setShowBillingInstructionModal(row);
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
            name: "Instruction Type",
            selector: "instruction_type",
            sort: true,
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Description",
            selector: "description",
            sort: false,
            width: "280",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: ({ row }) => formatDescriptionCell(row),
        },
        {
            name: "Emails",
            selector: "emails",
            sort: false,
            width: "260",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: ({ row }) => formatEmailsCell(row),
        },
        {
            name: "Actions",
            selector: "actions",
            width: "120",
            cell: RenderAction,
            thclass: "tb-head",
            canEditBillingInstruction,
            canDeleteBillingInstruction,
            onEditClick: (row) => handleOpenEdit(row),
            onDeleteClick: (row) => {
                if (!canDeleteBillingInstruction) return;
                setSelectedRowForDelete(row);
                setShowDeleteModal(true);
            },
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Billing Instructions"
                            isAddEnabled={canAddBillingInstruction}
                            addModalLabel="Add Billing Instruction"
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

                    {!!showBillingInstructionModal && (
                        <BillingInstructionModal
                            showModal={showBillingInstructionModal}
                            closeModal={() => setShowBillingInstructionModal(false)}
                            onSuccess={() => {
                                setShowBillingInstructionModal(false);
                                getAllBillingInstructions({ params: apiParams });
                            }}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            isLoading={isDeleteLoading}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setSelectedRowForDelete(null);
                            }}
                            onConfirm={() => {
                                if (!canDeleteBillingInstruction) return;
                                const entity_id =
                                    selectedRowForDelete?.entity_id ??
                                    selectedRowForDelete?.billing_instruction_id ??
                                    selectedRowForDelete?.id;
                                if (!entity_id) return;
                                deleteBillingInstruction({
                                    entity_id,
                                    cb: () => {
                                        setShowDeleteModal(false);
                                        setSelectedRowForDelete(null);
                                        getAllBillingInstructions({ params: apiParams });
                                    },
                                });
                            }}
                            deleteText="Are you sure you want to delete this billing instruction?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default BillingInstruction;

