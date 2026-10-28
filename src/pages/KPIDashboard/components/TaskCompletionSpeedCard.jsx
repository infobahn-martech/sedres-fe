import React from 'react';
import '../../../design/scss/pages/kpi-dashboard/components/TaskCompletionSpeedCard.scss';

const ThreeDotsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g clipPath="url(#clip0_7_1519)">
      <path d="M6 10C4.9 10 4 10.9 4 12C4 13.1 4.9 14 6 14C7.1 14 8 13.1 8 12C8 10.9 7.1 10 6 10ZM18 10C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14C19.1 14 20 13.1 20 12C20 10.9 19.1 10 18 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_7_1519">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const TaskCompletionSpeedCard = () => {
  const score = 9.3;
  const scorePercentage = (score / 10) * 100;

  return (
    <div className="kpi-task-speed-card">
      <div className="kpi-task-speed-card__header">
        <h3 className="kpi-task-speed-card__title">Task completion speed</h3>
        <button type="button" className="kpi-task-speed-card__menu" aria-label="More options">
          <ThreeDotsIcon />
        </button>
      </div>
      <div className="kpi-task-speed-card__content">
        <div className="kpi-task-speed-card__gauge">
          <svg
            className="kpi-task-speed-card__gauge-svg"
            width="124"
            height="124"
            viewBox="0 0 124 124"
            role="img"
            aria-label={`Total score ${score} out of 10, Good`}
          >
            <circle className="kpi-task-speed-card__gauge-track" cx="62" cy="62" r="52" />
            {/* Progress starts at 12 o'clock */}
            <circle
              className="kpi-task-speed-card__gauge-fill"
              cx="62"
              cy="62"
              r="52"
              pathLength="100"
              strokeDasharray={`${scorePercentage} 100`}
              transform="rotate(-90 62 62)"
            />
          </svg>
          <div className="kpi-task-speed-card__gauge-content" aria-hidden="true">
            <div className="kpi-task-speed-card__gauge-label">Good</div>
            <div className="kpi-task-speed-card__gauge-score">{score}</div>
            <div className="kpi-task-speed-card__gauge-subtitle">Total Score</div>
          </div>
        </div>
        <div className="kpi-task-speed-card__metrics">
          <div className="kpi-task-speed-card__metric">
            <div className="kpi-task-speed-card__metric-label">Ongoing</div>
            <div className="kpi-task-speed-card__metric-value">
              145 <span className="kpi-task-speed-card__metric-unit">Tasks</span>
            </div>
          </div>
          <div className="kpi-task-speed-card__metric">
            <div className="kpi-task-speed-card__metric-label">Bonus Points</div>
            <div className="kpi-task-speed-card__metric-value">36</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCompletionSpeedCard;
