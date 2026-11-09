import TemplateFieldPreview from "./TemplateFieldPreview";

// Fixed system sections of a tab (e.g. Export Approval), as returned by
// form_template/system_bindings: each section has fields, optional nested
// sub_sections and, for approval steps, a set of actions. They are defined by
// the backend (with their own save API), so the builder only previews them.

const byDisplayOrder = (a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
const isFlagTrue = (v) => v === true || v === 1 || v === "1";
const humanize = (value) => String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const toPreviewField = (f) => ({
    id: f.field_key,
    label: f.label || humanize(f.field_key),
    type: String(f.field_type ?? "text").toLowerCase(),
    required: isFlagTrue(f.is_required),
    options: (f.options ?? []).map((opt) => (typeof opt === "string" ? opt : (opt?.option_label ?? ""))),
    optionsSource: f.option_source === "master" ? "master" : "manual",
    masterModule: f.master_key ?? "",
});

const countSectionFields = (section) => (section.fields?.length ?? 0)
    + (section.sub_sections ?? []).reduce((sum, sub) => sum + countSectionFields(sub), 0);

function SectionPreview({ section, depth }) {
    const fields = [...(section.fields ?? [])].sort(byDisplayOrder);
    const subSections = [...(section.sub_sections ?? [])].sort(byDisplayOrder);
    const actions = section.actions ?? [];
    return (
        <section className={`ctm-sys-section ctm-sys-section--depth-${Math.min(depth, 2)}`}>
            <header className="ctm-sys-section-head">
                <h4 className="ctm-sys-section-title">{section.section_name}</h4>
                {section.description && <p className="ctm-sys-section-desc">{section.description}</p>}
            </header>

            {fields.length > 0 && (
                <div className="ct-preview-custom-fields-grid ctm-sys-section-grid">
                    {fields.map((f) => (
                        <div
                            key={f.field_key}
                            className={`ctm-sys-field ${isFlagTrue(f.read_only) ? "is-read-only" : ""}`}
                            title={isFlagTrue(f.read_only) ? "Read-only — filled automatically" : undefined}
                        >
                            <TemplateFieldPreview field={toPreviewField(f)} />
                        </div>
                    ))}
                </div>
            )}

            {subSections.map((sub) => (
                <SectionPreview key={sub.section_key} section={sub} depth={depth + 1} />
            ))}

            {actions.length > 0 && (
                <div className="ctm-sys-section-actions">
                    {actions.map((action) => (
                        <button key={action} type="button" className="ctm-sys-section-action" disabled>
                            {humanize(action)}
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

function TemplateSectionsPreview({ sections }) {
    return (
        <div className="ctm-sys-sections">
            {[...sections].sort(byDisplayOrder).map((section) => (
                <SectionPreview key={section.section_key} section={section} depth={0} />
            ))}
        </div>
    );
}

// Left-panel counterpart: these tabs have no editable fields, so list what the
// system provides instead of the field editor.
export function TemplateSectionsSummary({ sections }) {
    return (
        <div className="ctm-sys-summary">
            <p className="ctm-section-title" style={{ margin: 0 }}>System Sections</p>
            <p className="ctm-sys-summary-note">
                This tab is a fixed system screen — its sections and fields come from the system and can&apos;t be edited here.
            </p>
            <ul className="ctm-sys-summary-list">
                {[...sections].sort(byDisplayOrder).map((section) => {
                    const count = countSectionFields(section);
                    return (
                        <li key={section.section_key}>
                            <span className="ctm-sys-summary-name">{section.section_name}</span>
                            <span className="ctm-sys-summary-meta">{count} field{count === 1 ? "" : "s"}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default TemplateSectionsPreview;
