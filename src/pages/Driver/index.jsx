import { useState, useEffect } from "react";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { DriverModal } from "./Modals/AddEditDriver";
import { DateFormat, RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import useDriverReducer from "../../store/DriverReducer";




const Driver = () => {
    const [params, setParams] = useState({
        page: 1,
        search: "",
        limit: 10,
        sortBy: "name",
        sortOrder: 1,
    });

    const [showDriverModal, setShowDriverModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [driverToDelete, setDriverToDelete] = useState(null);


    // 👉 ONLY TWO COLUMNS (Name + Description)
    const cols = [
        {
            name: "Driver Name",
            selector: "driver_name",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Driver For",
            selector: "driver_for",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) => {
                const v = Number(row.driver_for);
                if (v === 2) return "Material";
                if (v === 1) return "Transport";
                return row.driver_for ?? "—";
            },
        },
        {
            name: "Driver No",
            selector: "employee_no",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Contact No",
            selector: "contact_no",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Iqama No",
            selector: "iqama_no",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Joining Date",
            selector: "joining_date",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            // optional: format date
            cell: (row) => DateFormat({ row, selector: "joining_date" }),
        },
        {
            name: "Location",
            selector: "location",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Nationality",
            selector: "country",
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        // {
        //     name: "Status",
        //     selector: "status",
        //     width: "150",
        //     thclass: "tb-head",
        //     contentClass: "table-content",
        //     sort: true,
        //     cell: ({ row }) => (
        //         <span
        //             className={
        //                 row.status === "Active"
        //                     ? "status-active"
        //                     : row.status === "Inactive"
        //                         ? "status-inactive"
        //                         : "status-pending"
        //             }
        //         >
        //             {row.status}
        //         </span>
        //     ),
        // },
        {
            name: "Actions",
            selector: "linksInfo",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: RenderAction,
            onEditClick: (row) => setShowDriverModal(row),
            onDeleteClick: (row) => { setDriverToDelete(row); setShowDeleteModal(true); },
        },
    ];


    const { drivers, totalCount, fetchAllDrivers, deleteDriver, isDeleteLoading } = useDriverReducer();

    useEffect(() => {
        fetchAllDrivers({ params });
    }, [params, fetchAllDrivers, showDriverModal, showDeleteModal]);

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Driver Management"
                            isAddEnabled
                            addModalLabel="Add Driver"
                            setSearch={(e) =>
                                setParams({ ...params, search: e, page: 1 })
                            }
                            onAddModalClick={() => setShowDriverModal(true)}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        columns={cols}
                        data={drivers ?? []}
                        count={totalCount}
                        onPageChange={(currentPage) =>
                            setParams({ ...params, page: currentPage })
                        }
                        setLimit={(newLimit) =>
                            setParams({ ...params, limit: newLimit })
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

                    {!!showDriverModal && (
                        <DriverModal
                            showModal={showDriverModal}
                            closeModal={() => setShowDriverModal(false)}
                            onSuccess={() => fetchAllDrivers({ params })}
                        />
                    )}
                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => { setShowDeleteModal(false); setDriverToDelete(null); }}
                            onConfirm={() =>
                                deleteDriver({
                                    id: driverToDelete?.driver_id,
                                    cb: () => { setShowDeleteModal(false); setDriverToDelete(null); },
                                })
                            }
                            deleteText={`Are you sure you want to delete this driver${driverToDelete?.driver_name ? ` ${driverToDelete.driver_name}` : ""}?`}
                            isLoading={isDeleteLoading}
                        />
                    )}

                </div>
            </div>
        </>
    );
};

export default Driver;
