import React from 'react';
import GoldenIcon from '../../../assets/images/GoldenIcon.png';
import useKPIDashboardReducer from '../../../store/KPIDashboard';
import '../../../design/scss/pages/kpi-dashboard/components/WelcomeBackCard.scss';

const RightArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M6.80475 2.84375L10.461 6.5L6.80475 10.1562" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.95312 6.50024H2.53906" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WelcomeBackCard = () => {
  const {
    user,
    current_level,
    next_level,
    points_to_next_level,
    badge_icon_url,
  } = useKPIDashboardReducer((state) => state.dashboardData);

  const userName = user?.name ?? 'User';
  const badgeUrl = badge_icon_url || GoldenIcon;
  const hasNextLevel = next_level != null && points_to_next_level != null;

  return (
    <div className="kpi-welcome-card">
      <div className="kpi-welcome-card__content">
        <div className="kpi-welcome-card__text-section">
          <div className="kpi-welcome-card__greeting">
            <span className="kpi-welcome-card__greeting-text">Welcome back,</span>
            <span className="kpi-welcome-card__name">{userName}</span>
          </div>
          <p className="kpi-welcome-card__message">
            {hasNextLevel ? (
              <>
                <span className="kpi-welcome-card__message-line1">Woohoo! You're incredible</span>
                <span className="kpi-welcome-card__message-line2">
                  just {points_to_next_level} points away from level {next_level}!
                </span>
              </>
            ) : (
              <span className="kpi-welcome-card__message-line1">Keep up the great work!</span>
            )}
          </p>
          <button type="button" className="kpi-welcome-card__action">
            <span>Tap to record</span>
            <RightArrowIcon />
          </button>
        </div>
        {current_level != null && (
          <div className="kpi-welcome-card__badge">
            <img src={badgeUrl} alt={`Level ${current_level} Badge`} className="kpi-welcome-card__badge-image" />
            <div className="kpi-welcome-card__level-text">Level {current_level}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeBackCard;

