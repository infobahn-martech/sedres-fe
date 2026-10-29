import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { FiChevronLeft } from "react-icons/fi";
import { notify } from "../../../../../../../components/Toaster";
import groService from "../../../../../../../services/groService";
import { groApiErrorMessage } from "./groCardUtils";
import { formatGregorianDate, formatHijriDate } from "./groArabicDate";
import { buildCrewRosterTableHtml, crewChangeRowFields, getCrewChangeCrewId } from "./crewChangePassUtils";

const SANITIZE_CONFIG = {
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
  ALLOW_DATA_ATTR: false,
};

const FALLBACK_TITLE = "CG Pass template";

const buildIssueDateString = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

/** "Bulk Upload CG Pass" sub-screen: crew details (left) + generated Arabic template preview (right). */
export default function CrewChangeCgPassGenerateView({ portId, selectedRows, onBack, onUploaded }) {
  const [templateData, setTemplateData] = useState(null);
  const [zawilNoByCrewId, setZawilNoByCrewId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!portId) return undefined;
    let cancelled = false;
    groService
      .getTemplatesByPort(portId, "CG Pass")
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data ?? res?.data ?? [];
        setTemplateData(Array.isArray(list) ? (list[0] ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) setTemplateData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [portId]);

  const rows = Array.isArray(selectedRows) ? selectedRows : [];

  const handleZawilNoChange = (crewId, value) => {
    setZawilNoByCrewId((prev) => ({ ...prev, [crewId]: value }));
  };

  const title = templateData?.template_name || FALLBACK_TITLE;
  const description = templateData?.description || "";

  const sanitizedMoreDescription = useMemo(() => {
    const rosterHtml = buildCrewRosterTableHtml(selectedRows, zawilNoByCrewId);
    const base = templateData?.more_description || "";
    return DOMPurify.sanitize(`${base}${rosterHtml}`, SANITIZE_CONFIG);
  }, [templateData, selectedRows, zawilNoByCrewId]);

  const today = new Date();
  const gregorianDate = formatGregorianDate(today);
  const hijriDate = formatHijriDate(today);

  const handleUploadCgPass = async () => {
    if (rows.length === 0) {
      notify("No crew selected.", "warn");
      return;
    }
    if (!previewRef.current) return;

    setSubmitting(true);
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output("blob");
      const issueDate = buildIssueDateString(today);
      const passNo = templateData?.template_name || "";

      await Promise.all(
        rows.map((row) => {
          const crewId = getCrewChangeCrewId(row);
          const file = new File([pdfBlob], `${title.replace(/\s+/g, "_")}_${crewId ?? ""}.pdf`, {
            type: "application/pdf",
          });
          const formData = new FormData();
          formData.append("pass_no", passNo);
          formData.append("issue_date", issueDate);
          formData.append("document_copy", file);
          formData.append("crew_id", String(crewId));
          return groService.uploadCgPass(formData);
        })
      );

      notify("CG Pass uploaded successfully.", "success");
      onUploaded();
    } catch (err) {
      notify(groApiErrorMessage(err, "Failed to generate CG Pass."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gro-crew-immigration-panel">
      <div className="gro-crew-immigration-bulk-header">
        <button type="button" className="gro-crew-immigration-bulk-back" onClick={onBack}>
          <FiChevronLeft className="gro-crew-immigration-bulk-back-icon" aria-hidden /> Back
        </button>
        <p className="gro-crew-immigration-bulk-heading">Bulk Upload CG Pass</p>
      </div>

      <div className="gro-crew-immigration-bulk-body">
        <div className="gro-crew-immigration-bulk-left">
          <p className="gro-crew-immigration-bulk-section-title">Crew Details</p>
          <div className="gro-crew-immigration-bulk-table-wrap">
            <table className="gro-crew-immigration-bulk-table">
              <thead>
                <tr>
                  <th className="gro-crew-immigration-bulk-th-sl">SI No</th>
                  <th>Crew Name</th>
                  <th>Nationality</th>
                  <th>Passport / Iqama No</th>
                  <th>Zawil No</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const f = crewChangeRowFields(row);
                  const passportIqama = [f.passport, f.iqama].filter((v) => v && v !== "-").join(" / ");
                  return (
                    <tr key={f.crewId ?? index}>
                      <td className="gro-crew-immigration-bulk-td-sl">{index + 1}</td>
                      <td>
                        <input type="text" className="gro-crew-immigration-bulk-input" value={f.crewName} readOnly />
                      </td>
                      <td>
                        <input type="text" className="gro-crew-immigration-bulk-input" value={f.nationality} readOnly />
                      </td>
                      <td>
                        <input type="text" className="gro-crew-immigration-bulk-input" value={passportIqama} readOnly />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="gro-crew-immigration-bulk-input"
                          placeholder="Zawil No"
                          value={zawilNoByCrewId[f.crewId] ?? ""}
                          onChange={(e) => handleZawilNoChange(f.crewId, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gro-crew-immigration-bulk-right">
          <p className="gro-crew-immigration-bulk-section-title">Document Preview</p>
          <div ref={previewRef} className="bulk-pass-arabic-preview" aria-label="Document preview">
            <div className="bulk-pass-arabic-paper" dir="rtl">
              <div className="bulk-pass-arabic-title">
                <span>{title}</span>
              </div>

              <div className="bulk-pass-arabic-divider" />

              <div className="bulk-pass-arabic-date-box">
                <div>التاريخ : {hijriDate} هـ</div>
                <div>الموافق : {gregorianDate} م</div>
              </div>

              {description.split("\n").filter(Boolean).map((para, i) => (
                <p key={i} className="bulk-pass-arabic-paragraph">{para}</p>
              ))}

              <div
                className="bulk-pass-arabic-more-description"
                dangerouslySetInnerHTML={{ __html: sanitizedMoreDescription }}
              />

              <div className="bulk-pass-arabic-divider" />

              <div className="bulk-pass-arabic-sign">
                <span>الختم</span>
                <span>التوقيع</span>
              </div>
            </div>
          </div>

          <div className="gro-crew-immigration-bulk-actions">
            <button
              type="button"
              className="gro-crew-immigration-bulk-submit"
              disabled={submitting}
              onClick={handleUploadCgPass}
            >
              {submitting ? "Uploading…" : "Upload CG Pass"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

CrewChangeCgPassGenerateView.propTypes = {
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedRows: PropTypes.array.isRequired,
  onBack: PropTypes.func.isRequired,
  onUploaded: PropTypes.func.isRequired,
};
