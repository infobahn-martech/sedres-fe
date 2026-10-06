import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FiDownload,
  FiUpload,
  FiUsers,
  FiAnchor,
  FiFileText,
  FiAlertTriangle,
} from "react-icons/fi";
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
  const chartTooltipStyle = {
    backgroundColor: isDark ? "#0f1a30" : "#fff",
    border: `1px solid ${isDark ? "#2a3b60" : "#e5e7eb"}`,
    borderRadius: "8px",
    color: isDark ? "#ffffff" : "#111827",
  };

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
  const branchRevenueTotals = overview.branches.map((branch) => ({ ...branch, total: yearRevenue[branch.key] ?? 0 }));
  const offshoreRevenueTotal = yearRevenue.offshore ?? 0;
  const totalRevenue = branchRevenueTotals.reduce((sum, branch) => sum + branch.total, offshoreRevenueTotal);
  // Branches first, offshore last — colors follow the same order as the monthly charts.
  const revenueSegments = [
    ...branchRevenueTotals.map((branch) => ({ key: branch.key, name: branch.name, total: branch.total })),
    { key: "offshore", name: "Offshore Marine", total: offshoreRevenueTotal },
  ].map((segment, index) => ({
    ...segment,
    color: seriesColors[index % seriesColors.length],
    share: totalRevenue ? (segment.total / totalRevenue) * 100 : 0,
  }));

  const stats = [
    { title: "Total Vessels Imported", value: summary.total_vessels_imported, icon: <FiDownload />, tone: "blue" },
    { title: "Total Vessels Exported", value: summary.total_vessels_exported, icon: <FiUpload />, tone: "green" },
    { title: "Total Crew Change YTD", value: summary.total_crew_change_ytd, icon: <FiUsers />, tone: "violet" },
    { title: "Vessels Currently in Agency", value: summary.vessels_in_agency, icon: <FiAnchor />, tone: "blue" },
    { title: "Open Sales Orders", value: salesOrders.length, icon: <FiFileText />, tone: "amber" },
    { title: `Sales Orders > ${OVERDUE_DAYS} Days`, value: allOverdueCount, icon: <FiAlertTriangle />, tone: "red" },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Dashboard</h2>
        <p className="dashboard-subtitle">Vessels, crew changes, revenue and open sales orders at a glance.</p>
      </div>

      <div className="charts-grid charts-grid--top">
        {/* Total revenue — yearly */}
        <div className="chart-card chart-card-full">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Total Revenue</h3>
              <p className="chart-subtitle">Branch and offshore marine revenue for the selected year</p>
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
              <div className="revenue-share-bar" role="img" aria-label="Revenue share by segment">
                {revenueSegments.map((segment) => (
                  <span
                    key={segment.key}
                    style={{ width: `${segment.share}%`, background: segment.color }}
                    title={`${segment.name}: ${Math.round(segment.share)}%`}
                  />
                ))}
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
          <div key={stat.title} className="stat-card">
            <div className="stat-card-content">
              <div className={`stat-icon stat-icon--${stat.tone}`}>{stat.icon}</div>
              <div className="stat-info">
                <p className="stat-title">{stat.title}</p>
                <h3 className="stat-value">{stat.value.toLocaleString()}</h3>
              </div>
            </div>
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

          <div className="" role="tablist">
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
                      <td className="dash-table-strong">{v.name}</td>
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
            <BarChart data={crewTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" stroke={chartAxisColor} />
              <YAxis stroke={chartAxisColor} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: chartGridColor, opacity: 0.4 }} />
              <Bar dataKey="count" name="Crew Changes" fill={seriesColors[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly revenue — branch wise */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Monthly Revenue · Branch Wise</h3>
              <p className="chart-subtitle">Revenue per branch</p>
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
            <LineChart
              data={filterByPeriod(overview.revenue_by_branch, revenuePeriod)}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" stroke={chartAxisColor} />
              <YAxis stroke={chartAxisColor} tickFormatter={formatCompactCurrency} width={72} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={formatCurrency} />
              <Legend />
              {/* Color stays tied to the branch's position in the full list, so filtering never repaints a line. */}
              {overview.branches.map(
                (branch, index) =>
                  matches(revenueBranch, branch.key) && (
                    <Line
                      key={branch.key}
                      type="monotone"
                      dataKey={branch.key}
                      name={branch.name}
                      stroke={seriesColors[index]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: seriesColors[index] }}
                      activeDot={{ r: 5 }}
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly revenue — offshore marine */}
        <div className="chart-card">
          <div className="chart-header chart-header--row">
            <div>
              <h3 className="chart-title">Monthly Revenue · Offshore Marine</h3>
              <p className="chart-subtitle">Offshore marine revenue</p>
            </div>
            <div className="dash-filters">
              <PeriodFilter value={offshorePeriod} onChange={setOffshorePeriod} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filterByPeriod(overview.revenue_offshore_marine, offshorePeriod)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="month" stroke={chartAxisColor} />
              <YAxis stroke={chartAxisColor} tickFormatter={formatCompactCurrency} width={72} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={formatCurrency}
                cursor={{ fill: chartGridColor, opacity: 0.4 }}
              />
              <Bar dataKey="revenue" name="Revenue" fill={seriesColors[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
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
