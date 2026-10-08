import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
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
import { FiAlertTriangle } from "react-icons/fi";
import {
  PackageOpen,
  Container,
  UsersRound,
  ShipWheel,
  ReceiptText,
  ClockAlert,
  Ship,
  CalendarDays,
  Trophy,
  Building2,
} from "lucide-react";
import dashboardService from "../../services/dashboardService";
import DateRangePicker from "./DateRangePicker";
import { useThemeStore } from "../../shared/store/themeStore";
import "../../design/scss/dashboard.scss";
import "../../design/scss/pages/dashboard/dashboard-content.scss";

const PORT_LABELS = {
  jubail: "Jubail",
  rt: "Ras Tanura",
  dammam: "Dammam",
};

// Tabs of the port-wise vessel list. Domestic tabs are pinned to a port.
const VESSEL_TABS = [
  { key: "import", label: "Import", direction: "import" },
  { key: "export", label: "Export", direction: "export" },
  { key: "domestic_jubail", label: "Domestic · Jubail", direction: "domestic", port: "jubail" },
  { key: "domestic_rt", label: "Domestic · RT", direction: "domestic", port: "rt" },
];

// Status → label + badge tone. Tone is always paired with the text label, never color alone.
const STATUS_META = {
  expected: { label: "Expected", tone: "neutral" },
  arrived: { label: "Arrived", tone: "info" },
  berthed: { label: "Berthed", tone: "info" },
  customs_clearance: { label: "Customs Clearance", tone: "warning" },
  loading: { label: "Loading", tone: "warning" },
  sailed: { label: "Sailed", tone: "success" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  in_progress: { label: "In Progress", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

// Categorical series colors (fixed order, validated for CVD separation per theme).
const SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#8b5cf6"],
  dark: ["#4c8dff", "#f2743b", "#22c08a", "#9b7bff"],
};

// Period filter for monthly charts — `months: null` keeps the full year to date.
const PERIOD_OPTIONS = [
  { value: "ytd", label: "Year to Date", months: null },
  { value: "6m", label: "Last 6 Months", months: 6 },
  { value: "3m", label: "Last 3 Months", months: 3 },
  { value: "custom", label: "Custom Range", months: null },
];

const DEFAULT_PERIOD = { period: "ytd", from: "", to: "" };

const PORT_OPTIONS = Object.entries(PORT_LABELS).map(([value, label]) => ({ value, label }));

const OVERDUE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const CURRENCY = "SAR";

const formatCurrency = (value) => `${CURRENCY} ${value.toLocaleString()}`;

const formatCompactCurrency = (value) => {
  if (value >= 1_000_000) return `${CURRENCY} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${CURRENCY} ${Math.round(value / 1_000)}K`;
  return `${CURRENCY} ${value}`;
};

// Axis ticks drop the currency (the chart subtitle carries it) so labels stay on one line.
const formatAxisValue = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] ?? { label: status, tone: "neutral" };
  return (
    <span className={`dash-badge dash-badge--${meta.tone}`} data-status={status}>
      {meta.label}
    </span>
  );
};

const FilterSelect = ({ value, onChange, label, allLabel, options }) => (
  <select className="dash-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
    {allLabel && <option value="all">{allLabel}</option>}
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const uniqueOptions = (values, labelFor = (v) => v) =>
  [...new Set(values)].sort().map((value) => ({ value, label: labelFor(value) }));

const matches = (filter, value) => filter === "all" || filter === value;

// Monthly rows carry `period` as YYYY-MM; a custom range keeps every month it touches.
const filterByPeriod = (data, { period, from, to }) => {
  if (period === "custom") {
    const fromMonth = from.slice(0, 7);
    const toMonth = to.slice(0, 7);
    return data.filter((row) => (!fromMonth || row.period >= fromMonth) && (!toMonth || row.period <= toMonth));
  }
  const months = PERIOD_OPTIONS.find((option) => option.value === period)?.months;
  return months ? data.slice(-months) : data;
};

const PeriodFilter = ({ value, onChange }) => (
  <>
    <FilterSelect
      value={value.period}
      onChange={(period) => onChange({ ...value, period })}
      label="Filter by period"
      options={PERIOD_OPTIONS}
    />
    {value.period === "custom" && (
      <DateRangePicker from={value.from} to={value.to} onChange={(range) => onChange({ ...value, ...range })} />
    )}
  </>
);

// Shared hover card for every chart. `color` covers marks filled with a gradient, whose payload color is a url().
const ChartTooltip = ({ active, payload, label, formatter = (value) => value.toLocaleString(), color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label && <div className="dash-tooltip-label">{label}</div>}
      {payload.map((item) => (
        <div key={item.name} className="dash-tooltip-row">
          <span className="dash-tooltip-dot" style={{ background: item.payload?.color ?? color ?? item.color }} />
          <span className="dash-tooltip-name">{item.name}</span>
          <span className="dash-tooltip-value">{formatter(item.value)}</span>
        </div>
      ))}
    </div>
  );
};

