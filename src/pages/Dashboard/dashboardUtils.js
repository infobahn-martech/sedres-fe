import { useThemeStore } from "../../shared/store/themeStore";

// Shared constants and helpers for role dashboards (master Dashboard, Transport Coordinator, ...).

export const PORT_LABELS = {
  jubail: "Jubail",
  rt: "Ras Tanura",
  dammam: "Dammam",
};

export const PORT_OPTIONS = Object.entries(PORT_LABELS).map(([value, label]) => ({ value, label }));

// Categorical series colors (fixed order, validated for CVD separation per theme).
const SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#8b5cf6"],
  dark: ["#4c8dff", "#f2743b", "#22c08a", "#9b7bff"],
};

// Period filter for monthly charts — `months: null` keeps the full year to date.
export const PERIOD_OPTIONS = [
  { value: "ytd", label: "Year to Date", months: null },
  { value: "6m", label: "Last 6 Months", months: 6 },
  { value: "3m", label: "Last 3 Months", months: 3 },
  { value: "custom", label: "Custom Range", months: null },
];

export const DEFAULT_PERIOD = { period: "ytd", from: "", to: "" };

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const uniqueOptions = (values, labelFor = (v) => v) =>
  [...new Set(values)].sort().map((value) => ({ value, label: labelFor(value) }));

export const matches = (filter, value) => filter === "all" || filter === value;

// Monthly rows carry `period` as YYYY-MM; a custom range keeps every month it touches.
export const filterByPeriod = (data, { period, from, to }) => {
  if (period === "custom") {
    const fromMonth = from.slice(0, 7);
    const toMonth = to.slice(0, 7);
    return data.filter((row) => (!fromMonth || row.period >= fromMonth) && (!toMonth || row.period <= toMonth));
  }
  const months = PERIOD_OPTIONS.find((option) => option.value === period)?.months;
  return months ? data.slice(-months) : data;
};

export const average = (rows, key) => (rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0);

// Theme-aware chart colors plus the recessive axis styling every chart shares.
export const useChartTheme = () => {
  const isDark = useThemeStore((state) => state.isDark);
  const gridColor = isDark ? "#1a2744" : "#e5e7eb";
  const axisColor = isDark ? "#9aaac4" : "#6b7280";
  return {
    seriesColors: SERIES_COLORS[isDark ? "dark" : "light"],
    gridColor,
    axisColor,
    surfaceColor: isDark ? "#0f1a30" : "#ffffff",
    axisProps: {
      axisLine: false,
      tickLine: false,
      tick: { fill: axisColor, fontSize: 12 },
    },
    barCursor: { fill: gridColor, opacity: 0.5 },
  };
};
