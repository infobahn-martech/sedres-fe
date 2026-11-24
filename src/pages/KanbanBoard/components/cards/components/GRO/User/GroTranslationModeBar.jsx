import PropTypes from "prop-types";
import { FiArrowRight, FiEdit3, FiGlobe, FiRepeat } from "react-icons/fi";
import { TRANSLATION_MODES, TRANSLATION_MODE_OPTIONS } from "./groTranslationMode";

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" fill="currentColor" />
  </svg>
);

const OptionContent = ({ option }) => {
  if (option.from && option.to) {
    return (
      <>
        <span className="gro-tm-lang">{option.from}</span>
        <FiArrowRight className="gro-tm-arrow" aria-hidden />
        <span className="gro-tm-lang">{option.to}</span>
      </>
    );
  }
  const Icon = option.value === TRANSLATION_MODES.MANUAL ? FiEdit3 : FiRepeat;
  return (
    <>
      <Icon aria-hidden />
      <span>{option.label}</span>
    </>
  );
};

OptionContent.propTypes = {
  option: PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
    from: PropTypes.string,
    to: PropTypes.string,
  }).isRequired,
};

/** Translation mode card: title + hint, segmented picker, and an AI caution when AI is in use. */
const GroTranslationModeBar = ({ mode, onChange }) => {
  const active = TRANSLATION_MODE_OPTIONS.find((o) => o.value === mode) ?? TRANSLATION_MODE_OPTIONS[0];
  const usesAi = active.value !== TRANSLATION_MODES.MANUAL;

  return (
    <div className={`gro-tm${usesAi ? " gro-tm--ai" : ""}`}>
      <div className="gro-tm-main">
        <div className="gro-tm-heading">
          <span className="gro-tm-icon" aria-hidden>
            <FiGlobe />
          </span>
          <div className="gro-tm-heading-text">
            <strong>Translation</strong>
            <span>{active.hint}</span>
          </div>
        </div>

        <div className="gro-tm-options" role="radiogroup" aria-label="Translation mode">
          {TRANSLATION_MODE_OPTIONS.map((option) => {
            const selected = option.value === active.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                title={option.hint}
                className={`gro-tm-option${selected ? " is-active" : ""}`}
                onClick={() => onChange(option.value)}
              >
                <OptionContent option={option} />
              </button>
            );
          })}
        </div>
      </div>

      {usesAi ? (
        <div className="gro-tm-ai" role="note">
          <SparklesIcon />
          <span>
            <strong>AI-generated translations</strong> may contain errors — please verify all fields
            before printing.
          </span>
        </div>
      ) : null}
    </div>
  );
};

GroTranslationModeBar.propTypes = {
  mode: PropTypes.oneOf(Object.values(TRANSLATION_MODES)).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default GroTranslationModeBar;
