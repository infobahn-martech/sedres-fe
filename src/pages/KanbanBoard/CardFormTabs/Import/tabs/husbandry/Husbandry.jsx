import { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import "../../../../../../design/scss/operations.scss";
import "../../../../../../design/scss/table-common.scss";
import "../../../../../../design/scss/materialmanagement.scss";

// Import constants
import {
  MAIN_TABS,
  CREW_MANAGEMENT_SUBTABS,
  MATERIAL_MANAGEMENT_SUBTABS,
  LAUNCH_HIRE_SUBTABS,
} from "./components/Husbandry.constants";

// Import shared components
import { HusbandryTabs } from "./components/Husbandry.components";

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
import useInboundOrderReducer from "../../../../../../store/InboundOrderReducer";
import useLandingNoteReducer from "../../../../../../store/LandingNoteReducer";
import useDispatchNoteReducer from "../../../../../../store/DispatchNoteReducer";
import callFileService from "../../../../../../services/callFileService";
import transportContentService, { extractTransportRequestsFromEnvelope } from "../../../../../../services/transportContentService";
import hotelService, { extractHotelRequestsFromEnvelope } from "../../../../../../services/hotelService";
import hospitalService, { extractMedicalRequestsFromEnvelope } from "../../../../../../services/hospitalService";
import { getPassRequests, extractPassRequestsFromEnvelope } from "../../../../../../services/cgAndZwailpassService";
import usePermissions from "../../../../../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../../../../../shared/constants/permissions";

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

// Service Selection Component
const ServiceSelection = ({ onSelectService, cardColor, bookedServices = [], servicesSummary, showLaunchHire = true }) => {
  const categories = servicesSummary?.categories || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const allServices = [
    {
      id: MAIN_TABS.CREW_MANAGEMENT,
      label: "Crew Management",
      icon: "crew",
      accent: "#2563eb",
      summary: "Crew transport, hotel, medical and launch hire support.",
      footerBadges: [
        `Sign In: ${num(categories.crew_change?.sign_on)}`,
        `Sign Off: ${num(categories.crew_change?.sign_off)}`,
      ],
      bookedSummary: "Coordinate crew movement, accommodation and welfare services.",
    },
    {
      id: MAIN_TABS.MATERIAL_MANAGEMENT,
      label: "Material Management",
      icon: "box",
      accent: "#0d9488",
      summary: "Inbound orders, landing note and dispatch note handling.",
      footerBadges: [
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
      footerBadges: [`Requests: ${num(categories.waste_disposal?.total)}`],
      bookedSummary: "Ensure regulated pickup and transparent disposal follow-up.",
    },
    {
      id: "LAUNCH_HIRE",
      label: "Launch Hire",
      icon: "boat",
      accent: "#0891b2",
      summary: "Launch booking, transfer coordination and movement support.",
      footerBadges: [`Requests: ${num(categories.launch_hire?.total)}`],
      bookedSummary: "Arrange transfer windows with optimized launch availability.",
    },
    {
      id: MAIN_TABS.MWP_RENEWAL,
      label: "MWP Renewal",
      icon: "renewal",
      accent: "#7c3aed",
      summary: "Monitor MWP renewal requests and expected completion updates.",
      footerBadges: [`Requests: ${num(categories.mwp_renewal?.total)}`],
      bookedSummary: "Keep permits current with proactive renewal processing.",
    },
    {
      id: MAIN_TABS.THIRD_PARTY_SERVICES,
      label: "Third-Party Services",
      icon: "vendor",
      accent: "#e11d48",
      summary: "Raise and monitor external vendor service requests.",
      footerBadges: [`Requests: ${num(categories.third_party_service?.total)}`],
      bookedSummary: "Manage third-party support under a single service view.",
    },
    {
      id: MAIN_TABS.ADD_ON_SERVICES,
      label: "Add-on Services",
      icon: "addon",
      accent: "#059669",
      summary: "Raise and monitor optional add-on service requests.",
      bookedSummary: "Track add-on support requests under a single service view.",
    },
  ];

  const services = showLaunchHire
    ? allServices
    : allServices.filter((service) => service.id !== "LAUNCH_HIRE");

  const totalServices = services.length;
  const bookedCount = bookedServices.length;
  const pendingCount = bookedServices.filter(
    (service) => (service.status || "Pending") === "Pending"
  ).length;
  const completedCount = bookedServices.filter(
    (service) => (service.status || "Pending") === "Completed"
  ).length;

  const dashboardSummaryCards = [
    { label: "Total Services", value: totalServices, helper: "Available now" },
    { label: "Booked Services", value: bookedCount, helper: "Added to workflow" },
    { label: "Pending", value: pendingCount, helper: "Awaiting action" },
    { label: "Completed", value: completedCount, helper: "Successfully closed" },
  ];

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

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      "Pending": "booked-status-pending",
      "In Progress": "booked-status-in-progress",
      "Completed": "booked-status-completed",
      "Cancelled": "booked-status-cancelled",
    };
    return statusMap[status] || "booked-status-pending";
  };

  return (
    <div className="husbandry-service-selection" style={{ "--card-color": cardColor }}>
      <div className="husbandry-service-selection-content">
        <div className="husbandry-service-hero">
          <p className="husbandry-service-hero-eyebrow">Husbandry Dashboard</p>
          <h2 className="husbandry-service-selection-title">What services do you need?</h2>
          <p className="husbandry-service-hero-subtitle">
            Select a service to initiate requests, monitor progress and keep vessel support activities in one place.
          </p>
        </div>

        <div className="husbandry-service-options">
          {services.map((service, index) => {
            const bookedEntry = bookedServicesMap[service.id];
            const isBooked = Boolean(bookedEntry);
            const status = bookedEntry?.status || "Pending";

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
                {isBooked && (
                  <span
                    className={`husbandry-service-option-status ${getStatusBadgeClass(status)}`}
                    aria-label={`${service.label} status: ${status}`}
                  >
                    {status}
                  </span>
                )}
                <div className="husbandry-service-option-icon">
                  {getServiceIcon(service.icon)}
                </div>
                <div className="husbandry-service-option-content">
                  <span className="husbandry-service-option-label">{service.label}</span>
                  <p className="husbandry-service-option-summary">{service.summary}</p>
                </div>
                {isBooked && (
                  <div className="husbandry-service-option-booking">
                    {bookedEntry.subService && (
                      <span className="husbandry-service-option-sub">{bookedEntry.subService}</span>
                    )}
                    <p className="husbandry-service-option-booking-summary">
                      {service.bookedSummary}
                    </p>
                  </div>
                )}
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
      </div>
    </div>
  );
};

ServiceSelection.propTypes = {
  onSelectService: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  bookedServices: PropTypes.array,
  servicesSummary: PropTypes.object,
  showLaunchHire: PropTypes.bool,
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
function Husbandry({ card, formValues, handleChange, isDAModule = false, showLaunchHire = true }) {
  const { hasPermission } = usePermissions();
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
  // Initialize with dummy booked services for view-only mode (only for DA routes)
  const [bookedServices, setBookedServices] = useState(isDAModule ? [
    { id: MAIN_TABS.CREW_MANAGEMENT, status: "In Progress", subService: "Transport" },
    { id: MAIN_TABS.ON_STATION, status: "Pending", subService: null },
    { id: MAIN_TABS.MATERIAL_MANAGEMENT, status: "Completed", subService: "Inbound Orders" },
    { id: MAIN_TABS.WASTE_DISPOSAL, status: "Pending", subService: null },
    { id: "LAUNCH_HIRE", status: "In Progress", subService: null },
  ] : []);
  const cardColor = "#00368c"; // Fixed color for all buttons, effects, and backgrounds
  const [servicesSummary, setServicesSummary] = useState(null);

  // Booking counts reported by each service tab from its own API fetch —
  // reflects actual saved requests, not just the crew picked in the pending form.
  const [requestCounts, setRequestCounts] = useState({
    [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: null,
    [CREW_MANAGEMENT_SUBTABS.HOTEL]: null,
    [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: null,
    [CREW_MANAGEMENT_SUBTABS.CG_PASS]: null,
    [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: null,
  });

  const setRequestCount = useCallback((subTab, count) => {
    setRequestCounts((prev) => (prev[subTab] === count ? prev : { ...prev, [subTab]: count }));
  }, []);
  const handleTransportRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.TRANSPORT, count), [setRequestCount]);
  const handleHotelRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.HOTEL, count), [setRequestCount]);
  const handleMedicalRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, count), [setRequestCount]);
  const handleCgPassRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.CG_PASS, count), [setRequestCount]);
  const handleZawilPassRequestCount = useCallback((count) => setRequestCount(CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, count), [setRequestCount]);

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

  // Fetch each crew-management service's saved request count up front, so the
  // sidebar badges (Transport/Hotel/Medical/CG Pass/Zawil Pass) are correct on
  // first render instead of only after the user opens that subtab (which is
  // when each Content component's own fetch used to run).
  useEffect(() => {
    if (isDAModule) return undefined;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return undefined;

    let cancelled = false;

    transportContentService
      .getTransportRequest(callId)
      .then((response) => {
        if (cancelled) return;
        setRequestCount(CREW_MANAGEMENT_SUBTABS.TRANSPORT, extractTransportRequestsFromEnvelope(response).length);
      })
      .catch(() => {});

    hotelService
      .getHotelRequests(callId)
      .then((response) => {
        if (cancelled) return;
        setRequestCount(CREW_MANAGEMENT_SUBTABS.HOTEL, extractHotelRequestsFromEnvelope(response).length);
      })
      .catch(() => {});

    hospitalService
      .getMedicalRequests(callId)
      .then((response) => {
        if (cancelled) return;
        setRequestCount(CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE, extractMedicalRequestsFromEnvelope(response).length);
      })
      .catch(() => {});

    getPassRequests(callId)
      .then((response) => {
        if (cancelled) return;
        const { cg, zawil } = extractPassRequestsFromEnvelope(response);
        setRequestCount(CREW_MANAGEMENT_SUBTABS.CG_PASS, cg?.length || 0);
        setRequestCount(CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS, zawil?.length || 0);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isDAModule, formValues?.call_id, formValues?.callId, formValues?.card_call_id, setRequestCount]);

  useEffect(() => {
    if (isDAModule) return undefined;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return undefined;

    let cancelled = false;
    callFileService
      .getRequestedServicesSummary(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status === "success" && body?.data) {
          setServicesSummary(body.data);
        }
      })
      .catch(() => {
        // Non-critical: dashboard badges just fall back to 0 counts.
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
    setServiceSelected(true);
    setSelectedActionTab(null); // Reset selected action

    // Add or update booked service
    setBookedServices(prev => {
      const existing = prev.find(bs => bs.id === tab);
      if (existing) {
        // Service already booked, update it
        return prev.map(bs => bs.id === tab ? { ...bs, status: bs.status || "Pending" } : bs);
      } else {
        // New service booking
        const newService = {
          id: tab,
          status: "Pending",
          subService: null,
        };
        return [...prev, newService];
      }
    });

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

  // Handle navigation from CrewContent when crew is selected and action is chosen
  const handleNavigateToTab = useCallback((tabName) => {
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

  const renderCrewManagementContent = () => {
    switch (activeSubTab) {
      case CREW_MANAGEMENT_SUBTABS.CREW:
        return (
          <CrewManagementDashboard
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
          />
        );
      case CREW_MANAGEMENT_SUBTABS.TRANSPORT:
        return (
          <>
            <BackToCrewListingLink
              cardColor={cardColor}
              onClick={() => {
                setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
                setSelectedActionTab(null);
              }}
            />
            <TransportContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleTransportRequestCount}
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
          />
        );
      case CREW_MANAGEMENT_SUBTABS.HOTEL:
        return (
          <>
            <BackToCrewListingLink
              cardColor={cardColor}
              onClick={() => {
                setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
                setSelectedActionTab(null);
              }}
            />
            <HotelContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleHotelRequestCount}
            />
          </>
        );
      case CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE:
        return (
          <>
            <BackToCrewListingLink
              cardColor={cardColor}
              onClick={() => {
                setActiveSubTab(CREW_MANAGEMENT_SUBTABS.CREW);
                setSelectedActionTab(null);
              }}
            />
            <MedicalServiceContent
              formValues={formValues}
              handleChange={handleChange}
              cardColor={cardColor}
              onRequestCountChange={handleMedicalRequestCount}
            />
          </>
        );
      case "crewChange":
      case "portPass":
        // No form exists yet for these services — fall back to the dashboard.
        return (
          <CrewManagementDashboard
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
          />
        );
      default:
        return (
          <CrewManagementDashboard
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            onNavigateToTab={handleNavigateToTab}
            launchHireOnly={isLaunchHireMode}
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
          servicesSummary={servicesSummary}
          showLaunchHire={showLaunchHire}
        />
      </div>
    );
  }

  return (
    <div className="operation-wrapper husbandry-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        <HusbandryTabs
          activeMainTab={activeMainTab}
          activeSubTab={activeSubTab}
          onMainTabChange={handleMainTabChange}
          onSubTabChange={handleSubTabChange}
          onNavigateToTab={handleSidebarSubTabNavigate}
          selectedActionTab={selectedActionTab}
          selectedServices={selectedServices}
          onBackToServiceSelection={handleBackToServiceSelection}
          cardColor={cardColor}
          crewCount={formValues?.crewCount}
          materialManagementVisibleSubTabIds={materialManagementVisibleSubTabIds}
          subTabCounts={{
            [MATERIAL_MANAGEMENT_SUBTABS.INBOUND_ORDERS]: inboundOrdersCount,
            [MATERIAL_MANAGEMENT_SUBTABS.LANDING_NOTE]: landingNotesCount,
            [MATERIAL_MANAGEMENT_SUBTABS.DISPATCH_NOTE]: dispatchNotesCount,
            [LAUNCH_HIRE_SUBTABS.INBOUND_ORDERS]: inboundOrdersCount,
            // Each service badge shows the number of requests already saved
            // for this call, as fetched from its own API. Until that tab has
            // been opened at least once (requestCounts entry still null),
            // fall back to the crew currently picked in the pending form.
            [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: requestCounts[CREW_MANAGEMENT_SUBTABS.TRANSPORT] ?? (Array.isArray(formValues?.selectedCrew) ? formValues.selectedCrew.length : 0),
            [CREW_MANAGEMENT_SUBTABS.HOTEL]: requestCounts[CREW_MANAGEMENT_SUBTABS.HOTEL] ?? (Array.isArray(formValues?.hotelSelectedCrew) ? formValues.hotelSelectedCrew.length : 0),
            [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: requestCounts[CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE] ?? (Array.isArray(formValues?.medicalServiceSelectedCrew) ? formValues.medicalServiceSelectedCrew.length : 0),
            [CREW_MANAGEMENT_SUBTABS.CG_PASS]: requestCounts[CREW_MANAGEMENT_SUBTABS.CG_PASS] ?? (Array.isArray(formValues?.cgPassSelectedCrew) ? formValues.cgPassSelectedCrew.length : 0),
            [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: requestCounts[CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS] ?? (Array.isArray(formValues?.zawilPassSelectedCrew) ? formValues.zawilPassSelectedCrew.length : 0),
            crewChange: Array.isArray(formValues?.crewChangeSelectedCrew) ? formValues.crewChangeSelectedCrew.length : 0,
            portPass: Array.isArray(formValues?.portPassSelectedCrew) ? formValues.portPassSelectedCrew.length : 0,
          }}
        />
        <div className="operation-right">
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
};

export default Husbandry;
