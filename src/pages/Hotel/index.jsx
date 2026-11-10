import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { HotelModal } from "./Modals/AddEditHotel";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

// ✅ CHANGE THIS IMPORT PATH based on your project structure
import useHotelReducer from "../../store/HotelReducer";
// ex: "../../stores/HotelReducer"

const Hotel = () => {
    // ✅ Store / API
    const { getHotelData, hotelData, isLoading, totalHotelCount, deleteHotel } =
        useHotelReducer((state) => state);

    // ✅ Table params
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "hotel_name",
        sortOrder: 1, // 1 = ASC, -1 = DESC
    });

    // ✅ Modals
    const [showHotelModal, setShowHotelModal] = useState(false); // boolean OR row object
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    // ✅ Fetch list when params change
    useEffect(() => {
        getHotelData?.({
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
        getHotelData,
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

    const cols = [
        {
            name: "Hotel Name",
            selector: "hotel_name",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Contact Name",
            selector: "contact_name",
            width: "220",
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
            name: "Contact Email",
            selector: "contact_email",
            width: "260",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Hotel Address",
            selector: "hotel_address",
            width: "350",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: false,
            // If you want tooltip truncation:
            // cell: ({ row }) => <span title={row.hotel_address}>{row.hotel_address}</span>,
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
                    onEditClick: (row) => setShowHotelModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshList = () => {
        getHotelData?.({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
        });
    };

    const handleDelete = async () => {
        if (!selectedRow?.hotel_id) return;

        await deleteHotel?.({ hotel_id: selectedRow.hotel_id });

        setShowDeleteModal(false);
        setSelectedRow(null);
        refreshList();
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Hotel Management"
                        isAddEnabled
                        addModalLabel="Add Hotel"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowHotelModal(true)}
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
                    data={hotelData}
                    count={totalHotelCount}
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

                {!!showHotelModal && (
                    <HotelModal
                        showModal={showHotelModal} // boolean OR row object for edit
                        closeModal={() => setShowHotelModal(false)}
                        onSuccess={() => {
                            setShowHotelModal(false);
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
                        deleteText={`Are you sure you want to delete this hotel${selectedRow?.hotel_name ? ` ${selectedRow.hotel_name}` : ""}?`}
                    />
                )}
            </div>
        </div>
    );
};

export default Hotel;