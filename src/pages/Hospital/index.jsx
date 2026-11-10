import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

// ✅ CHANGE THIS IMPORT PATH based on your project structure
import useHospitalReducer from "../../store/HospitalReducer";
// ex: "../../stores/HotelReducer"
import { HospitalModal } from "./Modals/AddEditHospital";

const Hospital = () => {
    // ✅ Store / API
    const { getHospitalData, hospitalData, isLoading, totalHospitalCount, deleteHospital } =
        useHospitalReducer((state) => state);

    // ✅ Table params
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "hospital_name",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    // ✅ Modals
    const [showHospitalModal, setShowHospitalModal] = useState(false); // boolean OR row object
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
        getHospitalData?.({ params: listQueryParams });
    }, [params.page, params.limit, params.searchTerm, params.sortBy, getHospitalData]);

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
            name: "Hospital Name",
            selector: "hospital_name",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Contact Person",
            selector: "contact_person",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Contact No",
            selector: "contact_number",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Email",
            selector: "email",
            width: "260",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Location",
            selector: "location",
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
                    onEditClick: (row) => setShowHospitalModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshHospitalList = () => {
        getHospitalData?.({ params: listQueryParams });
    };

    const handleDelete = async () => {
        const hospitalId = selectedRow?.hospital_id ?? selectedRow?._id;
        if (!hospitalId) return;

        const payload = { hospital_id: hospitalId };
        await deleteHospital?.(payload);

        setShowDeleteModal(false);
        setSelectedRow(null);
        refreshHospitalList();
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Hospital Management"
                        isAddEnabled
                        addModalLabel="Add Hospital"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowHospitalModal(true)}
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
                    data={hospitalData}
                    count={totalHospitalCount}
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

                {!!showHospitalModal && (
                    <HospitalModal
                        showModal={showHospitalModal} // boolean OR row object for edit
                        closeModal={() => setShowHospitalModal(false)}
                        onSuccess={() => {
                            setShowHospitalModal(false);
                            refreshHospitalList();
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
                        deleteText="Are you sure you want to delete this hospital?"
                    />
                )}
            </div>
        </div>
    );
};

export default Hospital;