const ChartLegend = ({ items }) => (
  <ul className="chart-legend">
    {items.map((item) => (
      <li key={item.key}>
        <span className="chart-legend-swatch" style={{ background: item.color }} />
        {item.name}
      </li>
    ))}
  </ul>
);

// Vertical gradient used by area fills and bars — solid at the top, fading toward the baseline.
const FadeGradient = ({ id, color, from = 1, to = 0.55 }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={color} stopOpacity={from} />
    <stop offset="100%" stopColor={color} stopOpacity={to} />
  </linearGradient>
);

const average = (rows, key) => (rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0);

const EmptyRow = ({ colSpan, text }) => (
  <tr>
    <td colSpan={colSpan} className="dash-table-empty">
      {text}
    </td>
  </tr>
);

const Dashboard = () => {
  const [overview, setOverview] = useState(null);
  const [vesselTab, setVesselTab] = useState(VESSEL_TABS[0].key);
  const [vesselPort, setVesselPort] = useState("all");
  const [vesselClient, setVesselClient] = useState("all");
  const [vesselStatus, setVesselStatus] = useState("all");
  const [crewPort, setCrewPort] = useState("all");
  const [crewStatus, setCrewStatus] = useState("all");
  const [crewPeriod, setCrewPeriod] = useState(DEFAULT_PERIOD);
  const [revenueBranch, setRevenueBranch] = useState("all");
  const [revenuePeriod, setRevenuePeriod] = useState(DEFAULT_PERIOD);
  const [offshorePeriod, setOffshorePeriod] = useState(DEFAULT_PERIOD);
  const [revenueYear, setRevenueYear] = useState(null);
  const [soClient, setSoClient] = useState("all");
  const [soOverdueOnly, setSoOverdueOnly] = useState(false);

  const isDark = useThemeStore((state) => state.isDark);
  const seriesColors = SERIES_COLORS[isDark ? "dark" : "light"];
  const chartGridColor = isDark ? "#1a2744" : "#e5e7eb";
  const chartAxisColor = isDark ? "#9aaac4" : "#6b7280";
  const chartSurfaceColor = isDark ? "#0f1a30" : "#ffffff";
  // Recessive axes: no axis or tick lines, muted labels.
  const axisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fill: chartAxisColor, fontSize: 12 },
  };
  const barCursor = { fill: chartGridColor, opacity: 0.5 };

  useEffect(() => {
    let isMounted = true;
    dashboardService.getDashboardOverview().then((response) => {
      if (isMounted) setOverview(response.data.data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeTab = VESSEL_TABS.find((tab) => tab.key === vesselTab);

  // Vessels in the active tab, before the card's port/client/status filters.
  const tabVessels = useMemo(
    () =>
      (overview?.vessels ?? []).filter(
        (v) => v.direction === activeTab.direction && (!activeTab.port || v.port === activeTab.port)
      ),
    [overview, activeTab]
  );

  const vesselRows = useMemo(
    () =>
      tabVessels.filter(
        (v) =>
          (activeTab.port || matches(vesselPort, v.port)) &&
          matches(vesselClient, v.client) &&
          matches(vesselStatus, v.status)
      ),
    [tabVessels, activeTab, vesselPort, vesselClient, vesselStatus]
  );

  const vesselClientOptions = useMemo(
    () => uniqueOptions((overview?.vessels ?? []).map((v) => v.client)),
    [overview]
  );

  const vesselStatusOptions = useMemo(
    () => uniqueOptions(tabVessels.map((v) => v.status), (s) => STATUS_META[s]?.label ?? s),
    [tabVessels]
  );

  const crewRows = useMemo(
    () =>
      (overview?.crew_changes ?? []).filter(
        (cc) => matches(crewPort, cc.port) && matches(crewStatus, cc.status)
      ),
    [overview, crewPort, crewStatus]
  );

  const crewStatusOptions = useMemo(
    () =>
      uniqueOptions(
        (overview?.crew_changes ?? []).map((cc) => cc.status),
        (s) => STATUS_META[s]?.label ?? s
      ),
    [overview]
  );

  const handleVesselTabChange = (key) => {
    setVesselTab(key);
    setVesselStatus("all");
  };

  const vesselTabCounts = useMemo(
    () =>
      VESSEL_TABS.reduce((acc, tab) => {
        acc[tab.key] = (overview?.vessels ?? []).filter(
          (v) => v.direction === tab.direction && (!tab.port || v.port === tab.port)
        ).length;
        return acc;
      }, {}),
    [overview]
  );

  const salesOrders = useMemo(() => {
    const today = Date.now();
    return (overview?.open_sales_orders ?? []).map((so) => {
      const ageDays = Math.floor((today - new Date(so.created_on).getTime()) / DAY_MS);
      return { ...so, ageDays, isOverdue: ageDays > OVERDUE_DAYS };
    });
  }, [overview]);

  const soClientOptions = useMemo(
    () => uniqueOptions(salesOrders.map((so) => so.client)),
    [salesOrders]
  );

  const filteredSalesOrders = useMemo(
    () =>
      salesOrders.filter(
        (so) => matches(soClient, so.client) && (!soOverdueOnly || so.isOverdue)
      ),
    [salesOrders, soClient, soOverdueOnly]
  );

  const soTotals = useMemo(() => {
    const byClient = salesOrders.filter((so) => matches(soClient, so.client));
    const overdue = byClient.filter((so) => so.isOverdue);
    return {
      openCount: byClient.length,
      openValue: byClient.reduce((sum, so) => sum + so.amount, 0),
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((sum, so) => sum + so.amount, 0),
    };
  }, [salesOrders, soClient]);

  if (!overview) {
    return <div className="dashboard-container">Loading dashboard...</div>;
  }

  const { summary } = overview;
  const allOverdueCount = salesOrders.filter((so) => so.isOverdue).length;
  const crewTrend = filterByPeriod(overview.crew_change_trend, crewPeriod);
  const branchOptions = overview.branches.map((b) => ({ value: b.key, label: b.name }));

  // Year options newest first; defaults to the latest year.
  const revenueYearOptions = uniqueOptions(overview.revenue_by_year.map((row) => row.year)).reverse();
  const selectedRevenueYear = revenueYear ?? revenueYearOptions[0]?.value ?? "";
  const yearRevenue = overview.revenue_by_year.find((row) => row.year === selectedRevenueYear) ?? {};
  const branchTotals = overview.branches.map((branch) => yearRevenue[branch.key] ?? 0);
  const totalRevenue = branchTotals.reduce((sum, total) => sum + total, 0);
  // Colors follow the same branch order as the monthly charts.
  const revenueSegments = overview.branches.map((branch, index) => ({
    key: branch.key,
    name: branch.name,
    total: branchTotals[index],
    color: seriesColors[index % seriesColors.length],
    share: totalRevenue ? (branchTotals[index] / totalRevenue) * 100 : 0,
  }));
  const topSegment = revenueSegments.reduce((top, segment) => (segment.total > top.total ? segment : top), revenueSegments[0]);

  const branchRevenueData = filterByPeriod(overview.revenue_by_branch, revenuePeriod);
  // Color stays tied to the branch's position in the full list, so filtering never repaints a series.
  const visibleBranches = overview.branches
    .map((branch, index) => ({ key: branch.key, name: branch.name, color: seriesColors[index] }))
    .filter((branch) => matches(revenueBranch, branch.key));
  const offshoreData = filterByPeriod(overview.revenue_offshore_marine, offshorePeriod);

  const latestCrewMonth = overview.crew_change_trend.at(-1);
  const openOrdersValue = salesOrders.reduce((sum, so) => sum + so.amount, 0);
  const overdueShare = salesOrders.length ? Math.round((allOverdueCount / salesOrders.length) * 100) : 0;

  const stats = [
    { title: "Vessels Imported", value: summary.total_vessels_imported, hint: "Year to date", icon: <PackageOpen />, tone: "blue" },
    { title: "Vessels Exported", value: summary.total_vessels_exported, hint: "Year to date", icon: <Container />, tone: "green" },
    {
      title: "Crew Changes YTD",
      value: summary.total_crew_change_ytd,
      hint: latestCrewMonth ? `${latestCrewMonth.count} in ${latestCrewMonth.month}` : "Year to date",
      icon: <UsersRound />,
      tone: "violet",
    },
    { title: "Vessels in Agency", value: summary.vessels_in_agency, hint: `Across ${PORT_OPTIONS.length} ports`, icon: <ShipWheel />, tone: "blue" },
    { title: "Open Sales Orders", value: salesOrders.length, hint: `${formatCompactCurrency(openOrdersValue)} open value`, icon: <ReceiptText />, tone: "amber" },
    { title: `Orders > ${OVERDUE_DAYS} Days`, value: allOverdueCount, hint: `${overdueShare}% of open orders`, icon: <ClockAlert />, tone: "red" },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Dashboard</h2>
          <p className="dashboard-subtitle">Vessels, crew changes, revenue and open sales orders at a glance.</p>
        </div>
        <span className="dashboard-date">
          <CalendarDays />
          {formatDate(Date.now())}
        </span>
      </div>

      <div className="charts-grid charts-grid--top">
        {/* Total revenue — yearly */}
        <div className="chart-card chart-card-full">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Total Revenue</h3>
              <p className="chart-subtitle">Branch revenue for the selected year</p>
            </div>
            <div className="dash-filters">
              <FilterSelect
                value={selectedRevenueYear}
                onChange={setRevenueYear}
                label="Filter by year"
                options={revenueYearOptions}
              />
            </div>
          </div>
          <div className="revenue-overview">
            <div className="revenue-hero">
              <span className="revenue-hero-label">Total Revenue · {selectedRevenueYear}</span>
              <span className="revenue-hero-value">{formatCurrency(totalRevenue)}</span>
              <div className="revenue-hero-meta">
                <span>
                  <Building2 /> {revenueSegments.length} branches
                </span>
                {topSegment?.total > 0 && (
                  <span>
                    <Trophy /> {topSegment.name} leads · {Math.round(topSegment.share)}%
                  </span>
                )}
              </div>
            </div>

            <div className="revenue-donut">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueSegments}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={92}
                    paddingAngle={2}
                    cornerRadius={4}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {revenueSegments.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="revenue-donut-center">
                <span className="revenue-donut-value">{formatCompactCurrency(totalRevenue)}</span>
                <span className="revenue-donut-label">{selectedRevenueYear}</span>
              </div>
            </div>

            <ul className="revenue-breakdown">
              {revenueSegments.map((segment) => (
                <li key={segment.key} className="revenue-segment">
                  <div className="revenue-segment-head">
                    <span className="revenue-dot" style={{ background: segment.color }} />
                    <span className="revenue-segment-name">{segment.name}</span>
                    <span className="revenue-segment-share">{Math.round(segment.share)}%</span>
                  </div>
                  <span className="revenue-segment-value">{formatCurrency(segment.total)}</span>
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
            {/* <span className="stat-hint">{stat.hint}</span> */}
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {/* Port-wise vessel list */}
        <div className="chart-card chart-card-full">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Vessels by Port</h3>
              <p className="chart-subtitle">Import, export and domestic vessels with current status</p>
            </div>
            <div className="dash-filters">
              {!activeTab.port && (
                <FilterSelect
                  value={vesselPort}
                  onChange={setVesselPort}
                  label="Filter by port"
                  allLabel="All Ports"
                  options={PORT_OPTIONS}
                />
              )}
              <FilterSelect
                value={vesselClient}
                onChange={setVesselClient}
                label="Filter by client"
                allLabel="All Clients"
                options={vesselClientOptions}
              />
              <FilterSelect
                value={vesselStatus}
                onChange={setVesselStatus}
                label="Filter by status"
                allLabel="All Statuses"
                options={vesselStatusOptions}
              />
            </div>
          </div>

          <div className="dash-tabs" role="tablist">
            {VESSEL_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={vesselTab === tab.key}
                className={`dash-tab ${vesselTab === tab.key ? "active" : ""}`}
                onClick={() => handleVesselTabChange(tab.key)}
              >
                {tab.label}
                <span className="dash-tab-count">{vesselTabCounts[tab.key]}</span>
              </button>
            ))}
          </div>

          <div className="dash-table-wrp">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Port</th>
                  <th>Client</th>
                  <th>{activeTab.direction === "export" ? "ETD" : "ETA"}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vesselRows.length === 0 ? (
                  <EmptyRow colSpan={5} text="No vessels found" />
                ) : (
                  vesselRows.map((v) => (
                    <tr key={v.id}>
                      <td className="dash-table-strong">
                        <span className="dash-vessel">
                          <span className="dash-vessel-icon">
                            <Ship />
                          </span>
                          {v.name}
                        </span>
                      </td>
                      <td>{PORT_LABELS[v.port]}</td>
                      <td>{v.client}</td>
                      <td>{formatDate(v.eta)}</td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Crew changes list */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Crew Changes</h3>
              <p className="chart-subtitle">Recent and upcoming crew changes</p>
            </div>
            <div className="dash-filters">
              <FilterSelect
                value={crewPort}
                onChange={setCrewPort}
                label="Filter by port"
                allLabel="All Ports"
                options={PORT_OPTIONS}
              />
              <FilterSelect
                value={crewStatus}
                onChange={setCrewStatus}
                label="Filter by status"
                allLabel="All Statuses"
                options={crewStatusOptions}
              />
            </div>
          </div>
          <div className="dash-table-wrp">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Port</th>
                  <th>Date</th>
                  <th className="num">On / Off</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {crewRows.length === 0 ? (
                  <EmptyRow colSpan={5} text="No crew changes" />
                ) : (
                  crewRows.map((cc) => (
                    <tr key={cc.id}>
                      <td className="dash-table-strong">{cc.vessel}</td>
                      <td>{PORT_LABELS[cc.port]}</td>
                      <td>{formatDate(cc.date)}</td>
                      <td className="num">
                        {cc.on_signers} / {cc.off_signers}
                      </td>
                      <td>
                        <StatusBadge status={cc.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Crew change trend */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Crew Change per Month</h3>
              <p className="chart-subtitle">
                {crewTrend.reduce((sum, m) => sum + m.count, 0).toLocaleString()} crew changes in period
              </p>
            </div>
            <div className="dash-filters">
              <PeriodFilter value={crewPeriod} onChange={setCrewPeriod} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={crewTrend} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <FadeGradient id="crew-bar" color={seriesColors[0]} />
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickMargin={10} />
              <YAxis {...axisProps} />
              <Tooltip content={<ChartTooltip color={seriesColors[0]} />} cursor={barCursor} />
              <ReferenceLine
                y={average(crewTrend, "count")}
                stroke={chartAxisColor}
                strokeDasharray="4 4"
                label={{ value: "Avg", position: "insideTopRight", fill: chartAxisColor, fontSize: 11 }}
              />
              <Bar
                dataKey="count"
                name="Crew Changes"
                fill="url(#crew-bar)"
                activeBar={{ fill: seriesColors[0] }}
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly revenue — branch wise */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Monthly Revenue · Branch Wise</h3>
              <p className="chart-subtitle">Revenue per branch ({CURRENCY})</p>
              <ChartLegend items={visibleBranches} />
            </div>
            <div className="dash-filters">
              <FilterSelect
                value={revenueBranch}
                onChange={setRevenueBranch}
                label="Filter by branch"
                allLabel="All Branches"
                options={branchOptions}
              />
              <PeriodFilter value={revenuePeriod} onChange={setRevenuePeriod} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={branchRevenueData} margin={{ top: 16, right: 8, left: -4, bottom: 0 }}>
              <defs>
                {visibleBranches.map((branch) => (
                  <FadeGradient key={branch.key} id={`rev-${branch.key}`} color={branch.color} from={0.22} to={0} />
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickMargin={10} />
              <YAxis {...axisProps} tickFormatter={formatAxisValue} width={48} />
              <Tooltip
                content={<ChartTooltip formatter={formatCurrency} />}
                cursor={{ stroke: chartAxisColor, strokeDasharray: "4 4" }}
              />
              {visibleBranches.map((branch) => (
                <Area
                  key={branch.key}
                  type="monotone"
                  dataKey={branch.key}
                  name={branch.name}
                  stroke={branch.color}
                  strokeWidth={2}
                  fill={`url(#rev-${branch.key})`}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: chartSurfaceColor, fill: branch.color }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly revenue — offshore marine */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Monthly Revenue · Offshore Marine</h3>
              <p className="chart-subtitle">
                {formatCurrency(offshoreData.reduce((sum, m) => sum + m.revenue, 0))} in period
              </p>
            </div>
            <div className="dash-filters">
              <PeriodFilter value={offshorePeriod} onChange={setOffshorePeriod} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={offshoreData} margin={{ top: 16, right: 8, left: -4, bottom: 0 }}>
              <defs>
                <FadeGradient id="offshore-bar" color={seriesColors[3]} />
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickMargin={10} />
              <YAxis {...axisProps} tickFormatter={formatAxisValue} width={48} />
              <Tooltip
                content={<ChartTooltip formatter={formatCurrency} color={seriesColors[3]} />}
                cursor={barCursor}
              />
              <ReferenceLine
                y={average(offshoreData, "revenue")}
                stroke={chartAxisColor}
                strokeDasharray="4 4"
                label={{ value: "Avg", position: "insideTopRight", fill: chartAxisColor, fontSize: 11 }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="url(#offshore-bar)"
                activeBar={{ fill: seriesColors[3] }}
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Open sales orders */}
        <div className="chart-card chart-card-full">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Open Sales Orders</h3>
              <p className="chart-subtitle">Orders not yet invoiced, by client</p>
            </div>
            <div className="dash-filters">
              <label className="dash-checkbox">
                <input
                  type="checkbox"
                  checked={soOverdueOnly}
                  onChange={(e) => setSoOverdueOnly(e.target.checked)}
                />
                Beyond {OVERDUE_DAYS} days only
              </label>
              <FilterSelect
                value={soClient}
                onChange={setSoClient}
                label="Filter by client"
                allLabel="All Clients"
                options={soClientOptions}
              />
            </div>
          </div>

          <div className="so-summary">
            <div className="so-summary-item">
              <span className="so-summary-label">Open Orders</span>
              <span className="so-summary-value">{soTotals.openCount}</span>
              <span className="so-summary-sub">{formatCurrency(soTotals.openValue)}</span>
            </div>
            <div className="so-summary-item so-summary-item--alert">
              <span className="so-summary-label">Beyond {OVERDUE_DAYS} Days</span>
              <span className="so-summary-value">{soTotals.overdueCount}</span>
              <span className="so-summary-sub">{formatCurrency(soTotals.overdueValue)}</span>
            </div>
          </div>

          <div className="dash-table-wrp">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>SO Number</th>
                  <th>Client</th>
                  <th>Created On</th>
                  <th className="num">Age (days)</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesOrders.length === 0 ? (
                  <EmptyRow colSpan={5} text="No open sales orders" />
                ) : (
                  filteredSalesOrders.map((so) => (
                    <tr key={so.id}>
                      <td className="dash-table-strong">{so.so_number}</td>
                      <td>{so.client}</td>
                      <td>{formatDate(so.created_on)}</td>
                      <td className="num">
                        {so.ageDays}
                        {so.isOverdue && (
                          <span className="dash-badge dash-badge--critical so-overdue">
                            <FiAlertTriangle /> Overdue
                          </span>
                        )}
                      </td>
                      <td className="num">{formatCurrency(so.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
