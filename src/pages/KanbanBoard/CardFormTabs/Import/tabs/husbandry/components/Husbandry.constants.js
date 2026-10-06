// Constants
export const MAIN_TABS = {
  CREW_MANAGEMENT: "crewManagement",
  WAREHOUSE: "warehouse",
  ON_OFF_HIRE_SURVEY: "onOffHireSurvey",
  ON_STATION: "onStation",
  MATERIAL_MANAGEMENT: "materialManagement",
  WASTE_DISPOSAL: "wasteDisposal",
  MWP_RENEWAL: "mwpRenewal",
  THIRD_PARTY_SERVICES: "thirdPartyServices",
  ADD_ON_SERVICES: "addOnServices",
};

export const CREW_MANAGEMENT_SUBTABS = {
  CREW: "crew",
  TRANSPORT: "transport",
  CG_PASS: "cgPass",
  ZAWIL_PASS: "zawilPass",
  LAUNCH_HIRE: "launchHire",
  HOTEL: "hotel",
  MEDICAL_SERVICE: "medicalService",
};

export const MATERIAL_MANAGEMENT_SUBTABS = {
  SUMMARY: "summary",
  INBOUND_ORDERS: "inboundOrders",
  LANDING_NOTE: "landingNote",
  DISPATCH_NOTE: "dispatchNote",
  ORDER_HISTORY: "orderHistory",
};

export const LAUNCH_HIRE_SUBTABS = {
  REQUESTS: "launchHireRequests",
  INBOUND_ORDERS: "launchHireInboundOrders",
};

