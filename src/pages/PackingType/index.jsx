import { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { PackingTypeModal } from "./Modals/AddEditPackingType";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import usePackingTypeReducer from "../../store/PackingTypeReducer";

const PackingType = () => {
    const {
        getPackingTypes,
        packingTypes,
        totalCount,
        isLoadingGet,
        deletePackingType,
        isLoadingDelete,
    } = usePackingTypeReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "package_type",
        sortOrder: 1,
    });

    const [showPackingTypeModal, setShowPackingTypeModal] = useState(false);
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
        getPackingTypes(apiParams);
    }, [getPackingTypes, apiParams]);

    const list = Array.isArray(packingTypes) ? packingTypes : [];

    const cols = [
        {
            name: "Packing Type",
            selector: "package_type",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Created Date",
            selector: "created_date",
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
            width: "100",
            onEditClick: (row) => setShowPackingTypeModal(row),
            onDeleteClick: (row) => {
                setSelectedRow(row);
                setShowDeleteModal(true);
            },
            cell: RenderAction,
        },
    ];

    const handleDelete = () => {
        if (!selectedRow?.package_type_id) return;
        deletePackingType({
            id: selectedRow.package_type_id,
            cb: () => {
                setShowDeleteModal(false);
                setSelectedRow(null);
                getPackingTypes(apiParams);
            },
        });
    };

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Packing Types"
                            isAddEnabled
                            addModalLabel="Add Packing Type"
                            setSearch={(e) => setParams({ ...params, searchTerm: e, page: 1 })}
                            onAddModalClick={() => setShowPackingTypeModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        isLoading={isLoadingGet}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalCount}
                        columns={cols}
                        data={list}
                        onPageChange={(currentPage) => setParams({ ...params, page: currentPage })}
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

                    {!!showPackingTypeModal && (
                        <PackingTypeModal
                            showModal={showPackingTypeModal}
                            closeModal={() => setShowPackingTypeModal(false)}
                            onSuccess={() => {
                                setShowPackingTypeModal(false);
                                getPackingTypes(apiParams);
                            }}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setSelectedRow(null);
                            }}
                            onConfirm={handleDelete}
                            isLoading={isLoadingDelete}
                            deleteText={`Are you sure you want to delete packing type ${selectedRow?.package_type ?? ""}?`}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default PackingType;
