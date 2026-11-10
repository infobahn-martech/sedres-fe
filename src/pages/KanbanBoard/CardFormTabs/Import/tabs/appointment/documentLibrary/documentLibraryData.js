export const FOLDER_ICON_TYPES = {
  EMAIL: "email",
  SHIP: "ship",
  CLEARANCE: "clearance",
  CHECKLIST: "checklist",
  CREW: "crew",
};

export const FOLDER_ICONS = {
  [FOLDER_ICON_TYPES.EMAIL]: {
    label: "Email / Document",
    asset: "icon-mail",
  },
  [FOLDER_ICON_TYPES.SHIP]: {
    label: "Ship / Document",
    asset: "map",
  },
  [FOLDER_ICON_TYPES.CLEARANCE]: {
    label: "Clearance / Document",
    asset: "DocumentIcon",
  },
  [FOLDER_ICON_TYPES.CHECKLIST]: {
    label: "Checklist",
    asset: "CircleTick",
  },
  [FOLDER_ICON_TYPES.CREW]: {
    label: "Crew / Pass",
    asset: "icon-crew",
  },
};

const VESSEL_NAME = "MV Horizon Star";
const PORT = "Jebel Ali, UAE";

export const FOLDER_TREE = [
  {
    name: "Appointment Acceptance",
    icon: FOLDER_ICON_TYPES.EMAIL,
    children: [{ name: "Appointment Email" }],
  },
  {
    name: "Pre Arrival",
    icon: FOLDER_ICON_TYPES.SHIP,
    children: [{ name: "Saber Doc" }],
  },
  {
    name: "Arrival",
    icon: FOLDER_ICON_TYPES.CLEARANCE,
    children: [
      { name: "Inward Clearance Doc" },
      { name: "SADAD Doc" },
      { name: "MWP Doc" },
      { name: "Initial Bayan Doc" },
      { name: "Final Bayan Doc" },
    ],
  },
  {
    name: "Checklist",
    icon: FOLDER_ICON_TYPES.CHECKLIST,
    children: [
      { name: "Taxi Tug Checklist" },
      { name: "Import Vessel Checklist" },
    ],
  },
  {
    name: "Crew Change",
    icon: FOLDER_ICON_TYPES.CREW,
    children: [
      { name: "CG Pass" },
      { name: "Zawil Pass" },
    ],
  },
];

