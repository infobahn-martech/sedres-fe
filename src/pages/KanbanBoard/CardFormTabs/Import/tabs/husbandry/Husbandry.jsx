import { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import dayjs from "dayjs";
import "@/design/scss/operations.scss";
import "@/design/scss/table-common.scss";
import "@/design/scss/materialmanagement.scss";

// Import constants
import {
  MAIN_TABS,
  CREW_MANAGEMENT_SUBTABS,
  MATERIAL_MANAGEMENT_SUBTABS,
  LAUNCH_HIRE_SUBTABS,
  TAB_ICON_COLORS,
  TAB_ICON_PATHS,
} from "./components/Husbandry.constants";

// Import shared components
import { HusbandryTabs } from "./components/Husbandry.components";
import CrewCoordinatorsSelect from "./components/CrewCoordinatorsSelect";

// Import content components
import CrewManagementDashboard from "./components/CrewManagementDashboard";
import TransportContent from "./components/TransportContent";
import CGPassContent from "./components/CGPassContent";
import ZawilPassContent from "./components/ZawilPassContent";
import LaunchHireContent from "./components/LaunchHireContent";
import HotelContent from "./components/HotelContent";
import MedicalServiceContent from "./components/MedicalServiceContent";
import WasteDisposalContent from "./components/WasteDisposalContent";
import MaterialManagementContent from "./components/MaterialManagementContent";
import InboundOrdersContent from "./components/InboundOrdersContent";
import LandingNoteContent from "./components/LandingNoteContent";
import DispatchNoteContent from "./components/DispatchNoteContent";
import OrderHistoryContent from "./components/OrderHistoryContent";
import MWPRenewalContent from "./components/MWPRenewalContent";
import OnStationContent from "./components/OnStationContent";
import ThirdPartyServicesContent from "./components/ThirdPartyServicesContent";
import AddOnServicesContent from "./components/AddOnServicesContent";
import useInboundOrderReducer from "@/store/InboundOrderReducer";
import useLandingNoteReducer from "@/store/LandingNoteReducer";
import useDispatchNoteReducer from "@/store/DispatchNoteReducer";
import callFileService from "@/services/callFileService";
import salesOrderService from "@/services/salesOrderService";
import { mapSalesOrderResponse } from "@/shared/helpers/mapSalesOrderResponse";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";

// Left-nav services that jump straight to their sidebar subtab. CG Pass/
// Zawil Pass are handled via handleNavigateToTab instead. Crew Change/Port
// Pass have no real form yet, so they fall back to the Crew Management
// dashboard (see the "crewChange"/"portPass" cases below).
const GATED_SIDEBAR_TABS = {
  transport: { subTab: CREW_MANAGEMENT_SUBTABS.TRANSPORT, label: "Transport", crewField: "selectedCrew", hasServiceForm: true },
  hotel: { subTab: CREW_MANAGEMENT_SUBTABS.HOTEL, label: "Hotel", crewField: "hotelSelectedCrew", hasServiceForm: true },
  medicalService: { subTab: CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, label: "Medical", crewField: "medicalServiceSelectedCrew", hasServiceForm: true },
  crewChange: { subTab: "crewChange", label: "Crew Change", crewField: "crewChangeSelectedCrew", hasServiceForm: false },
  portPass: { subTab: "portPass", label: "Port Pass", crewField: "portPassSelectedCrew", hasServiceForm: false },
};

// Small back link shown at the top of a gated service's form (Transport /
// Hotel / Medical) — returns to the Crew Management dashboard.
const BackToCrewListingLink = ({ cardColor, onClick }) => (
  <button
    type="button"
    className="husbandry-back-link-small"
    onClick={onClick}
    style={{ "--card-color": cardColor }}
  >
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>Back to Crew Management</span>
  </button>
);

BackToCrewListingLink.propTypes = {
  cardColor: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};

// Crew Management services that open their own form directly from the
// dashboard (same set as the Crew Management left-nav).
const CREW_DIRECT_SERVICES = [
  { id: CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, label: "Zawil Pass", summary: "Zawil pass requests for crew movement." },
  { id: CREW_MANAGEMENT_SUBTABS.CG_PASS, label: "CG Pass", summary: "Coast Guard pass requests for crew." },
  { id: CREW_MANAGEMENT_SUBTABS.TRANSPORT, label: "Transport", summary: "Crew transport bookings and transfers." },
  { id: CREW_MANAGEMENT_SUBTABS.HOTEL, label: "Hotel", summary: "Crew hotel accommodation bookings." },
  { id: CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, label: "Medical", summary: "Medical appointments and crew welfare." },
  { id: CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE, label: "Launch Hire", summary: "Launch bookings for crew transfer to the vessel." },
];

// Donut colours per top-level service, keyed by the API's service title.
const SERVICE_DISTRIBUTION_COLORS = {
  "Crew Management": "#2563eb",
  "Material Management": "#0d9488",
  "Waste Disposal": "#d97706",
  "Launch Hire": "#0891b2",
  "MWP Renewal": "#7c3aed",
  "Third-Party Services": "#e11d48",
  "Add-on Services": "#059669",
};
const FALLBACK_DISTRIBUTION_COLOR = "#94a3b8";

// Service ids that only apply when the call's `launch_hire` flag is 1.
const LAUNCH_HIRE_SERVICE_IDS = ["LAUNCH_HIRE", CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE];

// Crew Management breakdown titles (from get_requests_by_service) → subtab id,
// so the breakdown bars reuse the left-nav icon colours.
const CREW_BREAKDOWN_TITLE_TO_ID = CREW_DIRECT_SERVICES.reduce((acc, service) => {
  acc[service.label] = service.id;
  return acc;
}, {});

const toCount = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Normalizes call_file/get_requests_by_service `data` into what ServiceInsights renders. */
const parseRequestsByService = (data) => {
  const services = Array.isArray(data?.services) ? data.services : [];
  const distribution = services.map((item) => ({
    name: item?.title ?? "",
    value: toCount(item?.count),
    percentage: item?.percentage,
    color: SERVICE_DISTRIBUTION_COLORS[item?.title] || FALLBACK_DISTRIBUTION_COLOR,
  }));
  const hasBreakdown = Array.isArray(data?.crew_management?.breakdown);
  const breakdownList = hasBreakdown ? data.crew_management.breakdown : [];
  const crewBreakdown = breakdownList.reduce((acc, item) => {
    const id = CREW_BREAKDOWN_TITLE_TO_ID[item?.title];
    if (id) acc[id] = toCount(item?.count);
    return acc;
  }, {});
  // Rows for the breakdown panel, in API order. null until the API returns a
  // breakdown, so the panel can fall back to the static crew service list.
  const crewBreakdownRows = hasBreakdown
    ? breakdownList
      .filter((item) => item?.title)
      .map((item) => {
        const id = CREW_BREAKDOWN_TITLE_TO_ID[item.title];
        return {
          id: id || item.title,
          label: item.title,
          value: toCount(item.count),
          color: (id && TAB_ICON_COLORS[id]) || FALLBACK_DISTRIBUTION_COLOR,
        };
      })
    : null;
  const crewBreakdownTotal = data?.crew_management?.total_requests != null
    ? toCount(data.crew_management.total_requests)
    : Object.values(crewBreakdown).reduce((sum, value) => sum + value, 0);
  const total = data?.total_requests != null
    ? toCount(data.total_requests)
    : distribution.reduce((sum, item) => sum + item.value, 0);
  return { total, distribution, crewBreakdown, crewBreakdownRows, crewBreakdownTotal };
};

/** Turns call_file/get_service_counts `services` into a { [title]: counts } lookup. */
const parseServiceCounts = (services) =>
  (Array.isArray(services) ? services : []).reduce((acc, item) => {
    if (item?.title) acc[item.title] = item.counts || {};
    return acc;
  }, {});

// History marker colour per service title: crew direct services reuse their
// left-nav icon colour, top-level services their donut colour.
const HISTORY_SERVICE_COLORS = {
  ...SERVICE_DISTRIBUTION_COLORS,
  ...CREW_DIRECT_SERVICES.reduce((acc, service) => {
    acc[service.label] = TAB_ICON_COLORS[service.id];
    return acc;
  }, {}),
};

/** "Today, 11:20 AM" / "Yesterday, 06:15 PM" / "26 Sep, 11:05 AM" (year added when not the current one). */
const formatHistoryTime = (value) => {
  if (!value) return "";
  const date = dayjs(value);
  if (!date.isValid()) return String(value);
  const now = dayjs();
  const time = date.format("hh:mm A");
  if (date.isSame(now, "day")) return `Today, ${time}`;
  if (date.isSame(now.subtract(1, "day"), "day")) return `Yesterday, ${time}`;
  return `${date.format(date.isSame(now, "year") ? "D MMM" : "D MMM YYYY")}, ${time}`;
};

/** Normalizes call_file/get_service_history `data` into Recent History rows. */
const parseServiceHistory = (data) => {
  const history = Array.isArray(data?.history) ? data.history : [];
  const entries = history.map((item, index) => ({
    id: `${item?.service ?? "service"}-${item?.request_id ?? "na"}-${item?.activity_date ?? ""}-${index}`,
    service: item?.service ?? "—",
    action: item?.description ?? "",
    user: item?.user_name || item?.user_role || "",
    time: formatHistoryTime(item?.activity_date || item?.created_date),
    statusGroup: item?.status_group || "Pending",
    status: item?.status || item?.status_group || "",
    color: HISTORY_SERVICE_COLORS[item?.service] || FALLBACK_DISTRIBUTION_COLOR,
  }));
  const total = data?.total_updates != null ? toCount(data.total_updates) : entries.length;
  return { entries, total };
};

const HISTORY_STATUS_CLASS = {
  "Pending": "is-pending",
  "In Progress": "is-progress",
  "Completed": "is-completed",
  "Cancelled": "is-cancelled",
};

const toAmount = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatAmount = (value, currency) => {
  const formatted = (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${formatted}` : formatted;
};

// Sales Order totals for this call, shown under the Crew Management breakdown.
const SalesOrderPricing = ({ salesOrder }) => {
  const itemCount = salesOrder?.salesOrderList?.length || 0;
  const currency = salesOrder?.soBpCurrency || "";
  const subtotal = toAmount(salesOrder?.soSubtotal) ?? salesOrder?.lineItemTotal ?? 0;
  const rows = [
    { label: "Subtotal", value: subtotal },
    { label: "Discount", value: toAmount(salesOrder?.soTotalDiscount) ?? 0, isNegative: true },
    { label: "Tax", value: toAmount(salesOrder?.soTotalTax) ?? 0 },
  ];
  const grandTotal = toAmount(salesOrder?.soGrandTotal) ?? rows[0].value - rows[1].value + rows[2].value;

  return (
    <div className="husbandry-dashboard-breakdown husbandry-dashboard-pricing">
      <div className="husbandry-dashboard-breakdown-header">
        <span className="husbandry-dashboard-breakdown-title">Sales Order Pricing</span>
        <span className="husbandry-dashboard-panel-meta">
          {salesOrder?.soSoNo ? `SO ${salesOrder.soSoNo} · ` : ""}{itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
      {itemCount === 0 ? (
        <p className="husbandry-dashboard-pricing-empty">No sales order items for this call yet.</p>
      ) : (
        <dl className="husbandry-dashboard-pricing-list">
          {rows.map((row) => (
            <div key={row.label} className="husbandry-dashboard-pricing-row">
              <dt>{row.label}</dt>
              <dd>{row.isNegative && row.value > 0 ? "− " : ""}{formatAmount(row.value, currency)}</dd>
            </div>
          ))}
          <div className="husbandry-dashboard-pricing-row is-total">
            <dt>Grand Total</dt>
            <dd>{formatAmount(grandTotal, currency)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
};

SalesOrderPricing.propTypes = {
  salesOrder: PropTypes.object,
};

// Dashboard columns 2 & 3: request distribution donut + recent activity history.
const ServiceInsights = ({ salesOrder, requestsByService, serviceHistory, showLaunchHire = true }) => {
  const parsed = parseRequestsByService(requestsByService);
  const { total, crewBreakdown, crewBreakdownRows, crewBreakdownTotal } = parsed;
  const distribution = showLaunchHire
    ? parsed.distribution
    : parsed.distribution.filter((item) => item.name !== "Launch Hire");
  // API rows when available, otherwise the static crew service list.
  const allCrewBreakdownRows = crewBreakdownRows ?? CREW_DIRECT_SERVICES.map((service) => ({
    id: service.id,
    label: service.label,
    value: crewBreakdown[service.id] || 0,
    color: TAB_ICON_COLORS[service.id],
  }));
  const crewBreakdownServices = showLaunchHire
    ? allCrewBreakdownRows
    : allCrewBreakdownRows.filter((row) => !LAUNCH_HIRE_SERVICE_IDS.includes(row.id));
  const { entries: historyEntries, total: historyTotal } = parseServiceHistory(serviceHistory);
  // Zero-count slices are dropped from the donut (they'd render as gaps) but
  // stay in the legend.
  const chartData = distribution.filter((item) => item.value > 0);
  const crewBreakdownMax = Math.max(0, ...crewBreakdownServices.map((row) => row.value));

  return (
    <>
      <section className="husbandry-dashboard-panel">
        <header className="husbandry-dashboard-panel-header">
          <h3 className="husbandry-dashboard-panel-title">Requests by Service</h3>
        </header>
        <div className="husbandry-dashboard-chart">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              {chartData.length > 0 ? (
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={chartData.length > 1 ? 2 : 0}
                  stroke="none"
                >
                  {chartData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              ) : (
                <Pie
                  data={[{ name: "No requests", value: 1 }]}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={88}
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill="#e2e8f0" />
                </Pie>
              )}
              {chartData.length > 0 && <Tooltip formatter={(value, name) => [value, name]} />}
            </PieChart>
          </ResponsiveContainer>
          <div className="husbandry-dashboard-chart-center">
            <span className="husbandry-dashboard-chart-total">{total}</span>
            <span className="husbandry-dashboard-chart-label">Total</span>
          </div>
        </div>
        <ul className="husbandry-dashboard-legend">
          {distribution.map((item) => {
            const pct = item.percentage != null
              ? toCount(item.percentage)
              : total ? Math.round((item.value / total) * 100) : 0;
            return (
              <li key={item.name} className="husbandry-dashboard-legend-item">
                <span className="husbandry-dashboard-legend-dot" style={{ background: item.color }} />
                <span className="husbandry-dashboard-legend-name">{item.name}</span>
                <span className="husbandry-dashboard-legend-value">{item.value}</span>
                <span className="husbandry-dashboard-legend-pct">{pct}%</span>
              </li>
            );
          })}
        </ul>

        <div className="husbandry-dashboard-breakdown">
          <div className="husbandry-dashboard-breakdown-header">
            <span className="husbandry-dashboard-breakdown-title">Crew Management breakdown</span>
            <span className="husbandry-dashboard-panel-meta">{crewBreakdownTotal} requests</span>
          </div>
          <ul className="husbandry-dashboard-breakdown-list">
            {crewBreakdownServices.map((service) => {
              const { value } = service;
              return (
                <li
                  key={service.id}
                  className="husbandry-dashboard-breakdown-item"
                  style={{ "--breakdown-color": service.color }}
                >
                  <span className="husbandry-dashboard-breakdown-name">{service.label}</span>
                  <span className="husbandry-dashboard-breakdown-track">
                    <span
                      className="husbandry-dashboard-breakdown-fill"
                      style={{ width: `${crewBreakdownMax ? (value / crewBreakdownMax) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="husbandry-dashboard-breakdown-value">{value}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <SalesOrderPricing salesOrder={salesOrder} />
      </section>

      <section className="husbandry-dashboard-panel">
        <header className="husbandry-dashboard-panel-header">
          <h3 className="husbandry-dashboard-panel-title">Recent History</h3>
          <span className="husbandry-dashboard-panel-meta">
            {historyTotal} {historyTotal === 1 ? "update" : "updates"}
          </span>
        </header>
        {historyEntries.length === 0 ? (
          <p className="husbandry-dashboard-pricing-empty">No service activity for this call yet.</p>
        ) : (
          <ol className="husbandry-dashboard-history">
            {historyEntries.map((entry) => (
              <li key={entry.id} className="husbandry-dashboard-history-item" style={{ "--history-accent": entry.color }}>
                <span className="husbandry-dashboard-history-marker" />
                <div className="husbandry-dashboard-history-body">
                  <div className="husbandry-dashboard-history-top">
                    <span className="husbandry-dashboard-history-service">{entry.service}</span>
                    <span
                      className={`husbandry-dashboard-history-status ${HISTORY_STATUS_CLASS[entry.statusGroup] || "is-pending"}`}
                      title={entry.status}
                    >
                      {entry.statusGroup}
                    </span>
                  </div>
                  {entry.action && <p className="husbandry-dashboard-history-action">{entry.action}</p>}
                  <span className="husbandry-dashboard-history-meta">
                    {[entry.user, entry.time].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
};

ServiceInsights.propTypes = {
  salesOrder: PropTypes.object,
  requestsByService: PropTypes.object,
  serviceHistory: PropTypes.object,
  showLaunchHire: PropTypes.bool,
};

// Service Selection Component
export const ServiceSelection = ({ onSelectService, cardColor, bookedServices = [], servicesSummary, crewServiceCounts = {}, serviceCounts = null, requestsByService = null, serviceHistory = null, showLaunchHire = true, hiddenServiceIds = [], salesOrder = null, callId = null, crewCoordinators = [], onCrewCoordinatorsChange, assignedCrewCoordinators = null }) => {
  const categories = servicesSummary?.categories || {};
  const num = toCount;
  // call_file/get_service_counts, keyed by service title. A card whose title
  // the API hasn't returned (or before it loads) falls back to the older
  // summary / per-service counts.
  const countsFor = (title) => serviceCounts?.[title];

  // Badges for a "requests + today" service, from get_service_counts.
  const requestBadges = (counts) => [
    `Requests: ${num(counts.requests)}`,
    ...(counts.today_requests != null ? [`Today: ${num(counts.today_requests)}`] : []),
  ];

  // Badges for a crew direct service card.
  const crewServiceBadges = (service) => {
    // "Launch Hire" is also a top-level service title in get_service_counts,
    // so the crew card takes its count from the crew breakdown instead.
    if (service.id === CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE) {
      const crewItem = requestsByService?.crew_management?.breakdown?.find?.((item) => item?.title === service.label);
      if (crewItem) return [`Requests: ${num(crewItem.count)}`];
    }
    const counts = countsFor(service.label);
    if (!counts) return [`Requests: ${num(crewServiceCounts[service.id])}`];
    if (counts.issued != null) {
      return [`Requests: ${num(counts.requests)}`, `Issued: ${num(counts.issued)}`];
    }
    return requestBadges(counts);
  };

  // Badges for a top-level "requests" service, with its old summary fallback.
  const simpleServiceBadges = (title, fallbackTotal) => {
    const counts = countsFor(title);
    return counts ? requestBadges(counts) : [`Requests: ${num(fallbackTotal)}`];
  };

  const crewCounts = countsFor("Crew Management");
  const materialCounts = countsFor("Material Management");

  const allServices = [
    {
      id: MAIN_TABS.CREW_MANAGEMENT,
      label: "Crew Management",
      icon: "crew",
      accent: "#2563eb",
      summary: "Crew transport, hotel, medical and launch hire support.",
      footerBadges: crewCounts
        ? [
          `Total Crew: ${num(crewCounts.total_crew)}`,
          `Sign In: ${num(crewCounts.sign_in)}`,
          `Sign Off: ${num(crewCounts.sign_off)}`,
          `Today: ${num(crewCounts.today_crew)}`,
        ]
        : [
          `Sign In: ${num(categories.crew_change?.sign_on)}`,
          `Sign Off: ${num(categories.crew_change?.sign_off)}`,
        ],
      bookedSummary: "Coordinate crew movement, accommodation and welfare services.",
    },
    ...CREW_DIRECT_SERVICES.map((service) => ({
      ...service,
      parentId: MAIN_TABS.CREW_MANAGEMENT,
      iconPath: TAB_ICON_PATHS[service.id],
      accent: TAB_ICON_COLORS[service.id],
      footerBadges: crewServiceBadges(service),
    })),
    {
      id: MAIN_TABS.MATERIAL_MANAGEMENT,
      label: "Material Management",
      icon: "box",
      accent: "#0d9488",
      summary: "Inbound orders, landing note and dispatch note handling.",
      footerBadges: materialCounts
        ? [
          `Inbound: ${num(materialCounts.inbound)}`,
          `Dispatch: ${num(materialCounts.dispatch)}`,
          `Today In: ${num(materialCounts.today_inbound)}`,
          `Today Out: ${num(materialCounts.today_dispatch)}`,
        ]
        : [
          `Inbound: ${num(categories.material_management?.inbound)}`,
          `Dispatch: ${num(categories.material_management?.dispatch)}`,
        ],
      bookedSummary: "Track vessel material flow from intake to final dispatch.",
    },
    {
      id: MAIN_TABS.WASTE_DISPOSAL,
      label: "Waste Disposal",
      icon: "trash",
      accent: "#d97706",
      summary: "Waste request initiation and disposal progress tracking.",
      footerBadges: simpleServiceBadges("Waste Disposal", categories.waste_disposal?.total),
      bookedSummary: "Ensure regulated pickup and transparent disposal follow-up.",
    },
    {
      id: "LAUNCH_HIRE",
      label: "Launch Hire",
      icon: "boat",
      accent: "#0891b2",
      summary: "Launch booking, transfer coordination and movement support.",
      footerBadges: simpleServiceBadges("Launch Hire", categories.launch_hire?.total),
      bookedSummary: "Arrange transfer windows with optimized launch availability.",
    },
    {
      id: MAIN_TABS.MWP_RENEWAL,
      label: "MWP Renewal",
      icon: "renewal",
      accent: "#7c3aed",
      summary: "Monitor MWP renewal requests and expected completion updates.",
      footerBadges: simpleServiceBadges("MWP Renewal", categories.mwp_renewal?.total),
      bookedSummary: "Keep permits current with proactive renewal processing.",
    },
    {
      id: MAIN_TABS.THIRD_PARTY_SERVICES,
      label: "Third-Party Services",
      icon: "vendor",
      accent: "#e11d48",
      summary: "Raise and monitor external vendor service requests.",
      footerBadges: simpleServiceBadges("Third-Party Services", categories.third_party_service?.total),
      bookedSummary: "Manage third-party support under a single service view.",
    },
    {
      id: MAIN_TABS.ADD_ON_SERVICES,
      label: "Add-on Services",
      icon: "addon",
      accent: "#059669",
      summary: "Raise and monitor optional add-on service requests.",
      footerBadges: countsFor("Add-on Services") ? requestBadges(countsFor("Add-on Services")) : undefined,
      bookedSummary: "Track add-on support requests under a single service view.",
    },
  ];

  // Once get_requests_by_service has loaded, it decides which cards this call
  // offers: top-level cards come from `services[]`, Crew Management
  // sub-service cards from `crew_management.breakdown[]`. Until then (or if
  // the API omits a list) get_service_counts is used as before — except for
  // Launch Hire (both cards), which shows only when get_requests_by_service lists it.
  const titleSet = (list) => (Array.isArray(list) ? new Set(list.map((item) => item?.title).filter(Boolean)) : null);
  const apiTopLevelTitles = titleSet(requestsByService?.services);
  const apiCrewTitles = titleSet(requestsByService?.crew_management?.breakdown);
  const isOfferedByApi = (service) => {
    const isCrewSub = service.parentId === MAIN_TABS.CREW_MANAGEMENT;
    if (isCrewSub && apiTopLevelTitles && !apiTopLevelTitles.has("Crew Management")) return false;
    const titles = isCrewSub ? apiCrewTitles : apiTopLevelTitles;
    if (titles) return titles.has(service.label);
    if (LAUNCH_HIRE_SERVICE_IDS.includes(service.id)) return false;
    return !serviceCounts || Object.prototype.hasOwnProperty.call(serviceCounts, service.label);
  };

  // The call's launch_hire flag is deliberately not used here: which cards show
  // (Launch Hire included) is decided only by get_requests_by_service.
  const offeredServices = allServices
    .filter((service) => !hiddenServiceIds.includes(service.id) && !hiddenServiceIds.includes(service.parentId))
    .filter(isOfferedByApi);
  // Both Launch Hire cards are the same service: show it once. The Crew Management
  // card wins when both are offered; the top-level card shows only on its own.
  const hasCrewLaunchHire = offeredServices.some((service) => service.id === CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE);
  const services = hasCrewLaunchHire
    ? offeredServices.filter((service) => service.id !== "LAUNCH_HIRE")
    : offeredServices;

  const bookedServicesMap = bookedServices.reduce((acc, booked) => {
    acc[booked.id] = booked;
    return acc;
  }, {});

  const getServiceIcon = (iconType) => {
    switch (iconType) {
      case "crew":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="16" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M10 40C10 32.268 16.268 26 24 26C31.732 26 38 32.268 38 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "box":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 16L24 8L40 16V34L24 42L8 34V16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
            <path d="M24 8V42M8 16L24 24L40 16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        );
      case "trash":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 14H34M18 14V12C18 10.8954 18.8954 10 20 10H28C29.1046 10 30 10.8954 30 12V14M20 22V34M28 22V34M16 14L18 38H30L32 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "boat":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 30H38L34 38H14L10 30Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
            <path d="M24 10V30M20 14L24 10L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 30C12 26 16 24 24 24C32 24 36 26 40 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "renewal":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M28 16L32 12L28 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 32L16 36L20 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M32 12C30 16 28 20 28 24C28 28 30 32 32 36M16 12C18 16 20 20 20 24C20 28 18 32 16 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "vendor":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="18" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M16 18V14C16 11.7909 17.7909 10 20 10H28C30.2091 10 32 11.7909 32 14V18" stroke="currentColor" strokeWidth="2" />
            <path d="M10 26H38M20 26V32M28 26V32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "addon":
        return (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
            <path d="M24 18V30M18 24H30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="husbandry-service-selection" style={{ "--card-color": cardColor }}>
      <div className="husbandry-service-selection-content">
        <div className="husbandry-dashboard-layout">
        <section className="husbandry-dashboard-panel husbandry-dashboard-services">
        <header className="husbandry-dashboard-services-header">
          <h3 className="husbandry-dashboard-panel-title">What services do you need?</h3>
          <p className="husbandry-dashboard-services-subtitle">
            Select a service to initiate requests and monitor progress.
          </p>
        </header>
        {onCrewCoordinatorsChange && (
          <CrewCoordinatorsSelect
            callId={callId}
            value={crewCoordinators}
            onChange={onCrewCoordinatorsChange}
            assigned={assignedCrewCoordinators}
          />
        )}
        <div className="husbandry-service-options">
          {services.map((service, index) => {
            const bookedEntry = bookedServicesMap[service.id];
            const isBooked = Boolean(bookedEntry);

            return (
              <button
                key={service.id}
                type="button"
                className={`husbandry-service-option ${isBooked ? "booked" : ""}`}
                onClick={() => onSelectService(service.id)}
                style={{
                  "--card-color": cardColor,
                  "--service-accent": service.accent || cardColor,
                  "--stagger-index": index,
                }}
              >
                <div className="husbandry-service-option-icon">
                  {service.iconPath ? (
                    <svg width="48" height="48" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d={service.iconPath} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    getServiceIcon(service.icon)
                  )}
                </div>
                <div className="husbandry-service-option-content">
                  <span className="husbandry-service-option-label">{service.label}</span>
                  <p className="husbandry-service-option-summary">{service.summary}</p>
                </div>
                {service.footerBadges?.length > 0 && (
                  <div className="husbandry-service-option-footer">
                    {service.footerBadges.map((badge) => (
                      <span key={badge} className="husbandry-service-option-meta">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        </section>
        <ServiceInsights salesOrder={salesOrder} requestsByService={requestsByService} serviceHistory={serviceHistory} showLaunchHire={showLaunchHire} />
        </div>
      </div>
    </div>
  );
};

ServiceSelection.propTypes = {
  onSelectService: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  bookedServices: PropTypes.array,
  servicesSummary: PropTypes.object,
  crewServiceCounts: PropTypes.object,
  serviceCounts: PropTypes.object,
  requestsByService: PropTypes.object,
  serviceHistory: PropTypes.object,
  showLaunchHire: PropTypes.bool,
  hiddenServiceIds: PropTypes.arrayOf(PropTypes.string),
  salesOrder: PropTypes.object,
  callId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  crewCoordinators: PropTypes.array,
  onCrewCoordinatorsChange: PropTypes.func,
  assignedCrewCoordinators: PropTypes.array,
};

// Dummy crew data for DA module Husbandry tab
const DAMODULE_CREW_DUMMY = [
  { crewName: "Ahmed Al-Rashid", nationality: "Saudi Arabia", rank: "Chief Officer", passportNo: "A12345678", iqamaNo: "IQ-987654", visaNo: "V-2024-001", service: "Transport" },
  { crewName: "John Smith", nationality: "United Kingdom", rank: "Master", passportNo: "UK4521987", iqamaNo: "IQ-112233", visaNo: "V-2024-002", service: "Launch Hire" },
  { crewName: "Maria Santos", nationality: "Philippines", rank: "Chief Cook", passportNo: "PH7890123", iqamaNo: "IQ-445566", visaNo: "V-2024-003", service: "Hotel" },
  { crewName: "Viktor Petrov", nationality: "Ukraine", rank: "Chief Engineer", passportNo: "UA3456789", iqamaNo: "IQ-778899", visaNo: "V-2024-004", service: "CG Pass" },
  { crewName: "Raj Kumar", nationality: "India", rank: "AB Seaman", passportNo: "IN5678901", iqamaNo: "IQ-223344", visaNo: "V-2024-005", service: "Waste Disposal" },
  { crewName: "Elena Kowalski", nationality: "Poland", rank: "2nd Officer", passportNo: "PL2345678", iqamaNo: "IQ-556677", visaNo: "V-2024-006", service: "Inbound Orders" },
  { crewName: "Carlos Mendez", nationality: "Mexico", rank: "Chief Steward", passportNo: "MX8765432", iqamaNo: "IQ-998877", visaNo: "V-2024-007", service: "Medical Service" },
  { crewName: "Yuki Tanaka", nationality: "Japan", rank: "3rd Engineer", passportNo: "JP1122334", iqamaNo: "IQ-334455", visaNo: "V-2024-008", service: "Zawil Pass" },
  { crewName: "Fatima Hassan", nationality: "Egypt", rank: "AB Seaman", passportNo: "EG5678901", iqamaNo: "IQ-667788", visaNo: "V-2024-009", service: "On Station" },
  { crewName: "James O'Brien", nationality: "Ireland", rank: "Chief Officer", passportNo: "IE9900112", iqamaNo: "IQ-221133", visaNo: "V-2024-010", service: "MWP Renewal" },
];

// Main Husbandry Component
function Husbandry({
  card,
  formValues,
  handleChange,
  isDAModule = false,
  showLaunchHire = true,
  crewCoordinators: crewCoordinatorsProp,
  onCrewCoordinatorsChange: onCrewCoordinatorsChangeProp,
}) {
  const { hasPermission, hasSubmodule } = usePermissions();
  // Crew Coordinators (API-backed in CrewCoordinatorsSelect). CardForm owns this state so it survives tab switches;
  // fall back to local state when Husbandry is rendered without it.
  const [localCrewCoordinators, setLocalCrewCoordinators] = useState([]);
  const crewCoordinators = onCrewCoordinatorsChangeProp ? (crewCoordinatorsProp ?? []) : localCrewCoordinators;
  const onCrewCoordinatorsChange = onCrewCoordinatorsChangeProp ?? setLocalCrewCoordinators;
  // KANBAN_CARD > CREW_MANAGEMENT / MATERIAL_MANAGEMENT carry no VIEW action
  // of their own — submodule presence is the gate for their Husbandry main tab.
  const canViewCrewManagementTab = hasSubmodule(
    PERMISSION_MODULES.KANBAN_CARD,
    PERMISSION_SUBMODULES.CREW_MANAGEMENT
  );
  const canViewMaterialManagementTab = hasSubmodule(
    PERMISSION_MODULES.KANBAN_CARD,
    PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT
  );
  const hiddenHusbandryMainTabIds = [
    !canViewCrewManagementTab && MAIN_TABS.CREW_MANAGEMENT,
    !canViewMaterialManagementTab && MAIN_TABS.MATERIAL_MANAGEMENT,
  ].filter(Boolean);
  // KANBAN_CARD > MATERIAL_MANAGEMENT per-subtab VIEW gates — absence of the
  // module/submodule/action in the permissions response means false (deny by
  // default).
  const canViewInboundOrders = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.VIEW_INBOUND_ORDER,
  });
  const canViewLandingNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.VIEW_LANDING_NOTE,
  });
  const canViewDispatchNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.VIEW_DISPATCH_NOTE,
  });
  const canViewOrderHistory = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.VIEW_ORDER_HISTORY,
  });
  const materialManagementVisibleSubTabIds = [
    canViewInboundOrders && MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS,
    canViewLandingNote && MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE,
    canViewDispatchNote && MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE,
    canViewOrderHistory && MATERIAL_MANAGEMENT_SUBTABS.ORDER_HISTORY,
  ].filter(Boolean);

  const [serviceSelected, setServiceSelected] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); // Array to track selected services
  const [activeMainTab, setActiveMainTab] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(
    CREW_MANAGEMENT_SUBTABS.CREW
  );
  const [selectedActionTab, setSelectedActionTab] = useState(null);
  const [isLaunchHireMode, setIsLaunchHireMode] = useState(false);
  // True when a crew service (Transport, Hotel, ...) was opened straight from
  // the service overview rather than from the Crew Management dashboard —
  // its form then uploads a crew list instead of selecting existing crew.
  const [crewServiceFromOverview, setCrewServiceFromOverview] = useState(false);
  // Initialize with dummy booked services for view-only mode (only for DA routes)
  const [bookedServices, setBookedServices] = useState(isDAModule ? [
    { id: MAIN_TABS.CREW_MANAGEMENT, status: "In Progress", subService: "Transport" },
    { id: MAIN_TABS.ON_STATION, status: "Pending", subService: null },
    { id: MAIN_TABS.MATERIAL_MANAGEMENT, status: "Completed", subService: "Inbound Orders" },
    { id: MAIN_TABS.WASTE_DISPOSAL, status: "Pending", subService: null },
    { id: "LAUNCH_HIRE", status: "In Progress", subService: null },
  ] : []);
  const cardColor = "#00368c"; // Fixed color for all buttons, effects, and backgrounds
  const [salesOrder, setSalesOrder] = useState(null);
  const [serviceCounts, setServiceCounts] = useState(null);
  // Call's assigned crew coordinators from get_service_counts (null while loading).
  const [assignedCrewCoordinators, setAssignedCrewCoordinators] = useState(null);
  const [requestsByService, setRequestsByService] = useState(null);
  const [serviceHistory, setServiceHistory] = useState(null);

  // Booking counts reported by each service tab from its own API fetch —
  // reflects actual saved requests, not just the crew picked in the pending form.
  const [requestCounts, setRequestCounts] = useState({
    [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: null,
    [CREW_MANAGEMENT_SUBTABS.HOTEL]: null,
    [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: null,
    [CREW_MANAGEMENT_SUBTABS.CG_PASS]: null,
    [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: null,
    [CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE]: null,
  });

  const setRequestCount = useCallback((subTab, count) => {
    setRequestCounts((prev) => (prev[subTab] === count ? prev : { ...prev, [subTab]: count }));
  }, []);
  const handleTransportRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.TRANSPORT, count), [setRequestCount]);
  const handleHotelRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.HOTEL, count), [setRequestCount]);
  const handleMedicalRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, count), [setRequestCount]);
  const handleCgPassRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.CG_PASS, count), [setRequestCount]);
  const handleZawilPassRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, count), [setRequestCount]);
  const handleLaunchHireRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE, count), [setRequestCount]);

  const inboundOrdersCount = useInboundOrderReducer((state) => state.inboundOrdersCount);
  const getInboundOrdersTotal = useInboundOrderReducer((state) => state.getInboundOrdersTotal);
  const landingNotesCount = useLandingNoteReducer((state) => state.landingNotesCount);
  const getLandingNotesTotal = useLandingNoteReducer((state) => state.getLandingNotesTotal);
  const dispatchNotesCount = useDispatchNoteReducer((state) => state.dispatchNotesCount);
  const getDispatchNotesTotal = useDispatchNoteReducer((state) => state.getDispatchNotesTotal);

  useEffect(() => {
    const isMaterialManagement = activeMainTab === MAIN_TABS.MATERIAL_MANAGEMENT;
    const isLaunchHire = activeMainTab === "LAUNCH_HIRE";
    if (!isMaterialManagement && !isLaunchHire) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getInboundOrdersTotal({ call_id: callId });
    if (isMaterialManagement) {
      getLandingNotesTotal({ call_id: callId });
      getDispatchNotesTotal({ call_id: callId });
    }
  }, [
    activeMainTab,
    activeSubTab,
    formValues?.call_id,
    formValues?.callId,
    formValues?.card_call_id,
    getInboundOrdersTotal,
    getLandingNotesTotal,
    getDispatchNotesTotal,
  ]);

  // Per-service request counts (Transport/Hotel/Medical/CG Pass/Zawil Pass/
  // Launch Hire) come from get_service_counts below — no separate per-service
  // fetches on mount. Each service's Content component still reports its live
  // count via the handle*RequestCount callbacks once opened.
  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (isDAModule || !callId) {
      setAssignedCrewCoordinators([]);
      return undefined;
    }

    let cancelled = false;
    setAssignedCrewCoordinators(null);

    salesOrderService
      .getSoItemsByCall(callId, "Husbandry")
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status === "success" && body?.data) {
          setSalesOrder(mapSalesOrderResponse(body.data));
        }
      })
      .catch(() => {
        // Non-critical: pricing panel shows its empty state.
      });

    callFileService
      .getServiceCounts(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        const services = body?.data?.services ?? body?.services;
        if (Array.isArray(services)) {
          setServiceCounts(parseServiceCounts(services));
        }
        const coordinators = body?.data?.crew_coordinators ?? body?.crew_coordinators;
        setAssignedCrewCoordinators(Array.isArray(coordinators) ? coordinators : []);
      })
      .catch(() => {
        // Non-critical: service cards fall back to the summary counts.
        if (!cancelled) setAssignedCrewCoordinators([]);
      });

    callFileService
      .getRequestsByService(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status === "success" && body?.data) {
          setRequestsByService(body.data);
        }
      })
      .catch(() => {
        // Non-critical: chart shows its empty state.
      });

    callFileService
      .getServiceHistory(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status === "success" && body?.data) {
          setServiceHistory(body.data);
        }
      })
      .catch(() => {
        // Non-critical: Recent History shows its empty state.
      });

    return () => {
      cancelled = true;
    };
  }, [isDAModule, formValues?.call_id, formValues?.callId, formValues?.card_call_id]);

  // KANBAN_CARD > MATERIAL_MANAGEMENT sub-tab permissions removed the active
  // sub-tab — fall back to the first sub-tab the user still has permission
  // for (or null if none are permitted).
  useEffect(() => {
    if (activeMainTab !== MAIN_TABS.MATERIAL_MANAGEMENT) return;
    if (activeSubTab && materialManagementVisibleSubTabIds.includes(activeSubTab)) return;
    setActiveSubTab(materialManagementVisibleSubTabIds[0] ?? null);
  }, [activeMainTab, activeSubTab, materialManagementVisibleSubTabIds]);

  const handleServiceSelect = useCallback((tab) => {
    const crewDirectService = CREW_DIRECT_SERVICES.find((service) => service.id === tab);
    const bookedId = crewDirectService ? MAIN_TABS.CREW_MANAGEMENT : tab;

    setServiceSelected(true);
    setSelectedActionTab(null); // Reset selected action

    // Add or update booked service
    setBookedServices(prev => {
      const existing = prev.find(bs => bs.id === bookedId);
      if (existing) {
        // Service already booked, update it
        return prev.map(bs => bs.id === bookedId
          ? { ...bs, status: bs.status || "Pending", subService: crewDirectService?.label ?? bs.subService }
          : bs);
      } else {
        // New service booking
        const newService = {
          id: bookedId,
          status: "Pending",
          subService: crewDirectService?.label ?? null,
        };
        return [...prev, newService];
      }
    });

    // Crew Management sub-service (Zawil Pass, CG Pass, Transport, Hotel,
    // Medical) — open Crew Management directly on that service's form.
    if (crewDirectService) {
      setCrewServiceFromOverview(true);
      setIsLaunchHireMode(false);
      setSelectedServices([MAIN_TABS.CREW_MANAGEMENT]);
      setActiveMainTab(MAIN_TABS.CREW_MANAGEMENT);
      setActiveSubTab(tab);
      setSelectedActionTab(tab);
      return;
    }

    // Handle "LAUNCH_HIRE" selection - render the Launch Hire booking form directly
    if (tab === "LAUNCH_HIRE") {
      setIsLaunchHireMode(false);
      setSelectedServices(["LAUNCH_HIRE"]);
      setActiveMainTab("LAUNCH_HIRE");
      setActiveSubTab(LAUNCH_HIRE_SUBTABS.REQUESTS);
    } else {
      // Single service selection
      setIsLaunchHireMode(false);
      setSelectedServices([tab]);
      setActiveMainTab(tab);
      // Reset to default sub-tab when service is selected
      if (tab === MAIN_TABS.CREW_MANAGEMENT) {
        setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
      } else if (tab === MAIN_TABS.MATERIAL_MANAGEMENT) {
        setActiveSubTab(MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS);
      } else if (tab === MAIN_TABS.WASTE_DISPOSAL) {
        // Waste Disposal - no subtabs, direct to content
        setActiveSubTab(null);
      } else if (tab === MAIN_TABS.ON_STATION) {
        // On station - placeholder for future implementation
        setActiveSubTab(null);
      } else if (tab === MAIN_TABS.MWP_RENEWAL) {
        // MWP Renewal - placeholder for future implementation
        setActiveSubTab(null);
      } else if (tab === MAIN_TABS.THIRD_PARTY_SERVICES) {
        // Third-Party Services - placeholder for future implementation
        setActiveSubTab(null);
      } else if (tab === MAIN_TABS.ADD_ON_SERVICES) {
        // Add-on Services - no subtabs
        setActiveSubTab(null);
      }
    }
  }, []);

  const handleMainTabChange = useCallback((tab) => {
    setActiveMainTab(tab);
    setSelectedActionTab(null); // Reset selected action when switching main tabs
    // Reset to default sub-tab when main tab changes
    if (tab === MAIN_TABS.CREW_MANAGEMENT) {
      setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
    } else if (tab === MAIN_TABS.MATERIAL_MANAGEMENT) {
      setActiveSubTab(MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS);
    } else if (tab === "LAUNCH_HIRE") {
      setActiveSubTab(LAUNCH_HIRE_SUBTABS.REQUESTS);
    } else if (tab === MAIN_TABS.ON_STATION ||
      tab === MAIN_TABS.WASTE_DISPOSAL) {
      // These services have no subtabs
      setActiveSubTab(null);
    }
  }, []);

  const handleSubTabChange = useCallback((tab) => {
    setActiveSubTab(tab);
    // Track selected action tab when user manually clicks on a submenu item
    if (tab === CREW_MANAGEMENT_SUBTABS.CREW) {
      // Reset to show only Crew when Crew is clicked
      setSelectedActionTab(null);
    } else {
      // Show only the selected action tab
      setSelectedActionTab(tab);

      // Update booked service with sub-service info
      if (activeMainTab) {
        setBookedServices(prev => {
          const service = prev.find(bs => bs.id === activeMainTab);
          if (service) {
            const subServiceLabels = {
              [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: "Transport",
              [CREW_MANAGEMENT_SUBTABS.CG_PASS]: "CG Pass",
              [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: "Zawil Pass",
              [CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE]: "Launch Hire",
              [CREW_MANAGEMENT_SUBTABS.HOTEL]: "Hotel",
              [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: "Medical Service",
              [MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS]: "Inbound Orders",
              [MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE]: "Landing Note",
              [MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE]: "Dispatch Note",
              [MATERIAL_MANAGEMENT_SUBTABS.ORDER_HISTORY]: "Order History",
              [LAUNCH_HIRE_SUBTABS.REQUESTS]: "Requests",
              [LAUNCH_HIRE_SUBTABS.INBOUND_ORDERS]: "Inbound Orders",
            };

            return prev.map(bs =>
              bs.id === activeMainTab
                ? { ...bs, subService: subServiceLabels[tab] || null }
                : bs
            );
          }
          return prev;
        });
      }
    }
  }, [activeMainTab]);

  const handleGoToCrewTab = useCallback(() => {
    setCrewServiceFromOverview(false);
    handleSubTabChange(CREW_MANAGEMENT_SUBTABS.CREW);
  }, [handleSubTabChange]);

  // Handle navigation from CrewContent when crew is selected and action is chosen
  const handleNavigateToTab = useCallback((tabName) => {
    setCrewServiceFromOverview(false);
    // Ensure we're on the Crew Management main tab
    if (activeMainTab !== MAIN_TABS.CREW_MANAGEMENT) {
      setActiveMainTab(MAIN_TABS.CREW_MANAGEMENT);
    }

    // Map tab names to subtab constants - tabName matches the constant values
    const tabMap = {
      transport: CREW_MANAGEMENT_SUBTABS.TRANSPORT,
      cgPass: CREW_MANAGEMENT_SUBTABS.CG_PASS,
      zawilPass: CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS,
      launchHire: CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE,
      hotel: CREW_MANAGEMENT_SUBTABS.HOTEL,
      medicalService: CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE,
    };

    const targetTab = tabMap[tabName];
    if (targetTab) {
      setActiveSubTab(targetTab);
      // Set the selected action tab to show only this submenu item
      setSelectedActionTab(targetTab);

      // Update booked service with sub-service info
      setBookedServices(prev => {
        const service = prev.find(bs => bs.id === MAIN_TABS.CREW_MANAGEMENT);
        if (service) {
          const subServiceLabels = {
            [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: "Transport",
            [CREW_MANAGEMENT_SUBTABS.CG_PASS]: "CG Pass",
            [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: "Zawil Pass",
            [CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE]: "Launch Hire",
            [CREW_MANAGEMENT_SUBTABS.HOTEL]: "Hotel",
            [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: "Medical Service",
          };

          return prev.map(bs =>
            bs.id === MAIN_TABS.CREW_MANAGEMENT
              ? { ...bs, subService: subServiceLabels[targetTab] || null }
              : bs
          );
        }
        return prev;
      });
    }
  }, [activeMainTab]);

  // Sidebar-initiated navigation for services in GATED_SIDEBAR_TABS — jumps
  // straight to the subtab's form. CG Pass/Zawil Pass go through
  // handleNavigateToTab instead.
  const handleSidebarSubTabNavigate = useCallback((tabName) => {
    const gated = GATED_SIDEBAR_TABS[tabName];
    if (gated) {
      setActiveMainTab(MAIN_TABS.CREW_MANAGEMENT);
      setActiveSubTab(gated.subTab);
      setSelectedActionTab(gated.subTab);
      return;
    }
    handleNavigateToTab(tabName);
  }, [handleNavigateToTab]);

  // Mark the Launch Hire booked service as Completed once its booking form is saved
  const handleLaunchHireSaved = useCallback(() => {
    setBookedServices((prev) => {
      const targetId = isLaunchHireMode ? "LAUNCH_HIRE" : activeMainTab;
      const existing = prev.find((bs) => bs.id === targetId);
      if (existing) {
        return prev.map((bs) =>
          bs.id === targetId
            ? { ...bs, status: "Completed", subService: "Launch Hire" }
            : bs
        );
      }
      return [
        ...prev,
        { id: targetId, status: "Completed", subService: "Launch Hire" },
      ];
    });
  }, [isLaunchHireMode, activeMainTab]);

  const handleBackToServiceSelection = useCallback(() => {
    setServiceSelected(false);
    setSelectedServices([]);
    setActiveMainTab(null);
    setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
    setSelectedActionTab(null);
    setIsLaunchHireMode(false);
    // Keep booked services when going back
  }, []);

  // Crew sub-services with their own form — every other Crew Management
  // subtab falls back to the dashboard, which renders its own back link.
  const isCrewServiceView =
    activeMainTab === MAIN_TABS.CREW_MANAGEMENT &&
    [
      CREW_MANAGEMENT_SUBTABS.TRANSPORT,
      CREW_MANAGEMENT_SUBTABS.CG_PASS,
      CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS,
      CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE,
      CREW_MANAGEMENT_SUBTABS.HOTEL,
      CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE,
    ].includes(activeSubTab);
  const isCrewDashboardView = activeMainTab === MAIN_TABS.CREW_MANAGEMENT && !isCrewServiceView;

  const renderCrewManagementContent = () => {
    switch (activeSubTab) {
      case CREW_MANAGEMENT_SUBTABS.CREW:
        return (
          <CrewManagementDashboard
            card={card}
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
            onBackToServiceSelection={handleBackToServiceSelection}
          />
        );
      case CREW_MANAGEMENT_SUBTABS.TRANSPORT:
        return (
          <>
            <TransportContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleTransportRequestCount}
              onGoToCrew={handleGoToCrewTab}
              crewUploadMode={crewServiceFromOverview}
            />
          </>
        );
      case CREW_MANAGEMENT_SUBTABS.CG_PASS:
        return (
          <CGPassContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            card={card}
            onRequestCountChange={handleCgPassRequestCount}
            onGoToCrew={handleGoToCrewTab}
              crewUploadMode={crewServiceFromOverview}
          />
        );
      case CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS:
        return (
          <ZawilPassContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            card={card}
            onRequestCountChange={handleZawilPassRequestCount}
            onGoToCrew={handleGoToCrewTab}
              crewUploadMode={crewServiceFromOverview}
          />
        );
      case CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE:
        return (
          <LaunchHireContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            card={card}
            onLaunchHireSaved={handleLaunchHireSaved}
            onRequestCountChange={handleLaunchHireRequestCount}
            onGoToCrew={handleGoToCrewTab}
            crewUploadMode={crewServiceFromOverview}
          />
        );
      case CREW_MANAGEMENT_SUBTABS.HOTEL:
        return (
          <>
            <HotelContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleHotelRequestCount}
              onGoToCrew={handleGoToCrewTab}
              crewUploadMode={crewServiceFromOverview}
            />
          </>
        );
      case CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE:
        return (
          <>
            <MedicalServiceContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleMedicalRequestCount}
              onGoToCrew={handleGoToCrewTab}
              crewUploadMode={crewServiceFromOverview}
            />
          </>
        );
      case "crewChange":
      case "portPass":
        // No form exists yet for these services — fall back to the dashboard.
        return (
          <CrewManagementDashboard
            card={card}
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
            onBackToServiceSelection={handleBackToServiceSelection}
          />
        );
      default:
        return (
          <CrewManagementDashboard
            card={card}
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
            onBackToServiceSelection={handleBackToServiceSelection}
          />
        );
    }
  };

  const renderLaunchHireContent = () => {
    switch (activeSubTab) {
      case LAUNCH_HIRE_SUBTABS.INBOUND_ORDERS:
        return (
          <InboundOrdersContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            showLaunchHire={showLaunchHire}
          />
        );
      case LAUNCH_HIRE_SUBTABS.REQUESTS:
      default:
        return (
          <LaunchHireContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            card={card}
            onLaunchHireSaved={handleLaunchHireSaved}
          />
        );
    }
  };

  const renderMaterialManagementContent = () => {
    switch (activeSubTab) {
      case MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS:
        if (!canViewInboundOrders) return null;
        return (
          <InboundOrdersContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            showLaunchHire={showLaunchHire}
          />
        );
      case MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE:
        if (!canViewLandingNote) return null;
        return (
          <LandingNoteContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
          />
        );
      case MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE:
        if (!canViewDispatchNote) return null;
        return (
          <DispatchNoteContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
          />
        );
      case MATERIAL_MANAGEMENT_SUBTABS.ORDER_HISTORY:
        if (!canViewOrderHistory) return null;
        return (
          <OrderHistoryContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
          />
        );
      default:
        if (!canViewInboundOrders) return null;
        return (
          <InboundOrdersContent
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            showLaunchHire={showLaunchHire}
          />
        );
    }
  };

  // Each service badge shows the number of requests already saved for this
  // call. Priority: the live count reported by the service's own Content
  // component (once opened) → get_service_counts (keyed by service title) →
  // the crew currently picked in the pending form. Shared by the dashboard
  // rows and the left-nav.
  const selectedCrewCount = (field) => (Array.isArray(formValues?.[field]) ? formValues[field].length : 0);
  const crewServiceCount = (subTab, title, crewField) => {
    if (requestCounts[subTab] != null) return requestCounts[subTab];
    const apiCount = serviceCounts?.[title]?.requests;
    if (apiCount != null) return toCount(apiCount);
    return selectedCrewCount(crewField);
  };
  const crewServiceCounts = {
    [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.TRANSPORT, "Transport", "selectedCrew"),
    [CREW_MANAGEMENT_SUBTABS.HOTEL]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.HOTEL, "Hotel", "hotelSelectedCrew"),
    [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, "Medical", "medicalServiceSelectedCrew"),
    [CREW_MANAGEMENT_SUBTABS.CG_PASS]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.CG_PASS, "CG Pass", "cgPassSelectedCrew"),
    [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, "Zawil Pass", "zawilPassSelectedCrew"),
    [CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE]: crewServiceCount(CREW_MANAGEMENT_SUBTABS.LAUNCH_HIRE, "Launch Hire", "launchHireSelectedCrew"),
  };

  // DA module Husbandry: crew table only (no Booked Services)
  if (isDAModule) {
    return (
      <div className="operation-wrapper husbandry-wrapper" style={{ "--card-color": cardColor }}>
        <div className="husbandry-service-selection" style={{ "--card-color": cardColor }}>
          <div className="husbandry-service-selection-content">
            <div className="husbandry-da-crew-table-wrapper">
              <table className="table husbandry-da-crew-table">
                <thead>
                  <tr>
                    <th>Crew Name</th>
                    <th>Nationality</th>
                    <th>Rank</th>
                    <th>Passport No.</th>
                    <th>Iqama No.</th>
                    <th>Visa No.</th>
                    <th>Services</th>
                  </tr>
                </thead>
                <tbody>
                  {DAMODULE_CREW_DUMMY.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.crewName}</td>
                      <td>{row.nationality}</td>
                      <td>{row.rank}</td>
                      <td>{row.passportNo}</td>
                      <td>{row.iqamaNo}</td>
                      <td>{row.visaNo}</td>
                      <td>
                        <span className="husbandry-da-crew-service-badge">{row.service ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show service selection if no service has been selected (normal mode)
  if (!serviceSelected) {
    return (
      <div className="operation-wrapper husbandry-wrapper" style={{ "--card-color": cardColor }}>
        <ServiceSelection
          onSelectService={handleServiceSelect}
          cardColor={cardColor}
          bookedServices={bookedServices}
          crewServiceCounts={crewServiceCounts}
          serviceCounts={serviceCounts}
          requestsByService={requestsByService}
          serviceHistory={serviceHistory}
          showLaunchHire={showLaunchHire}
          hiddenServiceIds={hiddenHusbandryMainTabIds}
          salesOrder={salesOrder}
          callId={Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0) || null}
          crewCoordinators={crewCoordinators}
          onCrewCoordinatorsChange={onCrewCoordinatorsChange}
          assignedCrewCoordinators={assignedCrewCoordinators}
        />
      </div>
    );
  }

  return (
    <div className="operation-wrapper husbandry-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        {/* Sidebar only where it switches sub-tabs; every other service is full width. */}
        {activeMainTab === MAIN_TABS.MATERIAL_MANAGEMENT && (
          <HusbandryTabs
            activeMainTab={activeMainTab}
            activeSubTab={activeSubTab}
            onMainTabChange={handleMainTabChange}
            onSubTabChange={handleSubTabChange}
            onNavigateToTab={handleSidebarSubTabNavigate}
            selectedActionTab={selectedActionTab}
            selectedServices={selectedServices}
            cardColor={cardColor}
            crewCount={formValues?.crewCount}
            materialManagementVisibleSubTabIds={materialManagementVisibleSubTabIds}
            hiddenMainTabIds={hiddenHusbandryMainTabIds}
            subTabCounts={{
              [MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS]: inboundOrdersCount,
              [MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE]: landingNotesCount,
              [MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE]: dispatchNotesCount,
              [LAUNCH_HIRE_SUBTABS.INBOUND_ORDERS]: inboundOrdersCount,
              ...crewServiceCounts,
              crewChange: selectedCrewCount("crewChangeSelectedCrew"),
              portPass: selectedCrewCount("portPassSelectedCrew"),
            }}
          />
        )}
        <div className="operation-right">
          {!isCrewDashboardView && (
            <button
              type="button"
              className="husbandry-back-link-small husbandry-content-back-link"
              onClick={isCrewServiceView && !crewServiceFromOverview ? handleGoToCrewTab : handleBackToServiceSelection}
              style={{ "--card-color": cardColor }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                {isCrewServiceView && !crewServiceFromOverview ? "Back to Crew Management" : "What services do you need?"}
              </span>
            </button>
          )}
          {activeMainTab === "LAUNCH_HIRE" && renderLaunchHireContent()}
          {activeMainTab === MAIN_TABS.CREW_MANAGEMENT &&
            renderCrewManagementContent()}
          {activeMainTab === MAIN_TABS.MATERIAL_MANAGEMENT &&
            renderMaterialManagementContent()}
          {activeMainTab === MAIN_TABS.WASTE_DISPOSAL && (
            <WasteDisposalContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
            />
          )}
          {activeMainTab === MAIN_TABS.ON_STATION && (
            <OnStationContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
            />
          )}
          {activeMainTab === MAIN_TABS.MWP_RENEWAL && (
            <MWPRenewalContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
            />
          )}
          {activeMainTab === MAIN_TABS.THIRD_PARTY_SERVICES && (
            <ThirdPartyServicesContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              showLaunchHire={showLaunchHire}
            />
          )}
          {activeMainTab === MAIN_TABS.ADD_ON_SERVICES && (
            <AddOnServicesContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              showLaunchHire={showLaunchHire}
            />
          )}
        </div>
      </div>
    </div>
  );
}

Husbandry.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  isDAModule: PropTypes.bool,
  showLaunchHire: PropTypes.bool,
  crewCoordinators: PropTypes.array,
  onCrewCoordinatorsChange: PropTypes.func,
};

export default Husbandry;
