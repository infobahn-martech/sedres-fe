import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarClock,
  Hourglass,
  Truck,
  CircleCheck,
  UserRound,
  Car,
  Ship,
  ArrowRight,
  CalendarDays,
  Trophy,
  Building2,
} from "lucide-react";
import transportDashboardService from "../../services/transportDashboardService";
import {
  PORT_LABELS,
  PORT_OPTIONS,
  DEFAULT_PERIOD,
  formatDate,
  uniqueOptions,
  matches,
  filterByPeriod,
  average,
  useChartTheme,
} from "../Dashboard/dashboardUtils";
import {
  StatusBadge,
  FilterSelect,
  PeriodFilter,
  ChartTooltip,
  FadeGradient,
  EmptyRow,
} from "../Dashboard/dashboardWidgets";
import "../../design/scss/dashboard.scss";
import "../../design/scss/pages/dashboard/dashboard-content.scss";

const STATUS_META = {
  pending_assignment: { label: "Pending Assignment", tone: "warning" },
  assigned: { label: "Assigned", tone: "info" },
  in_transit: { label: "In Transit", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

// Request tabs: Today / Upcoming split by pickup day; Pending cuts across both.
const REQUEST_TABS = [
  { key: "today", label: "Today", test: (r, now) => isSameDay(new Date(r.pickup_at), now) },
  {
    key: "upcoming",
    label: "Upcoming",
    test: (r, now) => new Date(r.pickup_at) > now && !isSameDay(new Date(r.pickup_at), now),
  },
  { key: "pending", label: "Pending Assignment", test: (r) => r.status === "pending_assignment" },
];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const share = (part, total) => (total ? (part / total) * 100 : 0);

const TransportCoordinatorDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [requestTab, setRequestTab] = useState(REQUEST_TABS[0].key);
  const [requestPort, setRequestPort] = useState("all");
  const [requestCompany, setRequestCompany] = useState("all");
  const [requestStatus, setRequestStatus] = useState("all");
  const [tripPeriod, setTripPeriod] = useState(DEFAULT_PERIOD);

  const { seriesColors, gridColor, axisColor, axisProps, barCursor } = useChartTheme();

  useEffect(() => {
    let isMounted = true;
    transportDashboardService.getTransportDashboardOverview().then((response) => {
      if (isMounted) setOverview(response.data.data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const requests = useMemo(() => overview?.transport_requests ?? [], [overview]);
  const activeTab = REQUEST_TABS.find((tab) => tab.key === requestTab);

  const tabCounts = useMemo(() => {
    const now = new Date();
    return REQUEST_TABS.reduce((acc, tab) => {
      acc[tab.key] = requests.filter((r) => tab.test(r, now)).length;
      return acc;
    }, {});
  }, [requests]);

  const requestRows = useMemo(() => {
    const now = new Date();
    return requests
      .filter(
        (r) =>
          activeTab.test(r, now) &&
          matches(requestPort, r.port) &&
          matches(requestCompany, r.company) &&
          matches(requestStatus, r.status)
      )
      .sort((a, b) => new Date(a.pickup_at) - new Date(b.pickup_at));
  }, [requests, activeTab, requestPort, requestCompany, requestStatus]);

  const companyOptions = useMemo(() => uniqueOptions(requests.map((r) => r.company)), [requests]);

  const statusOptions = useMemo(
    () => uniqueOptions(requests.map((r) => r.status), (s) => STATUS_META[s]?.label ?? s),
    [requests]
  );

  const handleRequestTabChange = (key) => {
    setRequestTab(key);
    setRequestStatus("all");
  };

  if (!overview) {
    return <div className="dashboard-container">Loading dashboard...</div>;
  }

  const { summary, fleet } = overview;

  const totalTrips = overview.trips_by_company.reduce((sum, company) => sum + company.trips, 0);
  const companySegments = overview.trips_by_company.map((company, index) => ({
    ...company,
    color: seriesColors[index % seriesColors.length],
    share: share(company.trips, totalTrips),
  }));
  const topCompany = companySegments.reduce((top, segment) => (segment.trips > top.trips ? segment : top), companySegments[0]);
  const currentMonthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const tripTrend = filterByPeriod(overview.trip_trend, tripPeriod);

  const totalDrivers = fleet.drivers.available + fleet.drivers.on_trip + fleet.drivers.off_duty;
  const driverSegments = [
    { key: "available", name: "Available", value: fleet.drivers.available, color: seriesColors[2] },
    { key: "on_trip", name: "On Trip", value: fleet.drivers.on_trip, color: seriesColors[0] },
    { key: "off_duty", name: "Off Duty", value: fleet.drivers.off_duty, color: seriesColors[1] },
  ];

  const stats = [
    { title: "Today's Pickups", value: summary.todays_pickups, icon: <CalendarClock />, tone: "blue" },
    { title: "Pending Assignment", value: summary.pending_assignment, icon: <Hourglass />, tone: "amber" },
    { title: "In Transit", value: summary.in_transit, icon: <Truck />, tone: "violet" },
    { title: "Completed (MTD)", value: summary.completed_mtd, icon: <CircleCheck />, tone: "green" },
    { title: "Active Drivers", value: summary.active_drivers, icon: <UserRound />, tone: "blue" },
    { title: "Available Vehicles", value: summary.available_vehicles, icon: <Car />, tone: "red" },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Transport Dashboard</h2>
          <p className="dashboard-subtitle">Crew transport requests, trips and fleet availability at a glance.</p>
        </div>
        <span className="dashboard-date">
          <CalendarDays />
          {formatDate(Date.now())}
        </span>
      </div>

      <div className="charts-grid charts-grid--top">
        {/* Trips this month — by transport provider */}
        <div className="chart-card chart-card-full">
          <div className="chart-header">
            <h3 className="chart-title">Trips by Transport Company</h3>
            <p className="chart-subtitle">In-house fleet and external companies this month</p>
          </div>
          <div className="revenue-overview">
            <div className="revenue-hero">
              <span className="revenue-hero-label">Total Trips · {currentMonthLabel}</span>
              <span className="revenue-hero-value">{totalTrips.toLocaleString()}</span>
              <div className="revenue-hero-meta">
                <span>
                  <Building2 /> {companySegments.length} providers
                </span>
                {topCompany?.trips > 0 && (
                  <span>
                    <Trophy /> {topCompany.name} leads · {Math.round(topCompany.share)}%
                  </span>
                )}
              </div>
            </div>

            <div className="revenue-donut">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={companySegments}
                    dataKey="trips"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={92}
                    paddingAngle={2}
                    cornerRadius={4}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {companySegments.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="revenue-donut-center">
                <span className="revenue-donut-value">{totalTrips.toLocaleString()}</span>
                <span className="revenue-donut-label">trips</span>
              </div>
            </div>

            <ul className="revenue-breakdown">
              {companySegments.map((segment) => (
                <li key={segment.key} className="revenue-segment">
                  <div className="revenue-segment-head">
                    <span className="revenue-dot" style={{ background: segment.color }} />
                    <span className="revenue-segment-name">{segment.name}</span>
                    <span className="revenue-segment-share">{Math.round(segment.share)}%</span>
                  </div>
                  <span className="revenue-segment-value">{segment.trips.toLocaleString()} trips</span>
                  <div className="revenue-segment-track">
                    <span style={{ width: `${segment.share}%`, background: segment.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.title} className={`stat-card stat-card--${stat.tone}`}>
            <div className="stat-card-content">
              <div className={`stat-icon stat-icon--${stat.tone}`}>{stat.icon}</div>
              <p className="stat-title">{stat.title}</p>
            </div>
            <h3 className="stat-value">{stat.value.toLocaleString()}</h3>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {/* Transport requests */}
        <div className="chart-card chart-card-full">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Transport Requests</h3>
              <p className="chart-subtitle">Crew pickups and drop-offs with driver assignment</p>
            </div>
            <div className="dash-filters">
              <FilterSelect
                value={requestPort}
                onChange={setRequestPort}
                label="Filter by port"
                allLabel="All Ports"
                options={PORT_OPTIONS}
              />
              <FilterSelect
                value={requestCompany}
                onChange={setRequestCompany}
                label="Filter by transport company"
                allLabel="All Companies"
                options={companyOptions}
              />
              <FilterSelect
                value={requestStatus}
                onChange={setRequestStatus}
                label="Filter by status"
                allLabel="All Statuses"
                options={statusOptions}
              />
            </div>
          </div>

          <div className="dash-tabs" role="tablist">
            {REQUEST_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={requestTab === tab.key}
                className={`dash-tab ${requestTab === tab.key ? "active" : ""}`}
                onClick={() => handleRequestTabChange(tab.key)}
              >
                {tab.label}
                <span className="dash-tab-count">{tabCounts[tab.key]}</span>
              </button>
            ))}
          </div>

          <div className="dash-table-wrp">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>WO No</th>
                  <th>Vessel</th>
                  <th>Route</th>
                  <th>Pickup</th>
                  <th className="num">Crew</th>
                  <th>Driver / Vehicle</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requestRows.length === 0 ? (
                  <EmptyRow colSpan={7} text="No transport requests" />
                ) : (
                  requestRows.map((r) => (
                    <tr key={r.id}>
                      <td className="dash-table-strong">{r.wo_number}</td>
                      <td>
                        <span className="dash-vessel">
                          <span className="dash-vessel-icon">
                            <Ship />
                          </span>
                          <span>
                            {r.vessel}
                            <br />
                            <span className="stat-hint">{PORT_LABELS[r.port]}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {r.from} <ArrowRight size={14} aria-label="to" /> {r.to}
                      </td>
                      <td>{formatDateTime(r.pickup_at)}</td>
                      <td className="num">{r.crew_count}</td>
                      <td>
                        {r.driver ? (
                          <>
                            {r.driver}
                            <br />
                            <span className="stat-hint">{r.vehicle}</span>
                          </>
                        ) : (
                          <span className="stat-hint">Not assigned · {r.company}</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.status} meta={STATUS_META} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trips per month */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Trips per Month</h3>
              <p className="chart-subtitle">
                {tripTrend.reduce((sum, m) => sum + m.trips, 0).toLocaleString()} trips in period
              </p>
            </div>
            <div className="dash-filters">
              <PeriodFilter value={tripPeriod} onChange={setTripPeriod} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tripTrend} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <FadeGradient id="trip-bar" color={seriesColors[0]} />
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickMargin={10} />
              <YAxis {...axisProps} />
              <Tooltip content={<ChartTooltip color={seriesColors[0]} />} cursor={barCursor} />
              <ReferenceLine
                y={average(tripTrend, "trips")}
                stroke={axisColor}
                strokeDasharray="4 4"
                label={{ value: "Avg", position: "insideTopRight", fill: axisColor, fontSize: 11 }}
              />
              <Bar
                dataKey="trips"
                name="Trips"
                fill="url(#trip-bar)"
                activeBar={{ fill: seriesColors[0] }}
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet status */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Fleet Status</h3>
            <p className="chart-subtitle">
              {totalDrivers} drivers · availability by vehicle type
            </p>
          </div>
          <ul className="revenue-breakdown">
            {driverSegments.map((segment) => (
              <li key={segment.key} className="revenue-segment">
                <div className="revenue-segment-head">
                  <span className="revenue-dot" style={{ background: segment.color }} />
                  <span className="revenue-segment-name">Drivers · {segment.name}</span>
                  <span className="revenue-segment-share">{Math.round(share(segment.value, totalDrivers))}%</span>
                </div>
                <span className="revenue-segment-value">{segment.value}</span>
                <div className="revenue-segment-track">
                  <span style={{ width: `${share(segment.value, totalDrivers)}%`, background: segment.color }} />
                </div>
              </li>
            ))}
            {fleet.vehicles_by_type.map((vehicle) => (
              <li key={vehicle.type} className="revenue-segment">
                <div className="revenue-segment-head">
                  <span className="revenue-dot" style={{ background: seriesColors[3] }} />
                  <span className="revenue-segment-name">{vehicle.type}</span>
                  <span className="revenue-segment-share">{Math.round(share(vehicle.available, vehicle.total))}%</span>
                </div>
                <span className="revenue-segment-value">
                  {vehicle.available} / {vehicle.total} available
                </span>
                <div className="revenue-segment-track">
                  <span style={{ width: `${share(vehicle.available, vehicle.total)}%`, background: seriesColors[3] }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TransportCoordinatorDashboard;
