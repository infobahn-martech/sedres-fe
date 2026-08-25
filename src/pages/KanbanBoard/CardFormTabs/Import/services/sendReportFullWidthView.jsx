import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

const parseRecipientFieldValue = (value) => {
  if (value == null || value === "") return { chips: [], input: "" };
  const parts = value.split(",");
  const chips = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
  const input = (parts[parts.length - 1] ?? "").trimStart();
  return { chips, input };
};

const buildRecipientFieldValue = (chips, input) => {
  if (!chips.length) return input;
  if (!input) return chips.join(", ");
  return `${chips.join(", ")}, ${input}`;
};

const RecipientChipField = ({
  value,
  onChange,
  id,
  ariaLabelledBy,
  placeholder,
  className = "",
}) => {
  const { chips, input } = parseRecipientFieldValue(value ?? "");

  const update = (nextChips, nextInput) => {
    onChange(buildRecipientFieldValue(nextChips, nextInput));
  };

  const removeChip = (index) => {
    update(chips.filter((_, i) => i !== index), input);
  };

  const handleInputChange = (e) => {
    update(chips, e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Backspace" && input === "" && chips.length > 0) {
      e.preventDefault();
      update(chips.slice(0, -1), "");
    }
  };

  return (
    <div
      className={`send-report-compose-recipients${className ? ` ${className}` : ""}`}
      id={id}
    >
      {chips.map((email, i) => (
        <span key={`${i}-${email}`} className="send-report-recipient-chip">
          <span className="send-report-recipient-chip-text">{email}</span>
          <button
            type="button"
            className="send-report-recipient-chip-remove"
            onClick={() => removeChip(i)}
            aria-label={`Remove ${email}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        className="send-report-compose-recipients-input"
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={chips.length ? "" : placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-labelledby={ariaLabelledBy}
      />
    </div>
  );
};

RecipientChipField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  ariaLabelledBy: PropTypes.string,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

function formatAttachmentSize(size) {
  if (size == null || Number.isNaN(Number(size))) return "";
  const n = Number(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Single-row compact header: back + divider + title. Shared by all Send Report screens.
 */
export function SendReportScreenHeader({ formSectionLabel, tabName, onBack, disabled }) {
  return (
    <header className="send-report-screen-header" role="banner">
      <div className="send-report-screen-header__row">
        <button
          type="button"
          className="send-report-screen-header__back"
          onClick={onBack}
          disabled={disabled}
        >
          <span className="send-report-screen-header__back-icon" aria-hidden="true">
            ←
          </span>
          <span className="send-report-screen-header__back-text">Back to {formSectionLabel}</span>
        </button>
        <span className="send-report-screen-header__divider" aria-hidden="true" />
        <h1 className="send-report-screen-header__title">Send Report — {tabName}</h1>
      </div>
    </header>
  );
}

SendReportScreenHeader.propTypes = {
  formSectionLabel: PropTypes.string.isRequired,
  tabName: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

/**
 * Full-width send report preview (replaces form area). Reusable across Operation tabs.
 */
export function SendReportFullWidthView({
  tabName,
  formSectionLabel,
  getBody,
  getAttachments,
  onBack,
  onSend,
}) {
  const [formData, setFormData] = useState({
    from: "operations@shipping.com",
    to: "recipient@example.com",
    cc: "cc@example.com",
    bcc: "",
    subject: "",
    body: "",
  });
  const [bccExpanded, setBccExpanded] = useState(false);
  const [sending, setSending] = useState(false);

  const getBodyRef = useRef(getBody);
  getBodyRef.current = getBody;
  const getAttachmentsRef = useRef(getAttachments);
  getAttachmentsRef.current = getAttachments ?? (() => []);

  useEffect(() => {
    setFormData((prev) => {
      const next = {
        ...prev,
        body: getBodyRef.current(),
        subject: `Report - ${tabName}`,
      };
      setBccExpanded(!!next.bcc?.trim());
      return next;
    });
  }, [tabName]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSend = async () => {
    if (sending) return;
    if (typeof onSend !== "function") return;
    setSending(true);
    try {
      const attachments = getAttachmentsRef.current();
      await onSend({
        tabName,
        from: formData.from,
        to: formData.to,
        cc: formData.cc,
        bcc: formData.bcc,
        subject: formData.subject,
        body: formData.body,
        attachments,
      });
    } finally {
      setSending(false);
    }
  };

  const attachments = getAttachmentsRef.current();

  return (
    <div className="send-report-fullwidth">
      <div className="send-report-fullwidth__shell">
        <SendReportScreenHeader
          formSectionLabel={formSectionLabel}
          tabName={tabName}
          onBack={onBack}
          disabled={sending}
        />

        <div className="send-report-fullwidth__scroll">
          <div className="send-report-fullwidth__inner">
            <section className="send-report-fullwidth__meta" aria-label="Email metadata">
              <div className="send-report-fullwidth__meta-card">
                <div className="send-report-compose-fields send-report-fullwidth__compose-fields">
                  <div className="send-report-compose-row send-report-compose-row--field">
                    <span className="send-report-compose-label" id="send-report-fw-from-label">
                      From
                    </span>
                    <div className="send-report-compose-field-inner">
                      <input
                        type="email"
                        value={formData.from}
                        onChange={(e) => handleInputChange("from", e.target.value)}
                        className="send-report-compose-input"
                        placeholder="sender@example.com"
                        aria-labelledby="send-report-fw-from-label"
                      />
                    </div>
                  </div>
                  <div className="send-report-compose-row send-report-compose-row--field">
                    <span className="send-report-compose-label" id="send-report-fw-to-label">
                      To
                    </span>
                    <div className="send-report-compose-field-inner">
                      <RecipientChipField
                        value={formData.to}
                        onChange={(v) => handleInputChange("to", v)}
                        placeholder="Recipients"
                        ariaLabelledBy="send-report-fw-to-label"
                      />
                    </div>
                  </div>
                  <div className="send-report-compose-row send-report-compose-row--field send-report-compose-row--optional">
                    <span className="send-report-compose-label send-report-compose-label--optional" id="send-report-fw-cc-label">
                      Cc
                    </span>
                    <div className="send-report-compose-field-inner">
                      <RecipientChipField
                        value={formData.cc}
                        onChange={(v) => handleInputChange("cc", v)}
                        className="send-report-compose-recipients--optional"
                        placeholder="Recipients"
                        ariaLabelledBy="send-report-fw-cc-label"
                      />
                    </div>
                  </div>
                  {!bccExpanded ? (
                    <div className="send-report-compose-row send-report-compose-row--add-bcc">
                      <span className="send-report-compose-label send-report-compose-label--ghost" aria-hidden="true">
                        &nbsp;
                      </span>
                      <div className="send-report-compose-field-inner send-report-compose-field-inner--link">
                        <button
                          type="button"
                          className="send-report-compose-add-bcc"
                          onClick={() => setBccExpanded(true)}
                        >
                          Add Bcc
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="send-report-compose-row send-report-compose-row--field send-report-compose-row--optional">
                      <span className="send-report-compose-label send-report-compose-label--optional" id="send-report-fw-bcc-label">
                        Bcc
                      </span>
                      <div className="send-report-compose-field-inner">
                        <RecipientChipField
                          value={formData.bcc}
                          onChange={(v) => handleInputChange("bcc", v)}
                          className="send-report-compose-recipients--optional"
                          placeholder="Recipients"
                          ariaLabelledBy="send-report-fw-bcc-label"
                        />
                      </div>
                    </div>
                  )}
                  <div className="send-report-compose-row send-report-compose-row--subject">
                    <span className="send-report-compose-label" id="send-report-fw-subject-label">
                      Subject
                    </span>
                    <div className="send-report-compose-field-inner">
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => handleInputChange("subject", e.target.value)}
                        className="send-report-compose-input"
                        placeholder="Subject"
                        aria-labelledby="send-report-fw-subject-label"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="send-report-fullwidth__body-section" aria-label="Report body">
              <h2 className="send-report-fullwidth__section-label">Message</h2>
              <div className="send-report-fullwidth__editor-wrap send-report-fullwidth__editor-wrap--scroll">
                <textarea
                  value={formData.body}
                  onChange={(e) => handleInputChange("body", e.target.value)}
                  className="send-report-compose-message send-report-fullwidth__textarea"
                  placeholder="Compose your message…"
                  aria-label="Message body"
                  rows={10}
                />
              </div>
            </section>

            {attachments.length > 0 && (
              <section className="send-report-fullwidth__attachments" aria-label="Attachments">
                <h2 className="send-report-fullwidth__section-label">Attachments</h2>
                <ul className="send-report-fullwidth__attachments-list">
                  {attachments.map((file, idx) => (
                    <li key={`${file.name}-${idx}`} className="send-report-fullwidth__attachment-row">
                      <span className="send-report-fullwidth__attachment-name">{file.name}</span>
                      {file.size != null && (
                        <span className="send-report-fullwidth__attachment-size">{formatAttachmentSize(file.size)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="send-report-fullwidth__actions" role="group" aria-label="Send report actions">
              <button type="button" className="send-report-cancel-btn" onClick={onBack} disabled={sending}>
                Cancel
              </button>
              <button
                type="button"
                className="send-report-send-btn send-report-fullwidth__send-btn"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

SendReportFullWidthView.propTypes = {
  tabName: PropTypes.string.isRequired,
  formSectionLabel: PropTypes.string.isRequired,
  getBody: PropTypes.func.isRequired,
  getAttachments: PropTypes.func,
  onBack: PropTypes.func.isRequired,
  onSend: PropTypes.func,
};

export function SendReportButton({ onClick, label = "Send Report" }) {
  return (
    <button type="button" className="operation-send-report-btn" onClick={onClick} title={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M22 2L11 13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 2L15 22L11 13L2 9L22 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="send-report-text">{label}</span>
    </button>
  );
}

SendReportButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  tabName: PropTypes.string,
  label: PropTypes.string,
};