// Sidebar tab icon colors — single source of truth for each tab's color.
// Shared by the left-nav TabIcon and by SERVICE_ACCENT below so a page's
// section headers/icons always match its own sidebar tab.
export const TAB_ICON_COLORS = {
  [MAIN_TABS.CREW_MANAGEMENT]: "#7C3AED",
  [CREW_MANAGEMENT_SUBTABS.CREW]: "#7C3AED",
  [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: "#0D9488",
  [CREW_MANAGEMENT_SUBTABS.CG_PASS]: "#2563EB",
  [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: "#D97706",
  [CREW_MANAGEMENT_SUBTABS.HOTEL]: "#DB2777",
  [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: "#16A34A",
  [MAIN_TABS.WAREHOUSE]: "#0D9488",
  [MAIN_TABS.ON_OFF_HIRE_SURVEY]: "#2563EB",
  [MAIN_TABS.ON_STATION]: "#DB2777",
  [MAIN_TABS.MATERIAL_MANAGEMENT]: "#0D9488",
  [MAIN_TABS.WASTE_DISPOSAL]: "#D97706",
  [MAIN_TABS.MWP_RENEWAL]: "#16A34A",
  [MAIN_TABS.THIRD_PARTY_SERVICES]: "#2563EB",
  [MAIN_TABS.ADD_ON_SERVICES]: "#E11D48",
  LAUNCH_HIRE: "#0D9488",
};

// Single service-level theme color per husbandry tab — reuses TAB_ICON_COLORS
// (the sidebar tab icon color) so every section header/icon on a tab's page
// matches its left-nav entry instead of each section picking its own color.
// Add an entry here (and a matching `.husb-accent-*` block in operations.scss)
// when a new tab needs theming.
export const SERVICE_ACCENT = {
  [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: "teal",
  [CREW_MANAGEMENT_SUBTABS.CG_PASS]: "blue",
  [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: "amber",
  [CREW_MANAGEMENT_SUBTABS.HOTEL]: "pink",
  [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: "green",
  [MAIN_TABS.WASTE_DISPOSAL]: "amber",
  [MAIN_TABS.MWP_RENEWAL]: "green",
  [MAIN_TABS.THIRD_PARTY_SERVICES]: "blue",
  [MAIN_TABS.ADD_ON_SERVICES]: "rose",
  LAUNCH_HIRE: "teal",
};

// Launch Hire - Trigger & Booking Interface
export const LAUNCH_HIRE_LOCATION_OPTIONS = [
  { value: "Freighter Anchorage", label: "Freighter Anchorage" },
  { value: "RT7", label: "RT7" },
  { value: "Sea Island", label: "Sea Island" },
  { value: "Juaymah", label: "Juaymah" },
];

// Document upload validation — shared by every Material Management document
// dropzone (Inbound Order, Landing Note add/edit, Dispatch Note). Matches the
// limits already enforced on Material Management's own item file upload.
export const DOCUMENT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

/** Splits files into ones that pass type/size checks and ones rejected, each rejection paired with its reason. */
export const validateDocumentFiles = (files) => {
  const validFiles = [];
  const rejectedFiles = [];

  files.forEach((file) => {
    const extension = "." + file.name.split(".").pop().toLowerCase();
    if (!DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS.includes(extension)) {
      rejectedFiles.push({ name: file.name, reason: `unsupported file type (${extension})` });
      return;
    }
    if (file.size > DOCUMENT_UPLOAD_MAX_SIZE) {
      rejectedFiles.push({ name: file.name, reason: "exceeds 10MB size limit" });
      return;
    }
    validFiles.push(file);
  });

  return { validFiles, rejectedFiles };
};

export const TRANSPORT_ROUTE_LOCATION_OPTIONS = [
  { value: "Dammam airport", label: "Dammam airport" },
  { value: "Dammam", label: "Dammam" },
  { value: "Khobar", label: "Khobar" },
  { value: "Dhahran", label: "Dhahran" },
  { value: "Rastanura", label: "Rastanura" },
  { value: "Jubail", label: "Jubail" },
  { value: "Abu Ali pier", label: "Abu Ali pier" },
  { value: "Ras Abu Ali", label: "Ras Abu Ali" },
  { value: "Manifa", label: "Manifa" },
  { value: "Tanajib", label: "Tanajib" },
  { value: "Safaniya", label: "Safaniya" },
  { value: "Ras Al Khair", label: "Ras Al Khair" },
  { value: "Bahrain", label: "Bahrain" },
  { value: "Tanajib pier", label: "Tanajib pier" },
  { value: "Safaniya pier", label: "Safaniya pier" },
  { value: "Khafji", label: "Khafji" },
  { value: "Abu Ali", label: "Abu Ali" },
  { value: "Shedgum", label: "Shedgum" },
  { value: "Mubarrz", label: "Mubarrz" },
  { value: "Manifa port", label: "Manifa port" },
];

export const LAUNCH_HIRE_SERVICE_TYPES = {
  CREW_CHANGE: "CREW_CHANGE",
  MATERIAL_DELIVERY: "MATERIAL_DELIVERY",
  CREW_CHANGE_MATERIAL_DELIVERY: "CREW_CHANGE_MATERIAL_DELIVERY",
  PROVISION_DELIVERY: "PROVISION_DELIVERY",
  PORT_CAPTAIN_ENGINEER_VISIT: "PORT_CAPTAIN_ENGINEER_VISIT",
  CUSTOM_INSPECTION: "CUSTOM_INSPECTION",
  IMMIGRATION_CLEARANCE: "IMMIGRATION_CLEARANCE",
  GARBAGE_COLLECTION: "GARBAGE_COLLECTION",
  TECHNICIAN_VISIT: "TECHNICIAN_VISIT",
  TANKER_CLEARANCE: "TANKER_CLEARANCE",
};

export const LAUNCH_HIRE_SERVICE_TYPE_OPTIONS = [

  { value: LAUNCH_HIRE_SERVICE_TYPES.PROVISION_DELIVERY, label: "Provision Delivery" },
  { value: LAUNCH_HIRE_SERVICE_TYPES.PORT_CAPTAIN_ENGINEER_VISIT, label: "Port Captain & Port Engineer Visit" },

  { value: LAUNCH_HIRE_SERVICE_TYPES.GARBAGE_COLLECTION, label: "Garbage Collection" },
  { value: LAUNCH_HIRE_SERVICE_TYPES.TECHNICIAN_VISIT, label: "Technician Visit" },
  { value: LAUNCH_HIRE_SERVICE_TYPES.TANKER_CLEARANCE, label: "Tanker Clearance" },
];

// Service types that require a Packing List excel upload
export const LAUNCH_HIRE_PACKING_LIST_SERVICE_TYPES = [
  LAUNCH_HIRE_SERVICE_TYPES.MATERIAL_DELIVERY,
  LAUNCH_HIRE_SERVICE_TYPES.PROVISION_DELIVERY,
  LAUNCH_HIRE_SERVICE_TYPES.GARBAGE_COLLECTION,
  LAUNCH_HIRE_SERVICE_TYPES.CREW_CHANGE_MATERIAL_DELIVERY,
];

export const LAUNCH_HIRE_CREW_MOVEMENT_OPTIONS = [
  { value: "SIGN_ON", label: "Sign On" },
  { value: "SIGN_OFF", label: "Sign Off" },
];

// Add-on Service catalog IDs that require a different request payload/UI than
// the generic add-on service request (see AddOnServicesContent.jsx).
export const ADD_ON_SERVICE_TYPE_IDS = {
  PROVISION_DELIVERY: 1,
  TANKER_CLEARANCE: 4,
};

// Fixed checklist of documents required for a Tanker Clearance add-on service
// request. Order here defines the order of document_names[]/attachments[] sent
// to addon_service/create_addon_service_request.
export const TANKER_CLEARANCE_DOCUMENT_NAMES = [
  "Inward Clearance copy",
  "Marine Terminal Invoice",
  "Mawani Port Invoice",
  "Ballast Water Sampling Invoice",
  "Signed BL & Manifest Copy",
  "Local Bayan copy",
  "Sailing Clearance",
  "Sedres Sales Order",
  "Sedres Tax Invoice",
  "Comparison Sheet",
];

// Left-nav service icons — one small stroke icon per tab id, matching the
// simple inline-SVG convention already used across this codebase (no new
// icon library/dependency introduced).
export const TAB_ICON_PATHS = {
  [MAIN_TABS.CREW_MANAGEMENT]: "M12 21V19C12 17.9391 11.5786 16.9217 10.8284 16.1716C10.0783 15.4214 9.06087 15 8 15H4C2.93913 15 1.92172 15.4214 1.17157 16.1716C0.421427 16.9217 0 17.9391 0 19V21M16 21V19C15.9993 18.1137 15.7044 17.2528 15.1614 16.5523C14.6184 15.8519 13.8581 15.3516 13 15.13M11 3.13C11.8604 3.35031 12.623 3.85071 13.1676 4.55232C13.7122 5.25392 14.0078 6.11683 14.0078 7.005C14.0078 7.89317 13.7122 8.75608 13.1676 9.45768C12.623 10.1593 11.8604 10.6597 11 10.88M9 7C9 9.20914 7.20914 11 5 11C2.79086 11 1 9.20914 1 7C1 4.79086 2.79086 3 5 3C7.20914 3 9 4.79086 9 7Z",
  [CREW_MANAGEMENT_SUBTABS.CREW]: "M12 21V19C12 17.9391 11.5786 16.9217 10.8284 16.1716C10.0783 15.4214 9.06087 15 8 15H4C2.93913 15 1.92172 15.4214 1.17157 16.1716C0.421427 16.9217 0 17.9391 0 19V21M16 21V19C15.9993 18.1137 15.7044 17.2528 15.1614 16.5523C14.6184 15.8519 13.8581 15.3516 13 15.13M11 3.13C11.8604 3.35031 12.623 3.85071 13.1676 4.55232C13.7122 5.25392 14.0078 6.11683 14.0078 7.005C14.0078 7.89317 13.7122 8.75608 13.1676 9.45768C12.623 10.1593 11.8604 10.6597 11 10.88M9 7C9 9.20914 7.20914 11 5 11C2.79086 11 1 9.20914 1 7C1 4.79086 2.79086 3 5 3C7.20914 3 9 4.79086 9 7Z",
  [CREW_MANAGEMENT_SUBTABS.TRANSPORT]: "M2 15H1C0.44772 15 0 14.5523 0 14V10C0 9.44772 0.447715 9 1 9H1.5M2 15H14M2 15V17M14 15H15C15.5523 15 16 14.5523 16 14V10C16 9.44772 15.5523 9 15 9H14.5M14 15V17M2 9L3.5 5H12.5L14 9M2 9H14",
  [CREW_MANAGEMENT_SUBTABS.CG_PASS]: "M8 1L14 3.5V8C14 12 11.5 14.8 8 16C4.5 14.8 2 12 2 8V3.5L8 1Z",
  [CREW_MANAGEMENT_SUBTABS.ZAWIL_PASS]: "M2 3H14C14.5523 3 15 3.44772 15 4V12C15 12.5523 14.5523 13 14 13H2C1.44772 13 1 12.5523 1 12V4C1 3.44772 1.44772 3 2 3ZM4 6H12M4 9H8",
  [CREW_MANAGEMENT_SUBTABS.HOTEL]: "M1 15H15M2 15V5L8 1L14 5V15M6 15V9H10V15",
  [CREW_MANAGEMENT_SUBTABS.MEDICAL_SERVICE]: "M8 5V11M5 8H11M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z",
  [MAIN_TABS.WAREHOUSE]: "M1 6L8 2L15 6V14H1V6ZM1 6L8 10L15 6",
  [MAIN_TABS.ON_OFF_HIRE_SURVEY]: "M3 2H13V15L8 12.5L3 15V2ZM5 6H11M5 9H11",
  [MAIN_TABS.ON_STATION]: "M8 1C5 1 3 3.3 3 6.2C3 9.6 8 15 8 15C8 15 13 9.6 13 6.2C13 3.3 11 1 8 1ZM8 8.2C6.9 8.2 6 7.3 6 6.2C6 5.1 6.9 4.2 8 4.2C9.1 4.2 10 5.1 10 6.2C10 7.3 9.1 8.2 8 8.2Z",
  [MAIN_TABS.MATERIAL_MANAGEMENT]: "M1 6L8 2L15 6V14H1V6ZM8 2V14M1 6L8 10L15 6",
  [MAIN_TABS.WASTE_DISPOSAL]: "M3 4H13M6 4V2.5C6 2.22386 6.22386 2 6.5 2H9.5C9.77614 2 10 2.22386 10 2.5V4M4 4L4.7 13.3C4.73 13.7 5.07 14 5.47 14H10.53C10.93 14 11.27 13.7 11.3 13.3L12 4",
  [MAIN_TABS.MWP_RENEWAL]: "M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C10 2 11.5 2.8 12.5 4M12.5 4V1.5M12.5 4H10",
  [MAIN_TABS.THIRD_PARTY_SERVICES]: "M2 5H14V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V5ZM4 5V3.5C4 2.67157 4.67157 2 5.5 2H10.5C11.3284 2 12 2.67157 12 3.5V5",
  [MAIN_TABS.ADD_ON_SERVICES]: "M8 1.5L14 4.75V11.25L8 14.5L2 11.25V4.75L8 1.5Z M8 6V11M5.5 8.5H10.5",
  LAUNCH_HIRE: "M2 10H14L12.5 13H3.5L2 10ZM8 2V10M6 4L8 2L10 4M1 10C3 8.5 5 8 8 8C11 8 13 8.5 15 10",
  crewChange: "M2 5H11L9 3M11 5L9 7M14 11H5L7 9M5 11L7 13",
  portPass: "M2 3H14C14.5523 3 15 3.44772 15 4V12C15 12.5523 14.5523 13 14 13H2C1.44772 13 1 12.5523 1 12V4C1 3.44772 1.44772 3 2 3ZM5.5 8.5C6.32843 8.5 7 7.82843 7 7C7 6.17157 6.32843 5.5 5.5 5.5C4.67157 5.5 4 6.17157 4 7C4 7.82843 4.67157 8.5 5.5 8.5ZM3.5 11C3.5 9.89543 4.39543 9 5.5 9C6.60457 9 7.5 9.89543 7.5 11M9.5 6H12.5M9.5 8.5H12.5",
};

/** Columns of the manual crew entry grid; headers double as the generated CSV's header row. */
export const CREW_ENTRY_COLUMNS = [
  { key: "crew_name", header: "Crew Name", placeholder: "Full name", required: true },
  { key: "rank", header: "Rank", placeholder: "e.g. Master" },
  { key: "nationality", header: "Nationality", placeholder: "e.g. Indian" },
  { key: "date_of_birth", header: "Date of Birth", placeholder: "DD/MM/YYYY" },
  { key: "passport_no", header: "Passport No", placeholder: "Passport number" },
];
