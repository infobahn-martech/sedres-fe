import { getReadingOrder } from "./templateFieldGrid";
import TemplateFieldPreview from "./TemplateFieldPreview";

const DUMMY_ATTACHMENTS = [
    { id: "a1", name: "Appointment_Acceptance.pdf", size: "245K" },
    { id: "a2", name: "Port_Details.xlsx", size: "128K" },
];

// Fields stacked in the grid's reading order, so the single column lists them
// in the same order the 3-column grid would show them.
export function TemplateEmailFieldsColumn({ fields }) {
    return getReadingOrder(fields).map((i) => <TemplateFieldPreview key={fields[i].id ?? i} field={fields[i]} />);
}

function TemplateEmailPreview({ subject }) {
    return (
        <div className="operation-email-preview-panel ctm-email-preview">
            <div className="operation-email-preview-header">
                <h4>Email Preview</h4>
            </div>
            <div className="operation-email-preview-body">
                {[
                    { label: "From", value: "Sedres <noreply@sedres.com>" },
                    { label: "To", value: "agent@example.com" },
                    { label: "Cc", value: "operations@example.com" },
                    { label: "Subject", value: subject },
                ].map(({ label, value }) => (
                    <div key={label} className="cf-field">
                        <label>{label}</label>
                        <div className="cf-input"><input type="text" value={value} readOnly /></div>
                    </div>
                ))}
                <div className="cf-field operation-email-preview-attachments-field">
                    <label>Attachments</label>
                    <div className="email-preview-attachments-list">
                        {DUMMY_ATTACHMENTS.map((a) => (
                            <div key={a.id} className="email-preview-attachment-chip">
                                <span className="email-preview-attachment-link">
                                    <span className="email-preview-attachment-name">{a.name}</span>
                                    <span className="email-preview-attachment-size"> ({a.size})</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="cf-field operation-email-preview-message-field">
                    <label>Message</label>
                    <div className="ct-preview-message-area">
                        <div className="ct-preview-msg-toolbar">
                            {["Normal ▾", "B", "I", "U", "S", "≡", "☰", "A", "Tx"].map((t) => (
                                <span key={t} className="ct-preview-msg-tool">{t}</span>
                            ))}
                        </div>
                        <p className="ct-preview-msg-body">
                            Dear Sir/Madam,<br /><br />
                            Please find below the {subject.toLowerCase()} details for your reference.<br /><br />
                            Best regards,<br />
                            Sedres Operations Team
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TemplateEmailPreview;
