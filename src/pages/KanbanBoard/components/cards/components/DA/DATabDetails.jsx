import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FiFile, FiPaperclip, FiX } from "react-icons/fi";
import "../../../../../../design/scss/pages/kanban-board/da-tab-details.scss";

const STORAGE_PREFIX = "da-tab-details:";

const EMPTY_FIELDS = {
  owner: "",
  coOwners: "",
  deadline: "",
  size: "",
  tags: "",
  customCardId: "",
  lastMoved: "",
  srtPoWbs: "",
  inwardClearanceDate: "",
  inwardClearanceTime: "",
  noOfImmigrationCrew: "",
  outwardClearanceDate: "",
  outwardClearanceTime: "",
  noOfLaunchHireTrips: "",
  thirdPartyLaunchHire: "",
  roadTransport: "",
  penalty: "",
  totalOnsigners: "",
  totalOffsigners: "",
  thirdPartyItems: "",
  taxInvoice: "",
  invoiceAmount: "",
  billingEntityOther: "",
  cargoBayanCount: "",
  operationsCompletionDate: "",
  vesselName: "",
  sapSalesOrderNo: "",
  serviceRequester: "",
};

/** Normalizes assorted truthy/falsy API representations into a plain "Yes"/"No" display. */
const formatYesNoValue = (value) => {
  if (value === true || value === 1) return "Yes";
  if (value === false || value === 0) return "No";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "1"].includes(normalized)) return "Yes";
    if (["no", "false", "0"].includes(normalized)) return "No";
  }
  return "";
};

/** Reads previously-saved DA tab values for a card. Returns null when nothing is stored. */
const loadSavedState = (cardId) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${cardId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const DOT = {
  yellow: "#f2c94c",
  gray: "#9aa0a6",
  blue: "#3b82f6",
  indigo: "#4338ca",
  green: "#27ae60",
  red: "#eb5757",
  orange: "#f2994a",
  purple: "#9b51e0",
  slate: "#64748b",
  outline: "#cbd5e1",
};

// ---- Field primitives -------------------------------------------------

function DAField({ label, color, full = false, children }) {
  return (
    <div className={`da-field${full ? " da-field--full" : ""}`}>
      <div className="da-field-label">
        <span className="da-field-dot" style={{ backgroundColor: color }} aria-hidden />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

DAField.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  full: PropTypes.bool,
  children: PropTypes.node,
};

function DATextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      className="da-field-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

DATextInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  type: PropTypes.string,
};

function DANumberField({ value, onChange, unit, placeholder }) {
  return (
    <div className="da-field-inline-row">
      <input
        type="number"
        className="da-field-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit ? <span className="da-field-unit">{unit}</span> : null}
    </div>
  );
}

DANumberField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  unit: PropTypes.string,
  placeholder: PropTypes.string,
};

