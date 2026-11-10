import { useEffect, useMemo, useState } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { AddEditThirdPartyServiceModal } from "./Modals/AddEditModal";
import { RenderAction, RenderDescription } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useThirdPartyServiceReducer from "../../store/ThirdPartyReducer";
import "../../design/scss/pages/third-party-service/ThirdPartyService.scss";

const ThirdPartyService = () => {
    const { getThirdPartyServices, thirdPartyServices, isLoadingGet, deleteData, isLoadingDelete, totalCount } =
        useThirdPartyServiceReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "third_party_service",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    const [showThirdPartyServiceModal, setShowThirdPartyServiceModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const apiParams = useMemo(
        () => ({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder === 1 ? "ASC" : "DESC", // change if your API expects 1/-1
        }),
        [params]
    );

    useEffect(() => {
        getThirdPartyServices(apiParams);
    }, [getThirdPartyServices, apiParams]);

    const list = Array.isArray(thirdPartyServices) ? thirdPartyServices : [];

    const handleOpenAdd = () => {
        setSelectedRow(null);
        setShowThirdPartyServiceModal(true);
    };

    const handleOpenEdit = (row) => {
        setSelectedRow(row);
        setShowThirdPartyServiceModal(true);
    };

    const handleOpenDelete = (row) => {
        setSelectedRow(row);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        const third_party_service_id = selectedRow?.third_party_service_id ?? selectedRow?._id;
        if (!third_party_service_id) return;

        deleteData({
            third_party_service_id,
            cb: () => {
                setShowDeleteModal(false);
                setSelectedRow(null);
                getThirdPartyServices(apiParams);
            },
        });
    };

    const cols = [
        {
            name: "Third party service",
            selector: "third_party_service",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Description",
            selector: "description",
            sort: true,
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: RenderDescription,
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
                            tableTitle="Third Party Services"
                            isAddEnabled
                            addModalLabel="Add Third Party Service"
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

                    {!!showThirdPartyServiceModal && (
                        <AddEditThirdPartyServiceModal
                            showModal={selectedRow || true}
                            closeModal={() => {
                                setShowThirdPartyServiceModal(false);
                                setSelectedRow(null);
                            }}
                            onSuccess={() => {
                                setShowThirdPartyServiceModal(false);
                                setSelectedRow(null);
                                getThirdPartyServices(apiParams);
                            }}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            isLoading={isLoadingDelete}
                            onCancel={() => {
                                setShowDeleteModal(false);
                                setSelectedRow(null);
                            }}
                            onConfirm={handleConfirmDelete}
                            deleteText="Are you sure you want to delete this third party service?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default ThirdPartyService;