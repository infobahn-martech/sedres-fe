import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import CommonHeader from "../../../components/CommonHeader";
import CustomTable from "../../../components/customTable";
import useInhouseDriverReducer from "../../../store/InhouseDriverReducer";

const RenderStatusBadge = ({ row }) => {
    const statusMap = {
        Pending: { bg: "#FFF3CD", color: "#856404" },
        "In Progress": { bg: "#DDEBFF", color: "#1D4ED8" },
        Completed: { bg: "#D1FAE5", color: "#047857" },
    };

    const style = statusMap[row.status] || { bg: "#E5E7EB", color: "#374151" };

    return (
        <span
            style={{
                background: style.bg,
                color: style.color,
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-block",
            }}
        >
            {row.status}
        </span>
    );
};

const formatDate = (value) => {
    if (!value) return "—";
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("DD/MM/YYYY") : value;
};

const Invoices = () => {
    const { isRequestsLoading, requestsData, getRequestsByDriver } = useInhouseDriverReducer();

    const [params, setParams] = useState({
        page: 1,
        searchTerm: "",
        limit: 10,
        sortBy: "refNo",
        sortOrder: 1,
    });

    useEffect(() => {
        getRequestsByDriver();
    }, [getRequestsByDriver]);

    const invoices = useMemo(
        () =>
            (requestsData || []).map((req) => ({
                _id: String(req.transport_request_id),
                refNo: req.call_id != null ? `CALL-${req.call_id}` : "—",
                dateSubmitted: formatDate(req.created_date),
                tripNo: `TR-${req.transport_request_id}`,
                amount: "—",
                status: req.status,
            })),
        [requestsData]
    );

    const filteredInvoices = useMemo(() => {
        let data = [...invoices];

        if (params.searchTerm) {
            const search = params.searchTerm.toLowerCase();
            data = data.filter((item) =>
                [item.refNo, item.dateSubmitted, item.tripNo, item.amount, item.status]
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
    }, [invoices, params]);

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
            name: "Trip No",
            selector: "tripNo",
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
                    isLoading={isRequestsLoading}
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
