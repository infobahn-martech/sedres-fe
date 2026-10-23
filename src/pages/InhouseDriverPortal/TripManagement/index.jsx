import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import CommonHeader from '../../../components/CommonHeader';
import CustomTable from '../../../components/customTable';
import useInhouseDriverReducer from '../../../store/InhouseDriverReducer';
import TripDetails from '../TripDetails';
import { toTripRow } from '../tripRows';

const STATUS_CLASS = {
    Completed: 'status-active',
    Pending: 'status-pending',
    'In Progress': 'status-pending',
};

// Sortable columns map to the raw value they compare on.
const SORT_VALUE = {
    tripNo: (row) => Number(row.id) || 0,
    from: (row) => (row.from || '').toLowerCase(),
    to: (row) => (row.to || '').toLowerCase(),
    pickup: (row) => dayjs(row.rawPickup).valueOf() || 0,
    status: (row) => row.status || '',
};

const SEARCH_FIELDS = ['tripNo', 'from', 'to', 'vehicle', 'vesselName', 'status'];

const TripManagement = () => {
    const { isRequestsLoading, requestsData, getRequestsByDriver } = useInhouseDriverReducer();

    const [params, setParams] = useState({
        page: 1,
        searchTerm: '',
        limit: 10,
        sortBy: 'pickup',
        sortOrder: -1,
    });
    const [expandedTripId, setExpandedTripId] = useState(null);

    useEffect(() => {
        getRequestsByDriver();
    }, [getRequestsByDriver]);

    // The driver's trips arrive as one list, so search/sort/paging run client-side.
    const filteredTrips = useMemo(() => {
        const query = params.searchTerm.trim().toLowerCase();
        const getSortValue = SORT_VALUE[params.sortBy];
        return (requestsData || [])
            .map(toTripRow)
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
    }, [requestsData, params.searchTerm, params.sortBy, params.sortOrder]);

    const pageTrips = useMemo(
        () => filteredTrips.slice((params.page - 1) * params.limit, params.page * params.limit),
        [filteredTrips, params.page, params.limit]
    );

    const cols = [
        {
            name: 'Trip No',
            selector: 'tripNo',
            width: '120',
            thclass: 'tb-head',
            contentClass: 'table-content',
            sort: true,
        },
        {
            name: 'From',
            selector: 'from',
            width: '200',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => <span>{row.from || '-'}</span>,
            sort: true,
        },
        {
            name: 'To',
            selector: 'to',
            width: '200',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => <span>{row.to || '-'}</span>,
            sort: true,
        },
        {
            name: 'Pickup',
            selector: 'pickup',
            width: '180',
            thclass: 'tb-head',
            contentClass: 'table-content',
            sort: true,
        },
        {
            name: 'Drop-off',
            selector: 'dropOff',
            width: '180',
            thclass: 'tb-head',
            contentClass: 'table-content',
        },
        {
            name: 'Vehicle',
            selector: 'vehicle',
            width: '180',
            thclass: 'tb-head',
            contentClass: 'table-content',
        },
        {
            name: 'Status',
            selector: 'status',
            width: '150',
            thclass: 'tb-head',
            contentClass: 'table-content',
            cell: ({ row }) => <span className={STATUS_CLASS[row.status] ?? 'status-inactive'}>{row.status || '-'}</span>,
            sort: true,
        },
    ];

    return (
        <div className="page-body">
            <div className="prospect employee">
                <div className="container-fluid">
                    <CommonHeader
                        tableTitle="Trip Management"
                        isAddEnabled={false}
                        searchPlaceHolder="Search trips..."
                        setSearch={(e) => setParams({ ...params, searchTerm: e, page: 1 })}
                    />
                </div>

                <CustomTable
                    Sl
                    pagination={{ currentPage: params.page, limit: params.limit }}
                    columns={cols}
                    data={pageTrips}
                    count={filteredTrips.length}
                    isLoading={isRequestsLoading}
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
                    getRowKey={(row) => row.id}
                    isRowExpanded={(row) => row.id === expandedTripId}
                    onExpandToggle={(row) => setExpandedTripId((prev) => (prev === row.id ? null : row.id))}
                    renderExpandedRow={(row) => <TripDetails key={`${row.id}-${row.status}`} row={row} />}
                />
            </div>
        </div>
    );
};

export default TripManagement;
