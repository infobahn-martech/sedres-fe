import { useState, useEffect, useMemo } from "react";
import { debounce } from "lodash";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { FleetModal } from "./Modals/AddEditFleet";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useLaunchHireServiceReducer from "../../store/LaunchHireServiceReducer";

const LHServices = () => {
    const {
        getLaunchHireServiceData,
        serviceData,
        isLoading,
        totalServiceCount,
        deleteLaunchHireService,
        isDeleteLoading,
    } = useLaunchHireServiceReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "service_name",
        sortOrder: 1,
    });

    const [showFleetModal, setShowFleetModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getLaunchHireServiceData?.({
            search: params.searchTerm || "",
            sort_by: params.sortBy,
            sort_order: params.sortOrder,
            page: params.page,
            limit: params.limit,
        });
    }, [
        params.page,
        params.limit,
        params.searchTerm,
        params.sortBy,
        params.sortOrder,
        getLaunchHireServiceData,
    ]);

    const debouncedSearch = useMemo(
        () =>
            debounce((value) => {
                setParams((prev) => ({ ...prev, searchTerm: value, page: 1 }));
            }, 500),
        []
    );

    useEffect(() => {
        return () => debouncedSearch.cancel();
    }, [debouncedSearch]);

    const refreshList = () => {
        getLaunchHireServiceData?.({
            search: params.searchTerm || "",
            sort_by: params.sortBy,
            sort_order: params.sortOrder,
            page: params.page,
            limit: params.limit,
        });
    };

    const cols = [
        {
            name: "Service Name",
            selector: "service_name",
            sort: true,
            width: "350",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Actions",
            selector: "linksInfo",
            tableClasses: "table-striped",
            contentClass: "table-content",
            thclass: "tb-head",
            cell: (props) =>
                RenderAction({
                    ...props,
                    onEditClick: (row) => setShowFleetModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
            width: "180",
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Launch Hire Services"
                            isAddEnabled
                            addModalLabel="Add Service"
                            setSearch={(value) => debouncedSearch(value)}
                            onAddModalClick={() => setShowFleetModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        isLoading={isLoading}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalServiceCount}
                        columns={cols}
                        data={serviceData}
                        onPageChange={(currentPage) =>
                            setParams((prev) => ({ ...prev, page: currentPage }))
                        }
                        setLimit={(newLimit) =>
                            setParams((prev) => ({
                                ...prev,
                                limit: newLimit,
                                page: 1,
                            }))
                        }
                        onSorting={(sortBy) =>
                            setParams((prev) => ({
                                ...prev,
                                sortBy,
                                sortOrder: prev.sortOrder === 1 ? -1 : 1,
                                page: 1,
                            }))
                        }
                    />

                    {!!showFleetModal && (
                        <FleetModal
                            showModal={showFleetModal}
                            closeModal={() => setShowFleetModal(false)}
                            onSuccess={() => {
                                setShowFleetModal(false);
                                refreshList();
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
                            onConfirm={() => {
                                if (selectedRow?.launchhire_service_id) {
                                    deleteLaunchHireService({
                                        service_id: selectedRow.launchhire_service_id,
                                        cb: () => {
                                            setShowDeleteModal(false);
                                            setSelectedRow(null);
                                            refreshList();
                                        },
                                    });
                                }
                            }}
                            isLoading={isDeleteLoading}
                            deleteText="Are you sure you want to delete this service?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default LHServices;