export const DOCUMENTS = [
  {
    id: 1,
    type: "pdf",
    folder: "Appointment Email",
    name: "2_IMP_Horizon_Client_Appointment_Email.pdf",
    size: "2.76 MB",
    uploadedBy: "Martech",
    date: "Jun 11, 2026",
    uploadDate: "Jun 11, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Horizon Maritime Services",
      subtitle: "Appointment Confirmation",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Martech",
      uploadDate: "Jun 11, 2026",
      eta: "June 18, 2026 — 06:30 UTC",
    },
  },
  {
    id: 2,
    type: "pdf",
    folder: "Appointment Email",
    name: "Horizon_Appointment_Acceptance_Letter.pdf",
    size: "1.18 MB",
    uploadedBy: "Operations",
    date: "Jun 11, 2026",
    uploadDate: "Jun 11, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Horizon Maritime Services",
      subtitle: "Appointment Acceptance Letter",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Operations",
      uploadDate: "Jun 11, 2026",
      referenceNo: "APT-2026-1042",
    },
  },
  {
    id: 3,
    type: "pdf",
    folder: "Saber Doc",
    name: "SABER_Pre_Arrival_Clearance.pdf",
    size: "945 KB",
    uploadedBy: "Documentation",
    date: "Jun 14, 2026",
    uploadDate: "Jun 14, 2026",
    preview: {
      documentType: "PDF Document",
      title: "SABER Pre-Arrival Documentation",
      subtitle: "Saudi Product Safety Program",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Documentation",
      uploadDate: "Jun 14, 2026",
      certificateNo: "SBR-IMP-2026-3318",
    },
  },
  {
    id: 4,
    type: "pdf",
    folder: "Inward Clearance Doc",
    name: "Inward_Clearance_Certificate.pdf",
    size: "1.05 MB",
    uploadedBy: "Port Agency",
    date: "Jun 16, 2026",
    uploadDate: "Jun 16, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Port of Jebel Ali",
      subtitle: "Inward Clearance Certificate",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Port Agency",
      uploadDate: "Jun 16, 2026",
      clearanceNo: "IC-2026-77821",
    },
  },
  {
    id: 5,
    type: "pdf",
    folder: "SADAD Doc",
    name: "SADAD_Payment_Receipt.pdf",
    size: "620 KB",
    uploadedBy: "Finance",
    date: "Jun 16, 2026",
    uploadDate: "Jun 16, 2026",
    preview: {
      documentType: "PDF Document",
      title: "SADAD Payment System",
      subtitle: "Port Charges Payment Receipt",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Finance",
      uploadDate: "Jun 16, 2026",
      sadadRef: "SDD-8847291056",
      amount: "SAR 12,450.00",
    },
  },
  {
    id: 6,
    type: "pdf",
    folder: "MWP Doc",
    name: "MWP_Maritime_Waste_Plan.pdf",
    size: "780 KB",
    uploadedBy: "Operations",
    date: "Jun 16, 2026",
    uploadDate: "Jun 16, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Maritime Waste Plan",
      subtitle: "MWP Submission",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Operations",
      uploadDate: "Jun 16, 2026",
      planRef: "MWP-2026-0441",
    },
  },
  {
    id: 7,
    type: "pdf",
    folder: "Initial Bayan Doc",
    name: "Initial_Bayan_Declaration.pdf",
    size: "1.32 MB",
    uploadedBy: "Customs Broker",
    date: "Jun 17, 2026",
    uploadDate: "Jun 17, 2026",
    preview: {
      documentType: "PDF Document",
      title: "UAE Customs",
      subtitle: "Initial Bayan Declaration",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Customs Broker",
      uploadDate: "Jun 17, 2026",
      bayanNo: "BY-INIT-2026-55290",
    },
  },
  {
    id: 8,
    type: "pdf",
    folder: "Final Bayan Doc",
    name: "Final_Bayan_Declaration.pdf",
    size: "1.48 MB",
    uploadedBy: "Customs Broker",
    date: "Jun 17, 2026",
    uploadDate: "Jun 17, 2026",
    preview: {
      documentType: "PDF Document",
      title: "UAE Customs",
      subtitle: "Final Bayan Declaration",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Customs Broker",
      uploadDate: "Jun 17, 2026",
      bayanNo: "BY-FNL-2026-55291",
    },
  },
  {
    id: 9,
    type: "pdf",
    folder: "Taxi Tug Checklist",
    name: "Taxi_Tug_Operation_Checklist.pdf",
    size: "540 KB",
    uploadedBy: "Operations",
    date: "Jun 15, 2026",
    uploadDate: "Jun 15, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Taxi Tug Checklist",
      subtitle: "Pre-Operation Inspection",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Operations",
      uploadDate: "Jun 15, 2026",
      checklistStatus: "Completed — 24/24 items",
    },
  },
  {
    id: 10,
    type: "pdf",
    folder: "Import Vessel Checklist",
    name: "Import_Vessel_Arrival_Checklist.pdf",
    size: "680 KB",
    uploadedBy: "Operations",
    date: "Jun 15, 2026",
    uploadDate: "Jun 15, 2026",
    preview: {
      documentType: "PDF Document",
      title: "Import Vessel Checklist",
      subtitle: "Arrival Readiness Verification",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Operations",
      uploadDate: "Jun 15, 2026",
      checklistStatus: "In Progress — 18/22 items",
    },
  },
  {
    id: "cg-pass",
    type: "pdf",
    fileType: "pdf",
    folder: "CG Pass",
    name: "CG Pass.pdf",
    size: "2.76 MB",
    uploadedBy: "Martech",
    date: "Jun 10, 2026",
    uploadDate: "Jun 10, 2026",
    previewUrl: `${import.meta.env.BASE_URL}mock-documents/cg-pass.pdf`,
    preview: {
      documentType: "Crew Gate Pass",
      title: "Horizon Maritime Services",
      subtitle: "Crew Gate / Security Pass",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Martech",
      uploadDate: "Jun 10, 2026",
      crewMember: "Ahmed Hassan",
      passNumber: "CG-2026-0847",
      validFrom: "June 17, 2026",
      validUntil: "June 20, 2026",
      accessZone: "Crew Gate — Terminal 2",
    },
  },
  {
    id: "zawil-pass",
    type: "pdf",
    fileType: "pdf",
    folder: "Zawil Pass",
    name: "Zawil Pass.pdf",
    size: "1.18 MB",
    uploadedBy: "Martech",
    date: "Jun 10, 2026",
    uploadDate: "Jun 10, 2026",
    previewUrl: `${import.meta.env.BASE_URL}mock-documents/zawil-pass.pdf`,
    preview: {
      documentType: "Port Entry Permit",
      title: "Zawil Port Authority",
      subtitle: "Port Entry Permit (Zawil Pass)",
      vesselName: VESSEL_NAME,
      port: PORT,
      uploadedBy: "Martech",
      uploadDate: "Jun 10, 2026",
      permitNo: "ZW-2026-1193",
      validFrom: "June 17, 2026",
      validUntil: "June 21, 2026",
      issuedTo: "MV Horizon Star — Master",
    },
  },
];


