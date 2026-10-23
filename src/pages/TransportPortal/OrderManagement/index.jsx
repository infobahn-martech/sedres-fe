import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import CommonHeader from '../../../components/CommonHeader';
import CustomTable from '../../../components/customTable';
import useVendorReducer from '../../../store/VendorReducer';
import OrderCrewTable from '../OrderCrewTable';
import { formatAmount, toOrderRow } from '../orderRows';

const STATUS_CLASS = {
    completed: 'status-active',
    approved: 'status-active',
    paid: 'status-active',
    pending: 'status-pending',
    open: 'status-pending',
    assigned: 'status-pending',
    'in progress': 'status-pending',
};

// Sortable columns map to the raw value they compare on.
const SORT_VALUE = {
    orderDate: (row) => dayjs(row.rawOrderDate).valueOf() || 0,
    company: (row) => (row.company || '').toLowerCase(),
    crew: (row) => row.crew.length,
    amount: (row) => Number(row.amount) || 0,
    status: (row) => row.status || '',
};

const SEARCH_FIELDS = ['orderDate', 'company', 'vehicleType', 'status'];

const OrderManagement = () => {
    const { isOrdersLoading, ordersData, getVendorOrders } = useVendorReducer();

    const [params, setParams] = useState({
        page: 1,
        searchTerm: '',
        limit: 10,
        sortBy: 'orderDate',
        sortOrder: -1,
    });
    const [expandedPoNo, setExpandedPoNo] = useState(null);

    useEffect(() => {
        getVendorOrders();
    }, [getVendorOrders]);

    // The company's orders arrive as one list, so search/sort/paging run client-side.
    const filteredOrders = useMemo(() => {
        const query = params.searchTerm.trim().toLowerCase();
        const getSortValue = SORT_VALUE[params.sortBy];
        return (ordersData || [])
            .map(toOrderRow)
            .filter(
                (row) =>
                    !query ||
                    SEARCH_FIELDS.some((field) => String(row[field] ?? '').toLowerCase().includes(query))
            )
            .sort((a, b) => {
                const left = getSortValue(a);
                const right = getSortValue(b);
                if (left === right) return 0;
                return (left > right ? 1 : -1) * params.sortOrder;
            });
    }, [ordersData, params.searchTerm, params.sortBy, params.sortOrder]);

    const pageOrders = useMemo(
        () => filteredOrders.slice((params.page - 1) * params.limit, params.page * params.limit),
        [filteredOrders, params.page, params.limit]
    );

    const cols = [
        { name: 'Order Date', selector: 'orderDate', width: '150', thclass: 'tb-head', contentClass: 'table-content', sort: true },
        { name: 'Company', selector: 'company', width: '240', thclass: 'tb-head', contentClass: 'table-content', sort: true },
        { name: 'Vehicle', selector: 'vehicleType', width: '160', thclass: 'tb-head', contentClass: 'table-content' },
        {
            name: 'Crew',
            selector: 'crew',
            width: '100',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => <span>{row.crew.length}</span>,
            sort: true,
        },
        {
            name: 'Amount',
            selector: 'amount',
            width: '140',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => <span>{formatAmount(row)}</span>,
            sort: true,
        },
        {
            name: 'Status',
            selector: 'status',
            width: '140',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => (
                <span className={STATUS_CLASS[(row.status || '').toLowerCase()] ?? 'status-inactive'}>
                    {row.status || '-'}
                </span>
            ),
            sort: true,
        },
    ];

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Order Management"
                        isAddEnabled={false}
                        searchPlaceHolder="Search orders..."
                        setSearch={(e) => setParams({ ...params, searchTerm: e, page: 1 })}
                    />
                </div>

                <CustomTable
                    Sl
                    pagination={{ currentPage: params.page, limit: params.limit }}
                    columns={cols}
                    data={pageOrders}
                    count={filteredOrders.length}
                    isLoading={isOrdersLoading}
                    onPageChange={(currentPage) => setParams({ ...params, page: currentPage })}
                    onSorting={(sortBy) =>
                        setParams({
                            ...params,
                            sortBy,
                            sortOrder: params.sortBy === sortBy ? -params.sortOrder : 1,
                            page: 1,
                        })
                    }
                    expandable
                    getRowKey={(row) => row.poNo}
                    isRowExpanded={(row) => row.poNo === expandedPoNo}
                    onExpandToggle={(row) => setExpandedPoNo((prev) => (prev === row.poNo ? null : row.poNo))}
                    renderExpandedRow={(row) => <OrderCrewTable row={row} />}
                />
            </div>
        </div>
    );
};

export default OrderManagement;
