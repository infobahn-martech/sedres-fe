import { useMemo } from "react";
import PropTypes from "prop-types";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const KPIAnalytics = ({ kpiData, tasks = [], isLoading = false, cardColor }) => {
  const performanceData = useMemo(() => {
    const performanceCounts = {
      "On Target": 0,
      "Above Target": 0,
      "Below Target": 0,
      "Critical": 0,
    };

    kpiData.forEach((kpi) => {
      if (kpi.performance && Object.prototype.hasOwnProperty.call(performanceCounts, kpi.performance)) {
        performanceCounts[kpi.performance]++;
      }
    });

    return Object.entries(performanceCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [kpiData]);

  const categoryData = useMemo(() => {
    const categoryOrder = [
      "Appointment Acceptance",
      "Call file open",
      "Pre arrival report",
      "Arrival report",
      "Vessel inward formalities",
      "Daily report",
      "Outward clearance issue",
      "Outward clearance deliver",
      "Sailing Report"
    ];

    const categoryCounts = {};
    categoryOrder.forEach((cat) => {
      categoryCounts[cat] = 0;
    });

    kpiData.forEach((kpi) => {
      const category = kpi.category || "Other";
      if (categoryCounts.hasOwnProperty(category)) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });

    categoryOrder.forEach((cat) => {
      if (categoryCounts[cat] === 0) {
        categoryCounts[cat] = 1;
      }
    });

    return categoryOrder.map((name) => ({
      name: name.length > 20 ? name.substring(0, 20) + "..." : name,
      fullName: name,
      value: categoryCounts[name] || 0,
    }));
  }, [kpiData]);

  const COLORS = [
    cardColor || "#2A00FF",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
  ];

  const performanceColors = {
    "On Target": "#10b981",
    "Above Target": "#06b6d4",
    "Below Target": "#f59e0b",
    "Critical": "#ef4444",
  };

  return (
    <div className="kpi-analytics-section">
      <style>{`
        .kpi-analytics-chart-container *:focus,
        .kpi-analytics-chart-wrapper *:focus,
        .kpi-analytics-chart-container svg:focus,
        .kpi-analytics-chart-wrapper svg:focus,
        .kpi-analytics-chart-container svg *:focus,
        .kpi-analytics-chart-wrapper svg *:focus {
          outline: none !important;
          border: none !important;
        }
      `}</style>
      <div className="kpi-analytics-header">
        <h3 className="kpi-analytics-title">
          <span className="kpi-analytics-title-bar"></span>
          ANALYTICS
        </h3>
      </div>
      <div className="kpi-analytics-content">
        {/* Pie Chart - Performance Distribution */}
        <div className="kpi-analytics-chart-container">
          <div className="kpi-analytics-chart-wrapper">
            <h4 className="kpi-analytics-chart-title">Performance Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={performanceColors[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - KPIs by Category */}
        <div className="kpi-analytics-chart-container">
          <div className="kpi-analytics-chart-wrapper">
            <h4 className="kpi-analytics-chart-title">KPIs by Category</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => [value, "Count"]}
                  labelFormatter={(label) => {
                    const item = categoryData.find((d) => d.name === label);
                    return item ? item.fullName : label;
                  }}
                />
                <Legend />
                <Bar dataKey="value" fill="#e2e6ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Performance Table */}
        <div className="kpi-analytics-table-container">
          <div className="table-wrapper table-responsive kpi-table-container">
            <table className="table table-striped kpi-table" style={{ "--card-color": "#e2e6ff" }}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Estimated Duration</th>
                  <th>Elapsed Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-3">
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Loading...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-3 text-muted">
                      No KPI data available
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div className="kpi-table-cell">{task.task || ""}</div>
                      </td>
                      <td>
                        <div className="kpi-table-cell">{task.estimatedDuration || ""}</div>
                      </td>
                      <td>
                        <div className="kpi-table-cell">{task.elapsedTime || ""}</div>
                      </td>
                      <td>
                        <div className={`kpi-table-cell ${getStatusClass(task.status)}`}>
                          {task.status || ""}
                        </div>
                      </td>
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

const getStatusClass = (status) => {
  const statusMap = {
    "Pending": "status-pending",
    "In Progress": "status-in-progress",
    "Completed": "status-completed",
    "Cancelled": "status-cancelled",
  };
  return statusMap[status] || "";
};

KPIAnalytics.propTypes = {
  kpiData: PropTypes.array.isRequired,
  tasks: PropTypes.array,
  isLoading: PropTypes.bool,
  cardColor: PropTypes.string,
};

KPIAnalytics.defaultProps = {
  tasks: [],
  isLoading: false,
};

export default KPIAnalytics;
