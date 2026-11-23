const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
      fill="currentColor"
    />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" fill="currentColor" />
  </svg>
);

const GroAiTranslationNotice = () => (
  <div className="gro-ai-translation-notice" role="note">
    <span className="gro-ai-translation-notice-icon">
      <SparklesIcon />
    </span>
    <div className="gro-ai-translation-notice-text">
      <strong>AI-generated translations</strong>
      <span>
        Translated values are generated using AI and may contain errors. Please verify all fields
        before submitting.
      </span>
    </div>
  </div>
);

export default GroAiTranslationNotice;