function DADateTimeField({ date, time, onDateChange, onTimeChange, showTime = true }) {
  return (
    <div className="da-field-inline-row">
      <input type="date" className="da-field-input" value={date} onChange={(e) => onDateChange(e.target.value)} />
      {showTime ? (
        <input
          type="time"
          className="da-field-input da-field-input--time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

DADateTimeField.propTypes = {
  date: PropTypes.string,
  time: PropTypes.string,
  onDateChange: PropTypes.func.isRequired,
  onTimeChange: PropTypes.func,
  showTime: PropTypes.bool,
};

function DAFileField({ files, onAddFiles, onRemoveFile, multiple = true }) {
  const inputRef = useRef(null);
  const handleFiles = (fileList) => {
    const selected = Array.from(fileList || []);
    if (selected.length) onAddFiles(selected);
  };

  return (
    <div className="da-field-file">
      {files.length > 0 && (
        <div className="da-file-chip-list">
          {files.map((file, index) => (
            <div className="da-file-chip" key={`${file.name}-${index}`}>
              <span className="da-file-chip-icon" aria-hidden>
                <FiFile size={14} />
              </span>
              <span className="da-file-chip-name" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className="da-file-chip-remove"
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <FiX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className="da-file-dropzone"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        Drag files here or Click to upload
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

DAFileField.propTypes = {
  files: PropTypes.array.isRequired,
  onAddFiles: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
  multiple: PropTypes.bool,
};

function DATextInputWithUpload({ value, onChange, placeholder, files, onAddFiles, onRemoveFile }) {
  const inputRef = useRef(null);
  const handleFiles = (fileList) => {
    const selected = Array.from(fileList || []);
    if (selected.length) onAddFiles(selected);
  };

  return (
    <div className="da-field-file">
      <div className="da-input-upload-wrap">
        <input
          type="text"
          className="da-field-input da-field-input--with-upload"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="da-input-upload-btn"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload file"
          title="Upload file"
        >
          <FiPaperclip size={15} />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="da-file-chip-list">
          {files.map((file, index) => (
            <div className="da-file-chip" key={`${file.name}-${index}`}>
              <span className="da-file-chip-icon" aria-hidden>
                <FiFile size={14} />
              </span>
              <span className="da-file-chip-name" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className="da-file-chip-remove"
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <FiX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

DATextInputWithUpload.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  files: PropTypes.array.isRequired,
  onAddFiles: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
};

function DABillingEntityField({ autoValue, otherValue, onOtherChange }) {
  return (
    <div className="da-field-inline-row da-field-inline-row--wrap">
      <div className="da-billing-box">
        <span className="da-billing-box-label">Billing Entity</span>
        <input
          type="text"
          className="da-field-input"
          value={autoValue || ""}
          placeholder="Auto-filled from card"
          readOnly
        />
      </div>
      <div className="da-billing-box">
        <span className="da-billing-box-label">Others</span>
        <input
          type="text"
          className="da-field-input"
          placeholder="Other billing entity"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      </div>
    </div>
  );
}

DABillingEntityField.propTypes = {
  autoValue: PropTypes.string,
  otherValue: PropTypes.string,
  onOtherChange: PropTypes.func.isRequired,
};

const DA_SECTION_TABS = [
  { key: "summary", label: "Summary" },
  { key: "card", label: "Card" },
  { key: "appointment", label: "Appointment & Clearance" },
  { key: "mwp", label: "MWP & Launch Hire" },
  { key: "clearanceCopies", label: "Clearance Copies" },
  { key: "invoices", label: "Invoices, Fees & Certificates" },
  { key: "billing", label: "Billing & Cargo" },
  { key: "vessel", label: "Vessel & Sales Order" },
];

function DASectionTabBar({ activeKey, onChange }) {
  return (
    <div className="da-section-tabbar" role="tablist">
      {DA_SECTION_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeKey === tab.key}
          className={`da-section-tab${activeKey === tab.key ? " da-section-tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

DASectionTabBar.propTypes = {
  activeKey: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function DASection({ title, children }) {
  return (
    <div className="da-section">
      <h4 className="da-section-title">{title}</h4>
      <div className="da-section-grid">{children}</div>
    </div>
  );
}

DASection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

// ---- Summary --------------------------------------------------------------

const formatSummaryValue = (value) => {
  if (value === null || value === undefined) return "—";
  const trimmed = String(value).trim();
  return trimmed === "" ? "—" : trimmed;
};

function DASummaryRow({ label, value, files }) {
  const displayValue = files
    ? (files.length ? files.map((file) => file.name).join(", ") : "No file uploaded")
    : formatSummaryValue(value);

  return (
    <div className="da-summary-row">
      <span className="da-summary-row-label">{label}</span>
      <span className="da-summary-row-value">{displayValue}</span>
    </div>
  );
}

DASummaryRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  files: PropTypes.array,
};

function DASummaryGroup({ title, rows }) {
  return (
    <div className="da-summary-group">
      <h5 className="da-summary-group-title">{title}</h5>
      <div className="da-summary-group-rows">
        {rows.map((row) => (
          <DASummaryRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

DASummaryGroup.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.array.isRequired,
};

function DASummarySection({ fields, files, cardBillingEntity, cardMwpIssuedBySedres }) {
  const groups = [
    {
      title: "Card",
      rows: [
        { label: "Owner", value: fields.owner },
        { label: "Co-owners", value: fields.coOwners },
        { label: "Deadline", value: fields.deadline },
        { label: "Size", value: fields.size },
        { label: "Tags", value: fields.tags },
        { label: "Custom card ID", value: fields.customCardId },
        { label: "Last moved", value: fields.lastMoved },
      ],
    },
    {
      title: "Appointment & Clearance",
      rows: [
        { label: "SRT|PO|WBS", value: fields.srtPoWbs },
        { label: "Tax Invoice", value: fields.taxInvoice },
        { label: "Tax Invoice Copy", files: files.taxInvoiceCopy },
        { label: "Appointment Email", files: files.appointmentEmail },
        {
          label: "Inward Clearance date",
          value: [fields.inwardClearanceDate, fields.inwardClearanceTime].filter(Boolean).join(" "),
        },
        { label: "No. of Immigration Crew", value: fields.noOfImmigrationCrew },
        { label: "Arrival procedure copy", files: files.arrivalProcedureCopy },
        { label: "Crew Immigration Clearance Copy", files: files.crewImmigrationClearanceCopy },
      ],
    },
    {
      title: "MWP & Launch Hire",
      rows: [
        { label: "MWP (issued by Sedres)", value: formatYesNoValue(cardMwpIssuedBySedres) },
        {
          label: "Outward Clearance Date",
          value: [fields.outwardClearanceDate, fields.outwardClearanceTime].filter(Boolean).join(" "),
        },
        { label: "No. of Launch hire trips", value: fields.noOfLaunchHireTrips },
        { label: "Road Transport", value: fields.roadTransport },
        { label: "3rd Party Launch hire (If any)", value: fields.thirdPartyLaunchHire },
        { label: "Penalty (If any)", value: fields.penalty },
        { label: "Launch Hire Slips", files: files.launchHireSlips },
        { label: "Total Onsigners", value: fields.totalOnsigners },
        { label: "Total Offsigners", value: fields.totalOffsigners },
        { label: "ZAWIL PASS COPY", files: files.zawilPassCopy },
      ],
    },
    {
      title: "Clearance Copies",
      rows: [
        { label: "Vessel Import Bayan", files: files.vesselImportBayan },
        { label: "MWP COPY", files: files.mwpCopy },
        { label: "Sailing Clearance Copy", files: files.sailingClearanceCopy },
        { label: "Inward Clearance Copy", files: files.inwardClearanceCopy },
        { label: "CG PERMIT COPY", files: files.cgPermitCopy },
        { label: "Crew Summary sheet", files: files.crewSummarySheet },
      ],
    },
    {
      title: "Invoices, Fees & Certificates",
      rows: [
        { label: "Mawani Invoice - Arrival Dues", files: files.mawaniInvoiceArrivalDues },
        { label: "Mawani Anchorage Invoice", files: files.mawaniAnchorageInvoice },
        { label: "Saber Fees", files: files.saberFees },
        { label: "Saber Certificate", files: files.saberCertificate },
        { label: "3rd Party Items", value: fields.thirdPartyItems },
        { label: "Supporting Documents", files: files.supportingDocuments },
        { label: "FDA Dispatch Proof", files: files.fdaDispatchProof },
      ],
    },
    {
      title: "Billing & Cargo",
      rows: [
        { label: "Billing Entity", value: cardBillingEntity },
        { label: "Billing Entity (Other)", value: fields.billingEntityOther },
        { label: "Hotel Invoice", files: files.hotelInvoice },
        { label: "No of cargo bayans", value: fields.cargoBayanCount },
        { label: "Operations completion date", value: fields.operationsCompletionDate },
        { label: "Invoice amount (Including VAT)", value: fields.invoiceAmount },
        { label: "Cargo bayan copy", files: files.cargoBayanCopy },
      ],
    },
    {
      title: "Vessel & Sales Order",
      rows: [
        { label: "Vessel Name", value: fields.vesselName },
        { label: "SAP Sales Order No", value: fields.sapSalesOrderNo },
        { label: "Service requester", value: fields.serviceRequester },
        { label: "Copy of Sales order", files: files.copyOfSalesOrder },
      ],
    },
  ];

  return (
    <div className="da-summary">
      {groups.map((group) => (
        <DASummaryGroup key={group.title} title={group.title} rows={group.rows} />
      ))}
    </div>
  );
}

DASummarySection.propTypes = {
  fields: PropTypes.object.isRequired,
  files: PropTypes.object.isRequired,
  cardBillingEntity: PropTypes.string,
  cardMwpIssuedBySedres: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number]),
};

// ---- Main tab -----------------------------------------------------------

const EMPTY_FILES = {
  taxInvoiceCopy: [],
  appointmentEmail: [],
  arrivalProcedureCopy: [],
  crewImmigrationClearanceCopy: [],
  launchHireSlips: [],
  zawilPassCopy: [],
  vesselImportBayan: [],
  mwpCopy: [],
  sailingClearanceCopy: [],
  inwardClearanceCopy: [],
  cgPermitCopy: [],
  crewSummarySheet: [],
  mawaniInvoiceArrivalDues: [],
  mawaniAnchorageInvoice: [],
  saberFees: [],
  saberCertificate: [],
  supportingDocuments: [],
  fdaDispatchProof: [],
  hotelInvoice: [],
  cargoBayanCopy: [],
  copyOfSalesOrder: [],
};

// Pre-filled defaults for demo/test cards (keyed by card id) — shown until the
// user's own edits exist in localStorage, at which point those take over.
const OFFSHORE_CAT_SEED = {
  fields: {
    owner: "Rejeesh Krishnan",
    coOwners: "Sudan",
    lastMoved: "2026-07-21 13:09:36",
    taxInvoice: "2026-1081913",
    noOfLaunchHireTrips: "2",
    billingEntityOther: "Zamil Offshore",
    operationsCompletionDate: "2026-07-10",
    invoiceAmount: "4600.00",
    vesselName: "OFFSHORE CAT",
    sapSalesOrderNo: "3036435",
  },
  files: {
    appointmentEmail: [{ name: "LHS 207931, 207933.pdf" }],
    fdaDispatchProof: [{ name: "Invoice Submission - 2026-1081913.msg" }],
    copyOfSalesOrder: [
      { name: "3036435.pdf" },
      { name: "PR-204542.pdf" },
      { name: "PO_125045_0.pdf" },
    ],
  },
};

const ZAKHER_MARINE_SEED = {
  fields: {
    owner: "Nadir",
    coOwners: "Sudan",
    lastMoved: "2026-07-21 16:28:27",
    taxInvoice: "2026-1081258",
    billingEntityOther: "Zakher Marine Saudi",
    operationsCompletionDate: "2026-07-07",
    invoiceAmount: "1840.00",
    vesselName: "04 Vessels",
    sapSalesOrderNo: "3036354",
    serviceRequester: "Abdelkader Nasser",
  },
  files: {
    appointmentEmail: [{ name: "Email.pdf" }],
    supportingDocuments: [
      { name: "Summary Sheet.pdf" },
      { name: "ZMS - Jun 26 On-station.xlsx" },
    ],
    fdaDispatchProof: [
      { name: "2026-1081261.png" },
      { name: "2026-1081258.png" },
      { name: "2026-1081259.png" },
      { name: "2026-1081260.png" },
    ],
  },
};

const ASTRO_3303_SEED = {
  fields: {
    owner: "sahil.ali",
    coOwners: "Shibili",
    lastMoved: "2026-07-22 10:21:41",
    taxInvoice: "2026-1081937",
    srtPoWbs: "7400078821",
    totalOnsigners: "0",
    totalOffsigners: "0",
    billingEntityOther: "Larsen & Tubro",
    invoiceAmount: "10361.50",
    vesselName: "ASTRO 3303",
    sapSalesOrderNo: "3035294",
    serviceRequester: "SIVA",
  },
  files: {
    appointmentEmail: [
      { name: "REQUEST EMAIL FOR 2 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 4 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR TPT.pdf" },
      { name: "REQUEST EMAIL FOR 1 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 2 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 2 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 1 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 1 ZAWIL.pdf" },
      { name: "REQUEST FOR 1 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 3 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 1 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 1 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 3 ZAWIL.pdf" },
      { name: "REQUEST EMAIL FOR 9 ZAWIL.pdf" },
    ],
    zawilPassCopy: [
      { name: "JAMES Permit-6810474.pdf" },
      { name: "MAECIEJ Permit-6810468.pdf" },
      { name: "NADIM Permit-6831806.pdf" },
      { name: "SAMRAT Permit-6831253.pdf" },
      { name: "AVINASH Permit-6831267.pdf" },
      { name: "ISHAN Permit-6831229.pdf" },
      { name: "SIVA Permit-6831203.pdf" },
      { name: "TEMITOPE Permit-6850440.pdf" },
      { name: "JAMES Permit-6882561.pdf" },
      { name: "MACIEJ Permit-6882540.pdf" },
      { name: "ADEEL Permit-6873608.pdf" },
      { name: "SIVA Permit-6873618.pdf" },
      { name: "RAMEES Permit-6883253.pdf" },
      { name: "AYMEN Permit-6895236.pdf" },
      { name: "DMYTRO Permit-6918573.pdf" },
      { name: "JAMES Permit-6918682.pdf" },
      { name: "MACIEJ Permit-6918707.pdf" },
      { name: "ATTIQUE Permit-6965739.pdf" },
      { name: "RAVI- Permit 6966276.pdf" },
      { name: "SHOEB Permit-6963144.pdf" },
      { name: "SIVA Permit-6963202.pdf" },
      { name: "VATSAL Permit-6963170.pdf" },
      { name: "MIDHILAJ PERMIT-7015955.pdf" },
      { name: "ADEL PERMIT-7016033.pdf" },
      { name: "ARSALAN PERMIT-7016006.pdf" },
      { name: "DINESH PERMIT-7016127.pdf" },
      { name: "HABEEB PERMIT-7016157.pdf" },
      { name: "HEMAND PERMIT-7016140.pdf" },
      { name: "JESSIE PERMIT-7015831.pdf" },
      { name: "KAMLESH PERMIT-7016058.pdf" },
    ],
    crewSummarySheet: [{ name: "SO-3035294 WITH SUMMARY SHEETS.pdf" }],
    supportingDocuments: [
      { name: "SENT EMAIL FOR 2 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR TPT.pdf" },
      { name: "SENT EMAIL FOR 4 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR TPT COMPLETION.pdf" },
      { name: "SENT EMAIL FOR 1 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR TPT COMPLETION REQUEST WAS SENT ON WHATS APP GROUP.pdf" },
      { name: "SENT EMAIL FOR 2 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 2 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 1 ZAWIL.pdf" },
      { name: "EMAIL SENT WITH 1 ZAWIL.pdf" },
      { name: "EMAIL SENT WITH 1 ZAWIL.pdf" },
      { name: "TPT COMPLETED.pdf" },
      { name: "SENT EMAIL FOR 3 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 1 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 1 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 3 ZAWIL.pdf" },
      { name: "SENT EMAIL FOR 9 ZAWIL.pdf" },
      { name: "ASTRO 3303 (HUSBANDRY) - WCC FROM 11.06.2026 TO 10.07.2026.pdf" },
    ],
    fdaDispatchProof: [{ name: "SAP Business Network Supplier1081937.pdf" }],
  },
};

const NLP_JACKSON_SEED = {
  fields: {
    owner: "Fatimah",
    coOwners: "Shibili",
    lastMoved: "2025-10-13 10:45:29",
    taxInvoice: "2025-1053643",
    outwardClearanceDate: "2025-08-20",
    outwardClearanceTime: "01:00",
    billingEntityOther: "Snamprogetti",
    operationsCompletionDate: "2025-08-20",
    invoiceAmount: "1495.00",
    vesselName: "NLP JACKSON",
    sapSalesOrderNo: "3023421",
    serviceRequester: "AKSHAY JUVEKAR",
  },
  files: {
    sailingClearanceCopy: [{ name: "NLP Jackson Outward Clearance.pdf" }],
    inwardClearanceCopy: [{ name: "NLP Jackson - Inward - 03.07.2025.pdf" }],
    supportingDocuments: [{ name: "OUTWARD MAIL.pdf" }, { name: "RFS MAIL.pdf" }],
    fdaDispatchProof: [{ name: "Invoice Approval as on 05_10_2025.msg" }],
  },
};

const SAIPEM_SEED = {
  fields: {
    owner: "Nadir",
    coOwners: "Shibili",
    lastMoved: "2025-09-18 10:32:34",
    taxInvoice: "2025-1051828",
    billingEntityOther: "Snamprogetti",
    operationsCompletionDate: "2025-08-18",
    invoiceAmount: "22080.00",
    vesselName: "32",
    sapSalesOrderNo: "3023092",
    serviceRequester: "Caballes Jeoffrey Alojado",
  },
  files: {
    appointmentEmail: [{ name: "Jul 25 - Email.pdf" }],
    supportingDocuments: [{ name: "Saipem Jul 25 Onstation.xlsx" }],
    fdaDispatchProof: [{ name: "Invoice Approval as on 08_09_2025.msg" }],
  },
};

const MOSSALEM_TIDE_SEED = {
  fields: {
    owner: "Mifzalmanna",
    coOwners: "Shibili",
    lastMoved: "2025-08-17 12:31:37",
    taxInvoice: "2024-1030411",
    srtPoWbs: "WBS LTA-124/CCC H02800 CBCYTCOVST2",
    inwardClearanceDate: "2024-11-24",
    inwardClearanceTime: "01:00",
    noOfImmigrationCrew: "13",
    outwardClearanceDate: "2024-12-19",
    outwardClearanceTime: "01:00",
    noOfLaunchHireTrips: "4",
    roadTransport: "27",
    billingEntityOther: "Snamprogetti",
    operationsCompletionDate: "2024-12-19",
    invoiceAmount: "34865.01",
    vesselName: "Mossalem Tide",
    sapSalesOrderNo: "3011566",
    serviceRequester: "Alan",
  },
  files: {
    appointmentEmail: [
      { name: "Mossalem TIDE __ From Ras Tanura to Aramco Field __ 19 DEC 24.msg" },
      { name: "RE_ MOSSALEM TIDE + S47 Call at Ras Tanura_ KSA - Pre-arrival Documents .msg" },
    ],
    crewImmigrationClearanceCopy: [{ name: "Crew Immigration.pdf" }],
    launchHireSlips: [{ name: "Launch Hire.pdf" }],
    vesselImportBayan: [{ name: "final bayan 1170.pdf" }, { name: "final bayan 1169.pdf" }],
    mwpCopy: [{ name: "MOSSALEM TIDE - MWP 31.12.2024 ( ISSUED 26.11.2024 ).pdf" }],
    sailingClearanceCopy: [{ name: "MOSSALEM TIDE PC - OUTWARD - ARAMCO FILED 19.12.2024.pdf" }],
    inwardClearanceCopy: [{ name: "Inward clearance-Mossalem Tide .pdf" }],
    mawaniInvoiceArrivalDues: [{ name: "23756.pdf" }],
    mawaniAnchorageInvoice: [{ name: "23582.pdf" }],
    fdaDispatchProof: [
      { name: "Invoice Approval as on 03_02_2025.msg" },
      { name: "Service Entry Request - 2025-Batch-7-Marine-Crew change-MWP-(Ras Tanura).msg" },
    ],
  },
};

const SK_MARQUEE_SEED = {
  fields: {
    owner: "Murtuja Shaikh",
    coOwners: "Salman",
    lastMoved: "2025-11-28 21:35:50",
    taxInvoice: "2025-1065480",
    totalOnsigners: "0",
    totalOffsigners: "0",
    billingEntityOther: "Lamprell-AlGihaz",
    operationsCompletionDate: "2025-10-16",
    invoiceAmount: "20930.00",
    sapSalesOrderNo: "3025797",
    serviceRequester: "SHUAIB",
  },
  files: {
    appointmentEmail: [
      { name: "Fw_Transportation PC_PE for POHI Cargo BArge Aesen 3303 @ RT 7.msg" },
      { name: "RE_Transportation PC_PE for POHI Cargo Barge Aesen 3303 @ RT 7-09_10_25.msg" },
      { name: "RE_Transportation PC_PE for OHI Cargo Barge AESEN 3303 @ RT Freighter Anchorage.msg" },
      { name: "Re_Transportation PC_PE for Follow up COR OHI SK MARQUEE @ RT Freighter Anchorage.msg" },
    ],
    launchHireSlips: [{ name: "SK Marquee LH.pdf" }],
    crewSummarySheet: [{ name: "3025797...pdf" }],
    copyOfSalesOrder: [{ name: "2025-1065480.pdf" }, { name: "3025797.pdf" }],
  },
};

const RT_SK_MARQUEE_SEED = {
  fields: {
    owner: "Murtuja Shaikh",
    coOwners: "Salman",
    lastMoved: "2025-11-28 21:00:49",
    totalOnsigners: "0",
    totalOffsigners: "0",
    billingEntityOther: "Lamprell-AlGihaz",
    operationsCompletionDate: "2025-10-16",
    vesselName: "SK MARQUEE",
    sapSalesOrderNo: "3025724",
    serviceRequester: "TAUSIF",
  },
  files: {
    appointmentEmail: [{ name: "Re_ Spares for AESEN 3303.msg" }],
    launchHireSlips: [{ name: "LH SK MARQUEE.pdf" }],
    crewSummarySheet: [{ name: "3025724.pdf" }],
    supportingDocuments: [{ name: "27562.pdf" }],
  },
};

const SEED_DATA = {
  "da-test-dispatched-card": OFFSHORE_CAT_SEED,
  "da-test-dispatched-card-2": ZAKHER_MARINE_SEED,
  "da-test-dispatched-card-3": ASTRO_3303_SEED,
  "da-test-finalized-card-1": SAIPEM_SEED,
  "da-test-finalized-card-2": MOSSALEM_TIDE_SEED,
  "da-test-finalized-card-3": NLP_JACKSON_SEED,
  "da-test-algihaz-card-1": SK_MARQUEE_SEED,
  "da-test-algihaz-card-2": RT_SK_MARQUEE_SEED,
};

export default function DATabDetails({ cardId, cardBillingEntity, cardMwpIssuedBySedres }) {
  const [activeSectionTab, setActiveSectionTab] = useState("card");
  const storageId = cardId != null && String(cardId).trim() !== "" ? String(cardId).trim() : "unknown-card";
  const seed = SEED_DATA[storageId] || null;
  const savedRef = useRef(null);
  if (savedRef.current === null) {
    savedRef.current = loadSavedState(storageId) || {};
  }
  const saved = savedRef.current;

  const [fields, setFields] = useState({ ...EMPTY_FIELDS, ...(seed?.fields || {}), ...(saved.fields || {}) });
  // Only accept saved file-list entries that are arrays of { name } objects —
  // older/partial localStorage data (from earlier iterations of this tab) could
  // otherwise hand a bad value to a file field and silently break its render.
  const sanitizedSavedFiles = Object.fromEntries(
    Object.entries(saved.files || {})
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [
        key,
        value.filter((item) => item && typeof item.name === "string"),
      ])
  );
  const [files, setFiles] = useState({ ...EMPTY_FILES, ...(seed?.files || {}), ...sanitizedSavedFiles });
  const [lastSavedAt, setLastSavedAt] = useState(saved.savedAt || null);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const savedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${storageId}`,
        JSON.stringify({ fields, files, savedAt })
      );
      setLastSavedAt(savedAt);
    } catch {
      // localStorage unavailable (private mode / quota) — edits stay in memory only.
    }
  }, [fields, files, storageId]);

  const setField = (key) => (value) => setFields((prev) => ({ ...prev, [key]: value }));

  // Files aren't uploaded anywhere yet, so only the name is kept — that's also
  // all that's needed to persist to localStorage (a raw File can't be serialized).
  const addFiles = (key) => (newFiles) =>
    setFiles((prev) => ({
      ...prev,
      [key]: [...prev[key], ...newFiles.map((file) => ({ name: file.name }))],
    }));

  const removeFile = (key) => (index) =>
    setFiles((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  return (
    <div className="da-tab-details">
      <div className="da-autosave-status">
        {lastSavedAt
          ? `Saved locally · ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Not saved yet — changes save automatically to this browser"}
      </div>
      <DASectionTabBar activeKey={activeSectionTab} onChange={setActiveSectionTab} />
      {activeSectionTab === "card" && (
      <DASection title="Card">
        <DAField label="Owner" color={DOT.gray}>
          <DATextInput value={fields.owner} onChange={setField("owner")} placeholder="Assign owner" />
        </DAField>
        <DAField label="Co-owners" color={DOT.gray}>
          <DATextInput value={fields.coOwners} onChange={setField("coOwners")} placeholder="Add co-owners" />
        </DAField>
        <DAField label="Deadline" color={DOT.gray}>
          <DATextInput type="date" value={fields.deadline} onChange={setField("deadline")} />
        </DAField>
        <DAField label="Size" color={DOT.gray}>
          <DATextInput value={fields.size} onChange={setField("size")} placeholder="e.g. M" />
        </DAField>
        <DAField label="Tags" color={DOT.gray}>
          <DATextInput value={fields.tags} onChange={setField("tags")} placeholder="Add tags" />
        </DAField>
        <DAField label="Custom card ID" color={DOT.gray}>
          <DATextInput value={fields.customCardId} onChange={setField("customCardId")} placeholder="e.g. DA-2026-001" />
        </DAField>
        <DAField label="Last moved" color={DOT.gray}>
          <DATextInput value={fields.lastMoved} onChange={setField("lastMoved")} placeholder="e.g. 2026-07-21 13:09:36" />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "appointment" && (
      <DASection title="Appointment & Clearance">
        <DAField label="SRT|PO|WBS" color={DOT.yellow}>
          <DATextInput value={fields.srtPoWbs} onChange={setField("srtPoWbs")} placeholder="SRT / PO / WBS no." />
        </DAField>
        <DAField label="Tax Invoice" color={DOT.green}>
          <DATextInputWithUpload
            value={fields.taxInvoice}
            onChange={setField("taxInvoice")}
            placeholder="Invoice no."
            files={files.taxInvoiceCopy}
            onAddFiles={addFiles("taxInvoiceCopy")}
            onRemoveFile={removeFile("taxInvoiceCopy")}
          />
        </DAField>
        <DAField label="Appointment Email" color={DOT.gray} full>
          <DAFileField files={files.appointmentEmail} onAddFiles={addFiles("appointmentEmail")} onRemoveFile={removeFile("appointmentEmail")} />
        </DAField>
        <DAField label="Inward Clearance date" color={DOT.gray}>
          <DADateTimeField
            date={fields.inwardClearanceDate}
            time={fields.inwardClearanceTime}
            onDateChange={setField("inwardClearanceDate")}
            onTimeChange={setField("inwardClearanceTime")}
          />
        </DAField>
        <DAField label="No. of Immigration Crew" color={DOT.blue}>
          <DANumberField value={fields.noOfImmigrationCrew} onChange={setField("noOfImmigrationCrew")} unit="Crew" placeholder="e.g. 12" />
        </DAField>
        <DAField label="Arrival procedure copy" color={DOT.blue}>
          <DAFileField files={files.arrivalProcedureCopy} onAddFiles={addFiles("arrivalProcedureCopy")} onRemoveFile={removeFile("arrivalProcedureCopy")} />
        </DAField>
        <DAField label="Crew Immigration Clearance Copy" color={DOT.blue}>
          <DAFileField
            files={files.crewImmigrationClearanceCopy}
            onAddFiles={addFiles("crewImmigrationClearanceCopy")}
            onRemoveFile={removeFile("crewImmigrationClearanceCopy")}
          />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "mwp" && (
      <DASection title="MWP & Launch Hire">
        <DAField label="MWP (issued by Sedres)" color={DOT.blue}>
          <input
            type="text"
            className="da-field-input"
            value={formatYesNoValue(cardMwpIssuedBySedres)}
            placeholder="Auto-filled from card"
            readOnly
          />
        </DAField>
        <DAField label="Outward Clearance Date" color={DOT.blue}>
          <DADateTimeField
            date={fields.outwardClearanceDate}
            time={fields.outwardClearanceTime}
            onDateChange={setField("outwardClearanceDate")}
            onTimeChange={setField("outwardClearanceTime")}
          />
        </DAField>
        <DAField label="No. of Launch hire trips" color={DOT.blue}>
          <DANumberField value={fields.noOfLaunchHireTrips} onChange={setField("noOfLaunchHireTrips")} unit="Trips" placeholder="e.g. 2" />
        </DAField>
        <DAField label="Road Transport" color={DOT.blue}>
          <DANumberField value={fields.roadTransport} onChange={setField("roadTransport")} unit="DAYS" placeholder="e.g. 1" />
        </DAField>
        <DAField label="3rd Party Launch hire (If any)" color={DOT.blue}>
          <DATextInput value={fields.thirdPartyLaunchHire} onChange={setField("thirdPartyLaunchHire")} placeholder="Enter details" />
        </DAField>
        <DAField label="Penalty (If any)" color={DOT.blue}>
          <DATextInput value={fields.penalty} onChange={setField("penalty")} placeholder="Enter penalty amount" />
        </DAField>
        <DAField label="Launch Hire Slips" color={DOT.blue}>
          <DAFileField files={files.launchHireSlips} onAddFiles={addFiles("launchHireSlips")} onRemoveFile={removeFile("launchHireSlips")} />
        </DAField>
        <DAField label="ZAWIL PASS COPY" color={DOT.orange}>
          <DAFileField files={files.zawilPassCopy} onAddFiles={addFiles("zawilPassCopy")} onRemoveFile={removeFile("zawilPassCopy")} />
        </DAField>
        <DAField label="Total Onsigners" color={DOT.orange}>
          <DANumberField value={fields.totalOnsigners} onChange={setField("totalOnsigners")} unit="Crew" placeholder="e.g. 4" />
        </DAField>
        <DAField label="Total Offsigners" color={DOT.orange}>
          <DANumberField value={fields.totalOffsigners} onChange={setField("totalOffsigners")} unit="Crew" placeholder="e.g. 4" />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "clearanceCopies" && (
      <DASection title="Clearance Copies">
        <DAField label="Vessel Import Bayan" color={DOT.indigo}>
          <DAFileField files={files.vesselImportBayan} onAddFiles={addFiles("vesselImportBayan")} onRemoveFile={removeFile("vesselImportBayan")} />
        </DAField>
        <DAField label="MWP COPY" color={DOT.indigo}>
          <DAFileField files={files.mwpCopy} onAddFiles={addFiles("mwpCopy")} onRemoveFile={removeFile("mwpCopy")} />
        </DAField>
        <DAField label="Sailing Clearance Copy" color={DOT.indigo}>
          <DAFileField files={files.sailingClearanceCopy} onAddFiles={addFiles("sailingClearanceCopy")} onRemoveFile={removeFile("sailingClearanceCopy")} />
        </DAField>
        <DAField label="Inward Clearance Copy" color={DOT.indigo}>
          <DAFileField files={files.inwardClearanceCopy} onAddFiles={addFiles("inwardClearanceCopy")} onRemoveFile={removeFile("inwardClearanceCopy")} />
        </DAField>
        <DAField label="CG PERMIT COPY" color={DOT.orange}>
          <DAFileField files={files.cgPermitCopy} onAddFiles={addFiles("cgPermitCopy")} onRemoveFile={removeFile("cgPermitCopy")} />
        </DAField>
        <DAField label="Crew Summary sheet" color={DOT.green}>
          <DAFileField files={files.crewSummarySheet} onAddFiles={addFiles("crewSummarySheet")} onRemoveFile={removeFile("crewSummarySheet")} />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "invoices" && (
      <DASection title="Invoices, Fees & Certificates">
        <DAField label="Mawani Invoice - Arrival Dues" color={DOT.green}>
          <DAFileField files={files.mawaniInvoiceArrivalDues} onAddFiles={addFiles("mawaniInvoiceArrivalDues")} onRemoveFile={removeFile("mawaniInvoiceArrivalDues")} />
        </DAField>
        <DAField label="Mawani Anchorage Invoice" color={DOT.green}>
          <DAFileField files={files.mawaniAnchorageInvoice} onAddFiles={addFiles("mawaniAnchorageInvoice")} onRemoveFile={removeFile("mawaniAnchorageInvoice")} />
        </DAField>
        <DAField label="Saber Fees" color={DOT.green}>
          <DAFileField files={files.saberFees} onAddFiles={addFiles("saberFees")} onRemoveFile={removeFile("saberFees")} />
        </DAField>
        <DAField label="Saber Certificate" color={DOT.green}>
          <DAFileField files={files.saberCertificate} onAddFiles={addFiles("saberCertificate")} onRemoveFile={removeFile("saberCertificate")} />
        </DAField>
        <DAField label="FDA Dispatch Proof" color={DOT.yellow}>
          <DAFileField files={files.fdaDispatchProof} onAddFiles={addFiles("fdaDispatchProof")} onRemoveFile={removeFile("fdaDispatchProof")} />
        </DAField>
        <DAField label="SUPPORTING DOCUMENTS" color={DOT.red}>
          <DAFileField files={files.supportingDocuments} onAddFiles={addFiles("supportingDocuments")} onRemoveFile={removeFile("supportingDocuments")} />
        </DAField>
        <DAField label="3rd Party Items" color={DOT.orange}>
          <DATextInput value={fields.thirdPartyItems} onChange={setField("thirdPartyItems")} placeholder="Enter details" />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "billing" && (
      <DASection title="Billing & Cargo">
        <DAField label="Billing Entity" color={DOT.gray} full>
          <DABillingEntityField
            autoValue={cardBillingEntity}
            otherValue={fields.billingEntityOther}
            onOtherChange={setField("billingEntityOther")}
          />
        </DAField>
        <DAField label="Hotel Invoice" color={DOT.orange}>
          <DAFileField files={files.hotelInvoice} onAddFiles={addFiles("hotelInvoice")} onRemoveFile={removeFile("hotelInvoice")} />
        </DAField>
        <DAField label="Cargo bayan copy" color={DOT.orange}>
          <DAFileField files={files.cargoBayanCopy} onAddFiles={addFiles("cargoBayanCopy")} onRemoveFile={removeFile("cargoBayanCopy")} />
        </DAField>
        <DAField label="No of cargo bayans" color={DOT.orange}>
          <DANumberField value={fields.cargoBayanCount} onChange={setField("cargoBayanCount")} placeholder="e.g. 3" />
        </DAField>
        <DAField label="Operations completion date" color={DOT.red}>
          <DADateTimeField date={fields.operationsCompletionDate} onDateChange={setField("operationsCompletionDate")} showTime={false} />
        </DAField>
        <DAField label="Invoice amount (Including VAT)" color={DOT.slate}>
          <DATextInput value={fields.invoiceAmount} onChange={setField("invoiceAmount")} placeholder="SAR" />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "vessel" && (
      <DASection title="Vessel & Sales Order">
        <DAField label="VESSEL NAME" color={DOT.red}>
          <DATextInput value={fields.vesselName} onChange={setField("vesselName")} />
        </DAField>
        <DAField label="SAP Sales Order No" color={DOT.outline}>
          <DATextInput value={fields.sapSalesOrderNo} onChange={setField("sapSalesOrderNo")} />
        </DAField>
        <DAField label="Service requester" color={DOT.purple}>
          <DATextInput value={fields.serviceRequester} onChange={setField("serviceRequester")} />
        </DAField>
        <DAField label="Copy of Sales order" color={DOT.green}>
          <DAFileField files={files.copyOfSalesOrder} onAddFiles={addFiles("copyOfSalesOrder")} onRemoveFile={removeFile("copyOfSalesOrder")} />
        </DAField>
      </DASection>
      )}

      {activeSectionTab === "summary" && (
      <div className="da-section">
        <h4 className="da-section-title">Summary</h4>
        <DASummarySection
          fields={fields}
          files={files}
          cardBillingEntity={cardBillingEntity}
          cardMwpIssuedBySedres={cardMwpIssuedBySedres}
        />
      </div>
      )}
    </div>
  );
}

DATabDetails.propTypes = {
  cardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  cardBillingEntity: PropTypes.string,
  cardMwpIssuedBySedres: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number]),
};
