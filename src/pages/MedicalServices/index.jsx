import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

import useHospitalReducer from "../../store/HospitalReducer";
import { MedicalServiceModal } from "./Modals/AddEditMedicalServices";


const MedicalServices = () => {
    // ✅ Store / API
    const { getMedicalServiceData, medicalServiceData, isLoading, totalMedicalServiceCount, deleteMedicalService } =
        useHospitalReducer((state) => state);

    // ✅ Table params
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "service_name",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    // ✅ Modals
    const [showMedicalServiceModal, setShowMedicalServiceModal] = useState(false); // boolean OR row object
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const listQueryParams = {
        searchTerm: params.searchTerm || "",
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
    };

    // ✅ Fetch list when params change
    useEffect(() => {
        getMedicalServiceData?.({ params: listQueryParams });
    }, [params.page, params.limit, params.searchTerm, params.sortBy, getMedicalServiceData]);

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

    const cols = [
        {
            name: "Service Code",
            selector: "service_code",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Service Name",
            selector: "service_name",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Description",
            selector: "description",
            width: "350",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: false,
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
                    onEditClick: (row) => setShowMedicalServiceModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshMedicalServiceList = () => {
        getMedicalServiceData?.({ params: listQueryParams });
    };

    const handleDelete = async () => {
        const serviceId = selectedRow?.service_id ?? selectedRow?._id;
        if (!serviceId) return;

        const payload = { service_id: serviceId };

        await deleteMedicalService?.(payload);

        setShowDeleteModal(false);
        setSelectedRow(null);
        refreshMedicalServiceList();
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Medical Services"
                        isAddEnabled
                        addModalLabel="Add Medical Service"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowMedicalServiceModal(true)}
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
                    data={medicalServiceData}
                    count={totalMedicalServiceCount}
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

                {!!showMedicalServiceModal && (
                    <MedicalServiceModal
                        showModal={showMedicalServiceModal} // boolean OR row object for edit
                        closeModal={() => setShowMedicalServiceModal(false)}
                        onSuccess={() => {
                            setShowMedicalServiceModal(false);
                            refreshMedicalServiceList();
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
                        deleteText="Are you sure you want to delete this medical service?"
                    />
                )}
            </div>
        </div>
    );
};

export default MedicalServices;