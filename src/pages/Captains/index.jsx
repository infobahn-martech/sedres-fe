import { useState, useEffect, useMemo } from "react";
import { debounce } from "lodash";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { CaptainModal } from "./Modals/AddEditCaptain";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import StatusConfirmationModal from "../../components/StatusConfirmationModal";
import useCaptainReducer from "../../store/CaptainReducer";
import "../../design/scss/pages/captains/Captains.scss";

const Captains = () => {
    const {
        getCaptainData,
        captainData,
        isLoading,
        totalCaptainCount,
        deleteCaptain,
        isBeingUpdated,
    } = useCaptainReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "captain_name",
        sortOrder: 1,
    });

    const [showCaptainModal, setShowCaptainModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getCaptainData?.({
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
        getCaptainData,
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
        getCaptainData?.({
            search: params.searchTerm || "",
            sort_by: params.sortBy,
            sort_order: params.sortOrder,
            page: params.page,
            limit: params.limit,
        });
    };

    const cols = [
        {
            name: "Name",
            selector: "captain_name",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Taxi Boat",
            selector: "taxi_boat_name",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Contact No",
            selector: "contact_no",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "License No",
            selector: "license_no",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "License Expiry",
            selector: "license_expiry",
            width: "150",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) =>
                row?.license_expiry
                    ? new Date(row.license_expiry).toLocaleDateString()
                    : "-",
        },
        {
            name: "Status",
            selector: "status",
            width: "150",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) => (
                <span
                    className={
                        row.status === "Active"
                            ? "status-active"
                            : row.status === "Inactive"
                                ? "status-inactive"
                                : "status-pending"
                    }
                >
                    {row.status || "-"}
                </span>
            ),
        },
        {
            name: "Actions",
            selector: "linksInfo",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (props) =>
                RenderAction({
                    ...props,
                    onEditClick: (row) => setShowCaptainModal(row),
                    onStatusClick: (row) => {
                        setSelectedRow(row);
                        setShowStatusModal(true);
                    },
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Captains"
                            isAddEnabled
                            addModalLabel="Add Captain"
                            setSearch={(value) => debouncedSearch(value)}
                            onAddModalClick={() => setShowCaptainModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        isLoading={isLoading}
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        columns={cols}
                        data={captainData}
                        count={totalCaptainCount}
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

                    {!!showCaptainModal && (
                        <CaptainModal
                            showModal={showCaptainModal}
                            closeModal={() => setShowCaptainModal(false)}
                            onSuccess={() => {
                                setShowCaptainModal(false);
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
                                deleteCaptain({
                                    captain_id: selectedRow?.taxiboat_captain_id,
                                    cb: () => {
                                        setShowDeleteModal(false);
                                        setSelectedRow(null);
                                        refreshList();
                                    },
                                });
                            }}
                            deleteText="Are you sure you want to delete this captain?"
                            isLoading={isBeingUpdated}
                        />
                    )}

                    {!!showStatusModal && (
                        <StatusConfirmationModal
                            show={showStatusModal}
                            onCancel={() => {
                                setShowStatusModal(false);
                                setSelectedRow(null);
                            }}
                            onConfirm={() => {
                                setShowStatusModal(false);
                                setSelectedRow(null);
                                refreshList();
                            }}
                            statusText={
                                selectedRow?.status === 'Active' || Number(selectedRow?.status) === 1
                                    ? 'Are you sure you want to deactivate this captain?'
                                    : 'Are you sure you want to activate this captain?'
                            }
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default Captains;
