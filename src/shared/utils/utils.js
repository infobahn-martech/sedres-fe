import useAlertReducer from '../../store/AlertReducer';
import * as XLSX from 'xlsx';

export const stripHtmlTags = (value) => {
  const text = String(value ?? '');
  if (!text) return '';
  return text
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

export const getInitials = (fullName) => {
  const nameParts = fullName?.split(' ');
  if (nameParts && nameParts.length > 0) {
    const firstName = nameParts[0];
    const lastName = nameParts[1];
    const initials = (
      firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')
    ).toUpperCase();
    return initials;
  }
};

export function downloadFile({ link, fileName }) {
  if (!link) {
    const { error } = useAlertReducer.getState();
    error('Invalid link provided for download.');
    return; // Exit function if link is invalid
  }
  const url = link;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url); // Release the object URL
  document.body.removeChild(a); // Remove the anchor element
}

/* Saves a remote file under its own name. The file host is another origin, so the file is fetched as a
   blob first; while the host sends no CORS header the fetch fails, and the plain link is used instead. */
export async function downloadRemoteFile({ url, name }) {
  const fileName = name || decodeURIComponent(url.split('/').pop());
  try {
    const response = await fetch(url);
    if (response.ok) {
      downloadFile({ link: URL.createObjectURL(await response.blob()), fileName });
      return;
    }
  } catch {
    /* Falls back to the plain link below. */
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadRowsXLSX(headings, rows, fileName) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headings, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, fileName);
}

export function downloadSampleXLSX(headings, fileName) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create a new worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([headings]);

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  }

  // Convert the workbook to a blob
  const blob = new Blob(
    [s2ab(XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' }))],
    { type: 'application/octet-stream' },
  );

  // Create a download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);

  // Append the link to the document body and trigger the download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Checklist Data Structure
export const checkListData = [
  {
    id: "clearance_documents",
    title: "A) DOCUMENTS REQUIRED FOR CLEARANCE",
    items: [
      { id: "registry_certificate", label: "Registry Certificate REQUIRE COPY ONLY" },
      { id: "tonnage_certificate", label: "Tonnage Certificate REQUIRE COPY ONLY" },
      { id: "safety_equipment_certificate", label: "Safety Equipment Certificate REQUIRE COPY ONLY" },
      { id: "radio_safety_certificate", label: "Radio Safety Certificate REQUIRE COPY ONLY" },
      { id: "load_line_certificate", label: "Load Line Certificate REQUIRE COPY ONLY" },
      { id: "deratting_certificate", label: "Deratting Certificate REQUIRE COPY ONLY" },
      { id: "crew_list", label: "Crew List REQUIRE COPY ONLY" },
      { id: "passenger_list", label: "Passenger List REQUIRE COPY ONLY" },
      { id: "cargo_manifest", label: "Cargo Manifest REQUIRE COPY ONLY" },
      { id: "stores_list", label: "Stores List REQUIRE COPY ONLY" },
    ],
  },
  {
    id: "after_loading",
    title: "B) After loading complete",
    items: [
      { id: "letter_of_authorization", label: "Letter Of Authorization (To collect the BL) REQUIRE COPY ONLY" },
      { id: "bill_of_lading", label: "Bill Of Lading REQUIRE COPY ONLY" },
      { id: "commercial_invoice", label: "Commercial Invoice REQUIRE COPY ONLY" },
      { id: "packing_list", label: "Packing List REQUIRE COPY ONLY" },
      { id: "certificate_of_origin", label: "Certificate Of Origin REQUIRE COPY ONLY" },
      { id: "insurance_certificate", label: "Insurance Certificate REQUIRE COPY ONLY" },
      { id: "export_license", label: "Export License REQUIRE COPY ONLY" },
      { id: "phytosanitary_certificate", label: "Phytosanitary Certificate REQUIRE COPY ONLY" },
    ],
  },
];