const getFileExtension = (fileName = "") => {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

const resolveFileType = (fileName) => {
  const ext = getFileExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "doc";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xls";
  if (ext === "msg" || ext === "eml") return "msg";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  return "file";
};

const FOLDER_ICON_KEYWORDS = [
  { keywords: ["email", "appointment", "mail"], icon: FOLDER_ICON_TYPES.EMAIL },
  { keywords: ["pre arrival", "arrival", "saber", "vessel"], icon: FOLDER_ICON_TYPES.SHIP },
  { keywords: ["clearance", "bayan", "customs", "sadad", "mwp", "call file"], icon: FOLDER_ICON_TYPES.CLEARANCE },
  { keywords: ["checklist", "check"], icon: FOLDER_ICON_TYPES.CHECKLIST },
  { keywords: ["crew", "pass", "immigration", "gate"], icon: FOLDER_ICON_TYPES.CREW },
];

const resolveFolderIcon = (label = "") => {
  const lower = String(label).toLowerCase();
  const found = FOLDER_ICON_KEYWORDS.find((group) =>
    group.keywords.some((keyword) => lower.includes(keyword))
  );
  return found ? found.icon : FOLDER_ICON_TYPES.CLEARANCE;
};

const normalizeAttachmentDoc = (doc, folderKey, fallbackId) => {
  const sourceName = doc?.file_name || doc?.document_name;
  const fileType = resolveFileType(sourceName);
  return {
    id: fallbackId,
    folder: folderKey,
    type: fileType,
    fileType,
    name: doc?.document_name || doc?.file_name || "Untitled document",
    fileName: doc?.file_name || "",
    size: doc?.size || "",
    uploadedBy: doc?.uploaded_by || "—",
    date: doc?.date || doc?.uploaded_at || "",
    uploadDate: doc?.date || doc?.uploaded_at || "",
    previewUrl: doc?.file_url || "",
  };
};

/**
 * Transform the `attachments/get_all_attachments` response into the folder
 * tree + flat documents shape consumed by the document library components.
 *
 * The API returns an array of document sections, each holding its own
 * documents. Every section becomes a top-level folder.
 *
 * @param {Array<{ document_section: string, documents: Array }>} payload
 * @returns {{ folderTree: Array, documents: Array }}
 */
export const transformAttachmentsResponse = (payload) => {
  const sections = Array.isArray(payload) ? payload : [];

  const folderTree = [];
  const documents = [];

  sections.forEach((section) => {
    const sectionName = section?.document_section;
    if (!sectionName) return;

    const folderKey = `stage::${sectionName}`;
    folderTree.push({
      name: folderKey,
      label: sectionName,
      icon: resolveFolderIcon(sectionName),
      children: [],
    });

    (Array.isArray(section?.documents) ? section.documents : []).forEach((doc, index) => {
      documents.push(normalizeAttachmentDoc(doc, folderKey, `${folderKey}::${index}`));
    });
  });

  return { folderTree, documents };
};

/**
 * Resolve the initial folder/document selection for a given tree + documents.
 * Prefers the first folder (or sub-folder) that actually contains documents.
 */
export const resolveLibraryDefaults = (folderTree, documents) => {
  const folderHasDocuments = (folderKey) =>
    documents.some((doc) => doc.folder === folderKey);
  const firstDocumentId = (folderKey) =>
    documents.find((doc) => doc.folder === folderKey)?.id ?? null;

  for (const node of folderTree) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (hasChildren) {
      const childWithDocs = node.children.find((child) => folderHasDocuments(child.name));
      if (childWithDocs) {
        return {
          folder: childWithDocs.name,
          parentFolder: node.name,
          documentId: firstDocumentId(childWithDocs.name),
        };
      }
    } else if (folderHasDocuments(node.name)) {
      return { folder: node.name, parentFolder: null, documentId: firstDocumentId(node.name) };
    }
  }

  const first = folderTree[0];
  if (first) {
    const hasChildren = Array.isArray(first.children) && first.children.length > 0;
    if (hasChildren) {
      return { folder: first.children[0].name, parentFolder: first.name, documentId: null };
    }
    return { folder: first.name, parentFolder: null, documentId: null };
  }

  return { folder: null, parentFolder: null, documentId: null };
};
