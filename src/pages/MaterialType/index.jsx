import React, { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { MaterialTypeModal } from "./Modals/AddEditMaterialType";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

import useMaterialTypeReducer from "../../store/MaterialTypeReducer";

const MaterialType = () => {
    const { getMaterialTypes, materialTypes, isLoadingGet, deleteData, isLoadingDelete, totalCount } =
        useMaterialTypeReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "name",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    const [showMaterialTypeModal, setShowMaterialTypeModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const apiParams = useMemo(
        () => ({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
        }),
        [params]
    );

    useEffect(() => {
        getMaterialTypes(apiParams);
    }, [getMaterialTypes, apiParams]);

    const list = Array.isArray(materialTypes) ? materialTypes : [];

    const handleOpenAdd = () => {
        setSelectedRow(null);
        setShowMaterialTypeModal(true);
    };

    const handleOpenEdit = (row) => {
        setSelectedRow(row);
        setShowMaterialTypeModal(true);
    };

    const handleOpenDelete = (row) => {
        setSelectedRow(row);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedRow?._id) return;

        await deleteData(selectedRow._id);
        setShowDeleteModal(false);
        setSelectedRow(null);
        getMaterialTypes(apiParams);
    };

    const cols = [
        {
            name: "Name",
            selector: "material_type",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Actions",
            selector: "linksInfo",
            tableClasses: "table-striped",
            contentClass: "table-content",
            thclass: "tb-head",
            onEditClick: (row) => handleOpenEdit(row),
            onDeleteClick: (row) => handleOpenDelete(row),
            cell: RenderAction,
            width: "100",
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Material Types"
                            isAddEnabled
                            addModalLabel="Add Material Type"
                            setSearch={(e) => setParams({ ...params, searchTerm: e, page: 1 })}
                            onAddModalClick={handleOpenAdd}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        isLoading={isLoadingGet}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalCount}
                        columns={cols}
                        data={list}
                        onPageChange={(currentPage) =>
                            setParams({ ...params, page: currentPage })
                        }
                        setLimit={(newLimit) => setParams({ ...params, limit: newLimit, page: 1 })}
                        onSorting={(sortBy) =>
                            setParams({
                                ...params,
                                sortBy,
                                sortOrder: params.sortOrder === 1 ? -1 : 1,
                                page: 1,
                            })
                        }
                    />

                    {!!showMaterialTypeModal && (
                        <MaterialTypeModal
                            showModal={selectedRow || true}
                            closeModal={() => {
                                setShowMaterialTypeModal(false);
                                setSelectedRow(null);
                            }}
                            onSuccess={() => {
                                setShowMaterialTypeModal(false);
                                setSelectedRow(null);
                                getMaterialTypes(apiParams);
                            }}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            loading={isLoadingDelete}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setSelectedRow(null);
                            }}
                            onConfirm={handleConfirmDelete}
                            deleteText="Are you sure you want to delete this material type?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default MaterialType;