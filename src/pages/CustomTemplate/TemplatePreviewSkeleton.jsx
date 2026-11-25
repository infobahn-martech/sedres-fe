import "../../design/scss/pages/customTemplateList.scss";

const SKELETON_TAB_WIDTHS = [96, 120, 84, 108];
const SKELETON_FIELD_COUNT = 8;

// Shimmering stand-in for the card preview (topbar, tab strip, two-column field
// grid) while a template or its call-type structure loads. Shared by the
// templates list and the builder.
function TemplatePreviewSkeleton() {
    return (
        <div className="ct-preview-modal ctl-preview-skeleton" aria-hidden="true">
            <div className="cardform-topbar ct-preview-topbar ctl-preview-topbar">
                <span className="ctl-bone ctl-bone--inverse ctl-bone--title" />
            </div>
            <div className="ctl-skeleton-tabs">
                {SKELETON_TAB_WIDTHS.map((w) => (
                    <span key={w} className="ctl-bone ctl-bone--tab" style={{ width: w }} />
                ))}
            </div>
            <div className="ctl-skeleton-grid">
                {Array.from({ length: SKELETON_FIELD_COUNT }, (_, i) => (
                    <div key={i} className="ctl-skeleton-field">
                        <span className="ctl-bone ctl-bone--label" />
                        <span className="ctl-bone ctl-bone--input" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TemplatePreviewSkeleton;
