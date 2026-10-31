import React, { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { VehicleModal } from "./Modals/AddEditVehicle";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useVehicleReducer from "../../store/VehicleReducer";

/** Vehicle Management for Transport (default) or Material vehicles — `type` picks the add/update APIs. */
const Vehicle = ({ type = "transport" }) => {
    const {
        vehicles,
        getVehicles,
        isLoading,
        totalCount,
        deleteVehicle,
        isDeleteLoading,
    } = useVehicleReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "vehicle_type",
        sortOrder: 1,
    });

    const selectedVehicleRef = useRef(null);

    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const fetchList = () =>
        getVehicles?.({
            type,
            params: {
                search: params.searchTerm || "",
                page: params.page,
                limit: params.limit,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
            },
        });

    useEffect(() => {
        fetchList();
    }, [params.page, params.limit, params.searchTerm, params.sortBy, params.sortOrder, type, getVehicles]);

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

    const cols = [
        {
            name: "Vehicle Type",
            selector: "vehicle_type",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        // Material vehicles have no seating capacity.
        ...(type === "material" ? [] : [{
            name: "Seater",
            selector: "seater",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        }]),
        {
            name: "Actions",
            selector: "linksInfo",
            width: "100",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (props) =>
                RenderAction({
                    ...props,
                    onEditClick: (row) => setShowVehicleModal(row),
                    onDeleteClick: (row) => { selectedVehicleRef.current = row; setShowDeleteModal(true); },
                }),
        },
    ];

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Vehicle Management"
                        isAddEnabled
                        addModalLabel="Add Vehicle"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowVehicleModal(true)}
                        exportTitle="Export"
                        exportLoader={false}
                    />
                </div>

                <CustomTable
                    Sl
                    loading={isLoading}
                    pagination={{ currentPage: params.page, limit: params.limit }}
                    tableClasses="px-start"
                    columns={cols}
                    data={vehicles}
                    count={totalCount}
                    onPageChange={(currentPage) =>
                        setParams((prev) => ({ ...prev, page: currentPage }))
                    }
                    setLimit={(newLimit) =>
                        setParams((prev) => ({ ...prev, limit: newLimit, page: 1 }))
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

                {!!showVehicleModal && (
                    <VehicleModal
                        showModal={showVehicleModal}
                        type={type}
                        closeModal={() => setShowVehicleModal(false)}
                        onSuccess={() => {
                            setShowVehicleModal(false);
                            fetchList();
                        }}
                    />
                )}

                {!!showDeleteModal && (
                    <DeleteConfirmationModal
                        show={showDeleteModal}
                        onCancel={() => { setShowDeleteModal(false); selectedVehicleRef.current = null; }}
                        onConfirm={() =>
                            deleteVehicle({
                                id: selectedVehicleRef.current?.vehicle_type_id,
                                cb: () => {
                                    setShowDeleteModal(false);
                                    selectedVehicleRef.current = null;
                                    fetchList();
                                },
                            })
                        }
                        deleteText="Are you sure you want to delete this vehicle type?"
                        isLoading={isDeleteLoading}
                    />
                )}
            </div>
        </div>
    );
};

export default Vehicle;
