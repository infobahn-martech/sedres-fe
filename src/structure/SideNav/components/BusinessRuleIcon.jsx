import PropTypes from 'prop-types';

function BusinessRuleIcon({ iconType, className = '' }) {
  const renderIcon = () => {
    switch (iconType) {
      case 'create':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#10B981" />
            <path d="M20 13v14M13 20h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
      case 'update':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#F59E0B" />
            <path d="M14 20l5 5 11-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#3B82F6" />
            <path d="M15 20h10M22 15l5 5-5 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'child-blocked':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <circle cx="20" cy="20" r="16" fill="#EF4444" />
            <path d="M13 13l14 14M27 13L13 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
      case 'child-moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#3B82F6" />
            <rect x="9" y="9" width="10" height="10" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M21 20h8M26 16l4 4-4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'all-children-moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#3B82F6" />
            <rect x="9" y="8" width="7" height="5" rx="1" fill="white" fillOpacity="0.9" />
            <rect x="9" y="15" width="7" height="5" rx="1" fill="white" fillOpacity="0.9" />
            <rect x="9" y="22" width="7" height="5" rx="1" fill="white" fillOpacity="0.9" />
            <path d="M20 20h9M25 16l4 4-4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'child-updated':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#3B82F6" />
            <rect x="9" y="12" width="10" height="10" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M22 22l4 4 7-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'time-based':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#F97316" />
            <circle cx="20" cy="20" r="9" stroke="white" strokeWidth="2.2" />
            <path d="M20 14v6l4 2" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'parent-moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#8B5CF6" />
            <rect x="8" y="9" width="12" height="9" rx="2" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
            <path d="M22 20h8M26 17l4 3-4 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="10" y="24" width="7" height="5" rx="1" fill="white" fillOpacity="0.7" />
          </svg>
        );
      case 'parent-updated':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#8B5CF6" />
            <rect x="8" y="9" width="13" height="10" rx="2" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
            <path d="M22 22l4 4 7-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="10" y="25" width="7" height="4" rx="1" fill="white" fillOpacity="0.7" />
          </svg>
        );
      case 'parent-created':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#8B5CF6" />
            <rect x="8" y="9" width="13" height="10" rx="2" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
            <path d="M27 19v10M22 24h10" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="10" y="25" width="7" height="4" rx="1" fill="white" fillOpacity="0.7" />
          </svg>
        );
      case 'archive':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#6B7280" />
            <rect x="10" y="12" width="20" height="5" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M12 17v10a2 2 0 002 2h12a2 2 0 002-2V17" stroke="white" strokeWidth="2" />
            <path d="M17 23h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'task-created':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#14B8A6" />
            <rect x="10" y="12" width="14" height="16" rx="2" stroke="white" strokeWidth="2" fill="none" />
            <path d="M14 19h6M14 23h4" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M27 13v8M23 17h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'task-moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#14B8A6" />
            <rect x="8" y="12" width="13" height="16" rx="2" stroke="white" strokeWidth="2" fill="none" />
            <path d="M11 18h7M11 22h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M24 20h6M27 17l3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'task-updated':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#14B8A6" />
            <rect x="8" y="12" width="13" height="16" rx="2" stroke="white" strokeWidth="2" fill="none" />
            <path d="M11 18h7M11 22h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M23 25l4 4 7-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'recurring-archive':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#F97316" />
            <rect x="10" y="11" width="20" height="5" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M12 16v10a2 2 0 002 2h12a2 2 0 002-2V16" stroke="white" strokeWidth="2" />
            <circle cx="20" cy="22" r="3" stroke="white" strokeWidth="1.8" />
            <path d="M20 20.5v1.5l1.2.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'relative-moved':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#EC4899" />
            <rect x="8" y="10" width="9" height="8" rx="2" fill="white" fillOpacity="0.9" />
            <rect x="8" y="22" width="9" height="8" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M17 14h3v12h-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 20h8M27 17l3 3-3 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'relative-updated':
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#EC4899" />
            <rect x="8" y="10" width="9" height="8" rx="2" fill="white" fillOpacity="0.9" />
            <rect x="8" y="22" width="9" height="8" rx="2" fill="white" fillOpacity="0.9" />
            <path d="M17 14h3v12h-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 21l4 4 7-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
            <rect x="4" y="4" width="32" height="32" rx="6" fill="#9CA3AF" />
            <path d="M20 14v6M20 24v2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return <div className={`business-rules-card-icon ${className}`.trim()}>{renderIcon()}</div>;
}

BusinessRuleIcon.propTypes = {
  iconType: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default BusinessRuleIcon;
