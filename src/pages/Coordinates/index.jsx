import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { CoordinatesModal } from "./Modals/AddCoordinates";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";

import useCoordinatesReducer from "../../store/CoordinatesReducer";
import { formatCoordinatesList, coordinatePairDisplay } from "./coordinateUtils";

const Coordinates = () => {
    const {
        coordinates,
        getCoordinates,
        getCoordinateTypes,
        isLoading,
        totalCount,
        deleteCoordinates,
        isDeleteLoading,
    } = useCoordinatesReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "coordinate_type",
        sortOrder: 1,
    });

    const [showCoordinatesModal, setShowCoordinatesModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getCoordinates?.({
            params: {
                search: params.searchTerm || "",
                page: params.page,
                limit: params.limit,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
            },
        });
    }, [params.page, params.limit, params.searchTerm, params.sortBy, params.sortOrder, getCoordinates]);

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
            name: "Coordinate Type",
            selector: "coordinate_type",
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Coordinates",
            selector: "coordinates",
            width: "360",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) => {
                const list = row?.coordinates;
                const text = formatCoordinatesList(list);
                const title =
                    Array.isArray(list) && list.length > 0
                        ? list.map(coordinatePairDisplay).filter(Boolean).join("\n")
                        : text;
                return (
                    <span className="text-break" title={title}>
                        {text}
                    </span>
                );
            },
        },
        // {
        //     name: "Status",
        //     selector: "status",
        //     width: "220",
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
            width: "100",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: (props) =>
                RenderAction({
                    ...props,
                    onEditClick: (row) => setShowCoordinatesModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const handleRefresh = () => {
        getCoordinates?.({
            params: {
                search: params.searchTerm || "",
                page: params.page,
                limit: params.limit,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
            },
        });
    };

    const handleDelete = () => {
        const coordinate_type_id = selectedRow?.coordinate_type_id ?? selectedRow?.id;
        if (!coordinate_type_id) return;

        deleteCoordinates({
            coordinate_type_id,
            cb: () => {
                setShowDeleteModal(false);
                setSelectedRow(null);
                handleRefresh();
            },
        });
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Coordinates Management"
                        isAddEnabled
                        addModalLabel="Add Coordinates"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowCoordinatesModal(true)}
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
                    data={coordinates}
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

                {!!showCoordinatesModal && (
                    <CoordinatesModal
                        showModal={showCoordinatesModal}
                        closeModal={() => setShowCoordinatesModal(false)}
                        onSuccess={() => {
                            setShowCoordinatesModal(false);
                            getCoordinateTypes?.();
                            handleRefresh();
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
                        isLoading={isDeleteLoading}
                        deleteText="Are you sure you want to delete this coordinate type?"
                    />
                )}
            </div>
        </div>
    );
};

export default Coordinates;