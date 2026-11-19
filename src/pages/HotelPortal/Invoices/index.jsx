import { useMemo, useState } from "react";
import CommonHeader from "../../../components/CommonHeader";
import CustomTable from "../../../components/customTable";
import "../../../design/scss/vendor-portal.scss";

const STATUS_CLASS_MAP = {
    Pending: "status-pending",
    Submitted: "status-approved",
    Completed: "status-completed",
};

const RenderStatusBadge = ({ row }) => (
    <span className={`vendor-status-badge ${STATUS_CLASS_MAP[row.status] || ""}`}>
        {row.status}
    </span>
);

// No hotel invoice API is wired yet; the table shows its "no data" state until one is.
const invoices = [];

const Invoices = () => {
    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "refNo",
        sortOrder: 1,
    });

    const filteredInvoices = useMemo(() => {
        let data = [...invoices];

        if (params.searchTerm) {
            const search = params.searchTerm.toLowerCase();
            data = data.filter((item) =>
                [item.refNo, item.dateSubmitted, item.bookingNo, item.amount, item.status]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(search))
            );
        }

        if (params.sortBy) {
            data.sort((a, b) => {
                const aVal = a[params.sortBy];
                const bVal = b[params.sortBy];

                if (aVal < bVal) return -1 * params.sortOrder;
                if (aVal > bVal) return 1 * params.sortOrder;
                return 0;
            });
        }

        return data;
    }, [params]);

    const paginatedInvoices = useMemo(() => {
        const start = (params.page - 1) * params.limit;
        const end = start + params.limit;
        return filteredInvoices.slice(start, end);
    }, [filteredInvoices, params.page, params.limit]);

    const cols = [
        {
            name: "Ref No",
            selector: "refNo",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Date Submitted",
            selector: "dateSubmitted",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Booking No",
            selector: "bookingNo",
            sort: true,
            width: "220",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Amount",
            selector: "amount",
            sort: true,
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
        },
        {
            name: "Status",
            selector: "status",
            sort: true,
            width: "180",
            thclass: "tb-head",
            contentClass: "table-content",
            cell: RenderStatusBadge,
        },
    ];

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Invoice History"
                        setSearch={(e) =>
                            setParams((prev) => ({
                                ...prev,
                                searchTerm: e,
                                page: 1,
                            }))
                        }
                        searchValue={params.searchTerm}
                        exportTitle="Export"
                        exportLoader={false}
                        isAddEnabled={false}
                    />
                </div>
                <CustomTable
                    Sl
                    pagination={{ currentPage: params.page, limit: params.limit }}
                    tableClasses="px-start"
                    count={filteredInvoices.length}
                    columns={cols}
                    data={paginatedInvoices}
                    isLoading={false}
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
            </div>
        </div>
    );
};

export default Invoices;
