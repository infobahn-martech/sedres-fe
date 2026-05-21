import React, { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import { TransportCompanyModal } from "./Modals/AddEditModal";
import { RenderAction } from "./RenderCells";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { DateFormat } from "../ActivityLog/RenderCells";

import useTransportCompanyReducer from "../../store/TransportCompanyReducer";

const TransportCompany = () => {
    const {
        getTransportCompanyData,
        transportCompanyData,
        isLoading,
        isBeingUpdated,
        totalTransportCompanyCount,
        deleteTransportCompany,
    } = useTransportCompanyReducer((state) => state);

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "transport_company",
        sortOrder: 1,
    });

    const [showTransportCompanyModal, setShowTransportCompanyModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => {
        getTransportCompanyData?.({
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
        getTransportCompanyData,
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

    const cols = [
        {
            name: "Transport company",
            selector: "transport_company",
            width: "260",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
        },
        {
            name: "Created At",
            selector: "created_date",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) => DateFormat({ row, selector: "created_date" }),
        },
        {
            name: "Updated At",
            selector: "updated_date",
            width: "200",
            thclass: "tb-head",
            contentClass: "table-content",
            sort: true,
            cell: ({ row }) => {
                const key =
                    row.updated_date != null ? "updated_date" : "udpated_date";
                return DateFormat({ row, selector: key });
            },
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
                    onEditClick: (row) => setShowTransportCompanyModal(row),
                    onDeleteClick: (row) => {
                        setSelectedRow(row);
                        setShowDeleteModal(true);
                    },
                }),
        },
    ];

    const refreshList = () => {
        getTransportCompanyData?.({
            search: params.searchTerm || "",
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
        });
    };

    const handleDelete = () => {
        const id = selectedRow?.transport_company_id ?? selectedRow?._id;
        if (!id) return;

        deleteTransportCompany?.({
            transport_company_id: id,
            cb: () => {
                setShowDeleteModal(false);
                setSelectedRow(null);
                refreshList();
            },
        });
    };

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Transport Company"
                        isAddEnabled
                        addModalLabel="Add Transport Company"
                        setSearch={(value) => debouncedSearch(value)}
                        onAddModalClick={() => setShowTransportCompanyModal(true)}
                        exportTitle="Export"
                        exportLoader={false}
                    />
                </div>

                <CustomTable
                    isLoading={isLoading}
                    pagination={{ currentPage: params.page, limit: params.limit }}
                    tableClasses="px-start"
                    columns={cols}
                    data={transportCompanyData}
                    count={totalTransportCompanyCount}
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

                {!!showTransportCompanyModal && (
                    <TransportCompanyModal
                        showModal={showTransportCompanyModal}
                        closeModal={() => setShowTransportCompanyModal(false)}
                        onSuccess={() => {
                            setShowTransportCompanyModal(false);
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
                        isLoading={isBeingUpdated}
                        deleteText={`Are you sure you want to delete this transport company${selectedRow?.transport_company ? ` ${selectedRow.transport_company}` : ""}?`}
                    />
                )}
            </div>
        </div>
    );
};

export default TransportCompany;
