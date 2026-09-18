// Renders a template field the same way the live kanban card renders it
// (cf-field/cf-input, matching Call Type Builder's own live-preview fields)
// so the template preview is pixel-identical to the real card. Shared by the
// Custom Templates list preview and the Custom Template builder's live preview.
function TemplateFieldPreview({ field }) {
    const label = field.label;
    const requiredMark = field.required && <span className="text-danger">*</span>;

    switch (field.type) {
        case "textarea":
            return (
                <div className="cf-field ct-preview-span-full">
                    <label>{label}{requiredMark}</label>
                    <textarea className="ct-preview-textarea-mock" rows={3} placeholder="Enter text..." />
                </div>
            );
        case "checkbox":
            return (
                <div className="cf-field ct-preview-span-full">
                    <label className="ct-preview-check-mock">
                        <input type="checkbox" />
                        <span>{label}{requiredMark}</span>
                    </label>
                </div>
            );
        case "radio": {
            const options = field.options?.length ? field.options : ["Option 1", "Option 2"];
            return (
                <div className="cf-field ct-preview-span-full">
                    <label>{label}{requiredMark}</label>
                    <div className="ct-preview-radio-mock">
                        {options.map((opt, i) => (
                            <label key={i} className="ct-preview-radio-option">
                                <input type="radio" />
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }
        case "dropdown":
            return (
                <div className="cf-field">
                    <label>{label}{requiredMark}</label>
                    <div className="cf-input ct-preview-select-input">
                        <input type="text" placeholder="Select option..." />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>
            );
        case "file":
            return (
                <div className="cf-field">
                    <label>{label}{requiredMark}</label>
                    <div className="ct-preview-file-zone">Choose file...</div>
                </div>
            );
        case "date":
        case "time":
        case "datetime":
            return (
                <div className="cf-field">
                    <label>{label}{requiredMark}</label>
                    <div className="cf-input">
                        <input type={field.type === "datetime" ? "datetime-local" : field.type} />
                    </div>
                </div>
            );
        default:
            return (
                <div className="cf-field">
                    <label>{label}{requiredMark}</label>
                    <div className="cf-input">
                        <input
                            type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                            placeholder={label}
                        />
                    </div>
                </div>
            );
    }
}

export default TemplateFieldPreview;
