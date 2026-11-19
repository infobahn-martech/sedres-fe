import { useState, useEffect, useMemo } from "react";
import { debounce } from "lodash";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { RenderAction, RenderName } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import StatusConfirmationModal from "../../components/StatusConfirmationModal";
import { FleetModal } from "./Modals/AddEditFleet";
import useFleetReducer from "../../store/FleetReducer";

const Fleet = () => {
    const {
        getFleetData,
        fleetData,
        isLoading,
        totalFleetCount,
        deleteFleet,
        isDeleteLoading,
    } = useFleetReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "taxi_boat_name",
        sortOrder: 1,
    });

    const [showFleetModal, setShowFleetModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getFleetData?.({
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
        getFleetData,
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
        getFleetData?.({
            search: params.searchTerm || "",
            sort_by: params.sortBy,
            sort_order: params.sortOrder,
            page: params.page,
            limit: params.limit,
        });
    };

    const cols = [
        {
            name: "Taxi Boat Name",
            selector: "taxi_boat_name",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: RenderName,
            sort: true,
        },
        {
            name: "Operator",
            selector: "operator_name",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Registration No",
            selector: "registration_no",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Capacity",
            selector: "capacity_persons",
            width: "120",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Insurance Expiry",
            selector: "insurance_expiry",
            width: "150",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) =>
                row?.insurance_expiry
                    ? new Date(row.insurance_expiry).toLocaleDateString("en-GB", { month: "2-digit", day: "2-digit", year: "numeric" })
                    : "-",
        },
        {
            name: "Certificate Expiry",
            selector: "certificate_expiry",
            width: "150",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) =>
                row?.certificate_expiry
                    ? new Date(row.certificate_expiry).toLocaleDateString("en-GB", { month: "2-digit", day: "2-digit", year: "numeric" })
                    : "-",
        },
        {
            name: "Status",
            selector: "status",
            width: "120",
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
                    onEditClick: (row) => setShowFleetModal(row),
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
                            tableTitle="Fleet"
                            isAddEnabled
                            addModalLabel="Add Fleet"
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
                        columns={cols}
                        data={fleetData}
                        count={totalFleetCount}
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
                                if (selectedRow?.taxi_boat_id) {
                                    deleteFleet({
                                        fleet_id: selectedRow.taxi_boat_id,
                                        cb: () => {
                                            setShowDeleteModal(false);
                                            setSelectedRow(null);
                                            refreshList();
                                        },
                                    });
                                }
                            }}
                            deleteText="Are you sure you want to delete this fleet?"
                            isLoading={isDeleteLoading}
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
                                // TODO: wire when status update API is available
                                setShowStatusModal(false);
                                setSelectedRow(null);
                                refreshList();
                            }}
                            statusText="Are you sure you want to deactivate this fleet?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default Fleet;
