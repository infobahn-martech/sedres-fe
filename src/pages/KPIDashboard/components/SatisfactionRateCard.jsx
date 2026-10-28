import React from 'react';
import '../../../design/scss/pages/kpi-dashboard/components/SatisfactionRateCard.scss';

const SmileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 25 25" fill="none" aria-hidden="true">
    <path d="M12.4875 0C5.5875 0 0 5.6 0 12.5C0 19.4 5.5875 25 12.4875 25C19.4 25 25 19.4 25 12.5C25 5.6 19.4 0 12.4875 0ZM12.5 22.5C6.975 22.5 2.5 18.025 2.5 12.5C2.5 6.975 6.975 2.5 12.5 2.5C18.025 2.5 22.5 6.975 22.5 12.5C22.5 18.025 18.025 22.5 12.5 22.5ZM16.875 11.25C17.9125 11.25 18.75 10.4125 18.75 9.375C18.75 8.3375 17.9125 7.5 16.875 7.5C15.8375 7.5 15 8.3375 15 9.375C15 10.4125 15.8375 11.25 16.875 11.25ZM8.125 11.25C9.1625 11.25 10 10.4125 10 9.375C10 8.3375 9.1625 7.5 8.125 7.5C7.0875 7.5 6.25 8.3375 6.25 9.375C6.25 10.4125 7.0875 11.25 8.125 11.25ZM12.5 19.375C15.0375 19.375 17.25 17.9875 18.4375 15.9375C18.675 15.525 18.375 15 17.8875 15H7.1125C6.6375 15 6.325 15.525 6.5625 15.9375C7.75 17.9875 9.9625 19.375 12.5 19.375Z" fill="white" />
  </svg>
);

const SatisfactionRateCard = () => {
  const satisfactionRate = 95;
  // Semicircle from 9 o'clock to 3 o'clock over the top; pathLength lets the
  // dash array take the percentage directly.
  const radius = 80;
  const centerX = 100;
  const centerY = 100;
  const arcPath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;

  return (
    <div className="kpi-satisfaction-card">
      <div className="kpi-satisfaction-card__header">
        <div>
          <h3 className="kpi-satisfaction-card__title">Satisfaction Rate</h3>
          <p className="kpi-satisfaction-card__subtitle">From all tasks</p>
        </div>
        <span className="kpi-satisfaction-card__icon">
          <SmileIcon />
        </span>
      </div>
      <div className="kpi-satisfaction-card__gauge-wrapper">
        <div className="kpi-satisfaction-card__gauge">
          <svg
            className="kpi-satisfaction-card__gauge-svg"
            width="200"
            height="116"
            viewBox="0 0 200 116"
            role="img"
            aria-label={`Satisfaction rate ${satisfactionRate}%`}
          >
            <path className="kpi-satisfaction-card__gauge-track" d={arcPath} pathLength="100" />
            <path
              className="kpi-satisfaction-card__gauge-fill"
              d={arcPath}
              pathLength="100"
              strokeDasharray={`${satisfactionRate} 100`}
            />
            <text className="kpi-satisfaction-card__percentage-center" x={centerX} y={centerY - 8} textAnchor="middle">
              {satisfactionRate}%
            </text>
            <text className="kpi-satisfaction-card__gauge-label" x={centerX - radius} y="115" textAnchor="middle">
              0%
            </text>
            <text className="kpi-satisfaction-card__gauge-label" x={centerX + radius} y="115" textAnchor="middle">
              100%
            </text>
          </svg>
        </div>
        <div className="kpi-satisfaction-card__info-box">
          <p className="kpi-satisfaction-card__footer">Based on Completed Tasks</p>
          <div className="kpi-satisfaction-card__bar" aria-hidden="true">
            <div className="kpi-satisfaction-card__bar-fill" style={{ width: `${satisfactionRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionRateCard;
