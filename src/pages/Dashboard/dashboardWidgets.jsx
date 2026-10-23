import DateRangePicker from "./DateRangePicker";
import { PERIOD_OPTIONS } from "./dashboardUtils";

// Shared UI pieces for role dashboards (master Dashboard, Transport Coordinator, ...).

// Status → label + badge tone. Tone is always paired with the text label, never color alone.
export const StatusBadge = ({ status, meta }) => {
  const { label, tone } = meta[status] ?? { label: status, tone: "neutral" };
  return (
    <span className={`dash-badge dash-badge--${tone}`} data-status={status}>
      {label}
    </span>
  );
};

export const FilterSelect = ({ value, onChange, label, allLabel, options }) => (
  <select className="dash-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
    {allLabel && <option value="all">{allLabel}</option>}
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export const PeriodFilter = ({ value, onChange }) => (
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
export const ChartTooltip = ({ active, payload, label, formatter = (value) => value.toLocaleString(), color }) => {
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

export const ChartLegend = ({ items }) => (
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
export const FadeGradient = ({ id, color, from = 1, to = 0.55 }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={color} stopOpacity={from} />
    <stop offset="100%" stopColor={color} stopOpacity={to} />
  </linearGradient>
);

export const EmptyRow = ({ colSpan, text }) => (
  <tr>
    <td colSpan={colSpan} className="dash-table-empty">
      {text}
    </td>
  </tr>
);
