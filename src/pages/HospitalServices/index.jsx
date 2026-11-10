import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

import useHospitalReducer from "../../store/HospitalReducer";
import { HospitalServiceModal } from "./Modals/AddEditModal";

const HospitalServices = () => {
    const {
        getHospitalServicesData,
        hospitalServicesData,
        isLoading,
        totalHospitalServicesCount,
        deleteHospitalService,
    } = useHospitalReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "hospital_name",
        sortOrder: 1,
    });

    const [showHospitalServiceModal, setShowHospitalServiceModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const listQueryParams = {
        searchTerm: params.searchTerm || "",
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
    };

    useEffect(() => {
        getHospitalServicesData?.({ params: listQueryParams });
    }, [params.page, params.limit, params.searchTerm, params.sortBy, getHospitalServicesData]);

    const debouncedSearch = useMemo(
        () =>
            debounce((value) => {
                setParams((prev) => ({ ...prev, searchTerm: value, page: 1 }));
            }, 500),
        [],
    );

    useEffect(() => {
        return () => debouncedSearch.cancel();
    }, [debouncedSearch]);

    const cols = [
        {
            name: "Hospital",
            selector: "hospital_name",
            width: "240",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Services",
            selector: "services",
            width: "420",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: false,
            cell: (props) => (
                <span className="table-content">
                    {Array.isArray(props.row.services) && props.row.services.length
                        ? props.row.services
                            .map((s) => s.service_name)
                            .filter(Boolean)
                            .join(", ")
                        : "—"}
                </span>
            ),
        },
        {
            name: "Remarks",
            selector: "remarks",
            width: "280",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: false,
        },
        {
            name: "Actions",
            selector: "linksInfo",
            width: "120",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (props) =>
                RenderAction({
                    ...props,
                    onEditClick: (row) => setShowHospitalServiceModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshList = () => {
        getHospitalServicesData?.({ params: listQueryParams });
    };

    const handleDelete = async () => {
        const hospitalServiceId = selectedRow?.hospital_service_id ?? selectedRow?._id;
        if (!hospitalServiceId) return;

        await deleteHospitalService?.({ hospital_service_id: hospitalServiceId });

        setShowDeleteModal(false);
        setSelectedRow(null);
        refreshList();
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Hospital Services"
                        isAddEnabled
                        addModalLabel="Add Hospital Services"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowHospitalServiceModal(true)}
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
                    data={hospitalServicesData}
                    count={totalHospitalServicesCount}
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

                {!!showHospitalServiceModal && (
                    <HospitalServiceModal
                        showModal={showHospitalServiceModal}
                        closeModal={() => setShowHospitalServiceModal(false)}
                        onSuccess={() => {
                            setShowHospitalServiceModal(false);
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
                        deleteText="Are you sure you want to delete this hospital service?"
                    />
                )}
            </div>
        </div>
    );
};

export default HospitalServices;
