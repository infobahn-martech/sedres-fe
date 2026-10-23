import { useEffect, useMemo } from 'react';
import { FiNavigation, FiCheckCircle, FiClock, FiMapPin } from 'react-icons/fi';
import PortalDashboard from '../../../components/PortalDashboard';
import useInhouseDriverReducer from '../../../store/InhouseDriverReducer';
import TripDetails from '../TripDetails';
import { TRIP_TABLE_COLUMNS, toTripRow } from '../tripRows';

// The full list lives in Trip Management.
const RECENT_TRIPS_LIMIT = 10;

function InhouseDriverDashboard() {
    const {
        isTripStatsLoading,
        tripStatsData,
        isRequestsLoading,
        requestsData,
        getDriverTripStats,
        getRequestsByDriver,
    } = useInhouseDriverReducer();

    useEffect(() => {
        getDriverTripStats();
        getRequestsByDriver();
    }, [getDriverTripStats, getRequestsByDriver]);

    const summaryCards = useMemo(
        () => [
            { title: 'Total Trips', value: String(tripStatsData?.total ?? 0), icon: <FiNavigation />, color: '#00368c' },
            { title: 'Completed Trips', value: String(tripStatsData?.completed ?? 0), icon: <FiCheckCircle />, color: '#10b981' },
            { title: 'Pending Trips', value: String(tripStatsData?.pending ?? 0), icon: <FiClock />, color: '#f59e0b' },
            { title: 'In Progress Trips', value: String(tripStatsData?.in_progress ?? 0), icon: <FiMapPin />, color: '#3b82f6' },
        ],
        [tripStatsData]
    );

    const tableRows = useMemo(
        () => (requestsData || []).slice(0, RECENT_TRIPS_LIMIT).map(toTripRow),
        [requestsData]
    );

    return (
        <PortalDashboard
            title="Inhouse Driver Dashboard"
            subtitle="Overview of your assigned, completed, and pending trips."
            summaryCards={summaryCards}
            tableTitle="Recent Trips"
            tableColumns={TRIP_TABLE_COLUMNS}
            tableRows={tableRows}
            isTableLoading={isTripStatsLoading || isRequestsLoading}
            emptyMessage="No trips found"
            expandable
            rowKey={(row) => row.id}
            renderExpandedRow={(row) => <TripDetails key={`${row.id}-${row.status}`} row={row} />}
        />
    );
}

export default InhouseDriverDashboard;
