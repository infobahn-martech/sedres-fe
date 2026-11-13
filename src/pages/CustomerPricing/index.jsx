import { useState, useEffect, useMemo, useCallback } from "react";
import { RenderAction } from "./RenderCells";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { AddEditCustomerPricing } from "./Modals/AddEditCustomerPricing";
import useCustomerPricingReducer from "../../store/CustomerPricingReducer";
import "../../design/scss/customer-pricing-listing.scss";

const CustomerPricing = () => {
    const [params, setParams] = useState({
        page: 1,
        limit: 10,
        searchTerm: "",
        sortOrder: -1,
        sortBy: "item_code",
    });

    const [showCustomerPricingModal, setShowCustomerPricingModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState(() => new Set());

    const {
        getCustomerPriceList,
        customerPriceList,
        totalCount,
        isLoading,
    } = useCustomerPricingReducer((state) => state);

    const fetchList = () => {
        const apiParams = {
            ...(params.searchTerm && { searchTerm: params.searchTerm }),
            ...(params.sortBy && { sortBy: params.sortBy }),
            ...(params.sortOrder != null && { sortOrder: params.sortOrder }),
        };
        getCustomerPriceList({ params: apiParams });
    };

    useEffect(() => {
        fetchList();
    }, [params.searchTerm, params.sortBy, params.sortOrder]);

    const pagedData = useMemo(() => {
        const start = (params.page - 1) * params.limit;
        return (customerPriceList ?? []).slice(start, start + params.limit);
    }, [customerPriceList, params.page, params.limit]);

    const getRowKey = useCallback((row, idx) => row?.tariff_id ?? row?._id ?? idx, []);

    const isRowExpanded = useCallback(
        (_row, rowKey) => expandedKeys.has(rowKey),
        [expandedKeys]
    );

    const onExpandToggle = useCallback((_row, rowKey) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const renderExpandedRow = useCallback((row) => {
        const clientTariffs = Array.isArray(row.client_tariffs) ? row.client_tariffs : [];
        return (
            <div className="cpt-tariff-panel">
                <div className="cpt-tariff-title">Client pricing</div>
                <div className="table-responsive cpt-tariff-table-wrap">
                    <table className="table table-sm table-bordered cpt-tariff-table mb-0">
                        <thead>
                            <tr>
                                <th>Billing Entity</th>
                                <th>Customer Code</th>
                                <th>Custom Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientTariffs.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="cpt-tariff-empty">
                                        No client pricing found
                                    </td>
                                </tr>
                            ) : (
                                clientTariffs.map((ct, i) => (
                                    <tr key={ct.client_tariff_id ?? `${row.tariff_id ?? "t"}-ct-${i}`}>
                                        <td>{ct.billing_entity ?? "—"}</td>
                                        <td>{ct.customer_code ?? "—"}</td>
                                        <td>{ct.price ?? "—"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, []);

    const cols = [
        {
            name: "Service Code",
            selector: "service_code",
            contentClass: "table-content",
            thclass: "tb-head",
            width: "180",
            cell: ({ row }) => (
                <div className="cpt-service-code-cell">
                    <span className="cpt-service-code-name">
                        {row.service_code_name || row.service_code || "—"}
                    </span>
                    {row.service_code_name && row.service_code && (
                        <span className="cpt-service-code-badge">{row.service_code}</span>
                    )}
                </div>
            ),
        },
        {
            name: "Item Code",
            selector: "item_code",
            contentClass: "table-content",
            sort: true,
            thclass: "tb-head",
            width: "150",
        },
        {
            name: "Item Name",
            selector: "item_name",
            contentClass: "table-content",
            sort: true,
            thclass: "tb-head",
            width: "300",
        },
        {
        name: "Default Price",
            selector: "default_price",
            contentClass: "table-content",
            sort: true,
            thclass: "tb-head",
            width: "200",
        },
        // {
        //     name: "Actions",
        //     selector: "linksInfo",
        //     contentClass: "table-content",
        //     thclass: "tb-head",
        //     onEditClick: (row) => {
        //         setShowCustomerPricingModal(row);
        //     },
        //     onDeleteClick: () => {
        //         setShowDeleteModal(true);
        //     },
        //     cell: RenderAction,
        //     width: "200",
        // },
    ];

    return (
        <>
            <div className="page-body">
                <div className="prospect employee">
                    <div className="container-fluid">
                        <CommonHeader
                            tableTitle="Client Tariff"
                            isAddEnabled={false}
                            addModalLabel="Add Client Tariff"
                            setSearch={(e) =>
                                setParams({ ...params, searchTerm: e, page: 1 })
                            }
                            onAddModalClick={() => {
                                setShowCustomerPricingModal(true);
                            }}
                            exportTitle="Export"
                            exportLoader={false}
                        />
                    </div>

                    <CustomTable
                        Sl
                        pagination={{ currentPage: params.page, limit: params.limit }}
                        tableClasses="px-start"
                        count={totalCount}
                        columns={cols}
                        isLoading={isLoading}
                        data={pagedData}
                        expandable
                        getRowKey={getRowKey}
                        isRowExpanded={isRowExpanded}
                        onExpandToggle={onExpandToggle}
                        renderExpandedRow={renderExpandedRow}
                        onPageChange={(currentPage) =>
                            setParams({ ...params, page: currentPage })
                        }
                        setLimit={(newlimit) =>
                            setParams({ ...params, limit: newlimit, page: 1 })
                        }
                        onSorting={(sortBy) => {
                            setParams({
                                ...params,
                                sortBy,
                                sortOrder: params.sortOrder === -1 ? 1 : -1,
                                page: 1,
                            });
                        }}
                    />

                    {!!showCustomerPricingModal && (
                        <AddEditCustomerPricing
                            showModal={showCustomerPricingModal}
                            closeModal={() => setShowCustomerPricingModal(false)}
                            onSuccess={() => fetchList()}
                        />
                    )}

                    {!!showDeleteModal && (
                        <DeleteConfirmationModal
                            show={showDeleteModal}
                            onCancel={() => setShowDeleteModal(false)}
                            onConfirm={() => { }}
                            deleteText="Are you sure you want to delete this client tariff?"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default CustomerPricing;
