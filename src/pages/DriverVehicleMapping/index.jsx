import React, { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { DriverVehicleMappingModal } from "./Modals/AddEditDriverVehicleMapping";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { DateFormat } from "../ActivityLog/RenderCells";

// ✅ CHANGE THIS IMPORT PATH based on your project structure
import useDriverVehicleMappingReducer from "../../store/DriverVehicleReducer";
// ex: "../../stores/DriverVehicleMappingReducer"

const DriverVehicleMapping = ({ type = "transport" }) => {
    // ✅ Store / API
    const {
        getDriverVehicleMappingData,
        driverVehicleMappingData,
        isLoading,
        totalDriverVehicleMappingCount,
        deleteDriverVehicleMapping,
    } = useDriverVehicleMappingReducer((state) => state);

    // ✅ Table params (API params)
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "driver_name",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    // ✅ Modals
    const [showDriverVehicleMappingModal, setShowDriverVehicleMappingModal] =
        useState(false); // boolean OR row object
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    // ✅ Fetch list whenever params change
    useEffect(() => {
        getDriverVehicleMappingData?.({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
        });
    }, [
        params.page,
        params.limit,
        params.searchTerm,
        params.sortBy,
        params.sortOrder,
        getDriverVehicleMappingData,
    ]);

    // ✅ Debounced search
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

    // ✅ Support common API response shapes:
    // A) { data: [...], total: number }
    // B) { data: { data: [...], total: number } }


    const cols = [
        {
            name: "Driver",
            selector: "driver_name",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Driver No",
            selector: "plate_no",
            width: "160",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Vehicle",
            selector: "vehicle_type",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Created At",
            selector: "created_date",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: (row) => DateFormat({ row, selector: "created_date" }),
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
                    onEditClick: (row) => setShowDriverVehicleMappingModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshList = () => {
        getDriverVehicleMappingData?.({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
        });
    };

    const handleDelete = async () => {
        if (!selectedRow?._id) return;

        // ✅ adjust payload if backend expects different key
        const payload = { driver_vehicle_mapping_id: selectedRow._id };

        // If your deleteData expects just id: await deleteData(selectedRow._id);
        await deleteDriverVehicleMapping?.(payload);

        setShowDeleteModal(false);
        setSelectedRow(null);
        refreshList();
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Driver Vehicle Mapping"
                        isAddEnabled
                        addModalLabel="Add Driver Vehicle Mapping"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowDriverVehicleMappingModal(true)}
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
                    data={driverVehicleMappingData}
                    count={totalDriverVehicleMappingCount}
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

                {!!showDriverVehicleMappingModal && (
                    <DriverVehicleMappingModal
                        showModal={showDriverVehicleMappingModal} // boolean OR row object
                        type={type}
                        closeModal={() => setShowDriverVehicleMappingModal(false)}
                        onSuccess={() => {
                            setShowDriverVehicleMappingModal(false);
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
                        onConfirm={handleDelete}
                        isLoading={isLoading}
                        deleteText="Are you sure you want to delete this driver vehicle mapping?"
                    />
                )}
            </div>
        </div>
    );
};

export default DriverVehicleMapping;