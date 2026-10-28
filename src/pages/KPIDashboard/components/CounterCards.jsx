import React from 'react';
import useKPIDashboardReducer from '../../../store/KPIDashboard';
import '../../../design/scss/pages/kpi-dashboard/components/CounterCards.scss';

const CounterIcon1 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 23 23" fill="none">
    <path d="M4.19668 4.56818H18.2592C18.4234 4.5681 18.5875 4.57852 18.7505 4.59938C18.6953 4.21168 18.5621 3.83919 18.359 3.50435C18.1559 3.16951 17.8871 2.87926 17.5688 2.65111C17.2506 2.42296 16.8894 2.26163 16.507 2.17684C16.1247 2.09205 15.7292 2.08557 15.3443 2.15778L3.7792 4.13224H3.76602C3.04007 4.27106 2.39451 4.68179 1.96118 5.28053C2.61403 4.81617 3.39553 4.56715 4.19668 4.56818Z" fill="white"/>
    <path d="M18.2593 5.62485H4.19678C3.45111 5.62566 2.73621 5.92224 2.20894 6.44951C1.68167 6.97678 1.38509 7.69168 1.38428 8.43735V16.8748C1.38509 17.6205 1.68167 18.3354 2.20894 18.8627C2.73621 19.3899 3.45111 19.6865 4.19678 19.6873H18.2593C19.0049 19.6865 19.7198 19.3899 20.2471 18.8627C20.7744 18.3354 21.071 17.6205 21.0718 16.8748V8.43735C21.071 7.69168 20.7744 6.97678 20.2471 6.44951C19.7198 5.92224 19.0049 5.62566 18.2593 5.62485ZM16.1719 14.0623C15.8937 14.0623 15.6219 13.9799 15.3906 13.8253C15.1593 13.6708 14.9791 13.4512 14.8727 13.1942C14.7662 12.9373 14.7384 12.6545 14.7926 12.3817C14.8469 12.109 14.9808 11.8584 15.1775 11.6617C15.3742 11.4651 15.6247 11.3311 15.8975 11.2769C16.1703 11.2226 16.4531 11.2505 16.71 11.3569C16.967 11.4633 17.1866 11.6436 17.3411 11.8748C17.4956 12.1061 17.5781 12.378 17.5781 12.6561C17.5781 13.0291 17.43 13.3867 17.1662 13.6505C16.9025 13.9142 16.5448 14.0623 16.1719 14.0623Z" fill="white"/>
    <path d="M1.40625 11.4014V7.02882C1.40625 6.07653 1.93359 4.48 3.76392 4.13415C5.31738 3.84279 6.85547 3.84279 6.85547 3.84279C6.85547 3.84279 7.86621 4.54591 7.03125 4.54591C6.19629 4.54591 6.21826 5.62257 7.03125 5.62257C7.84424 5.62257 7.03125 6.65529 7.03125 6.65529L3.75732 10.3687L1.40625 11.4014Z" fill="white"/>
  </svg>
);

const CounterIcon2 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 23 23" fill="none">
    <path d="M11.2502 2.10858C6.20225 2.10858 2.10962 6.20121 2.10962 11.2492C2.10962 16.2972 6.20225 20.3898 11.2502 20.3898C16.2982 20.3898 20.3909 16.2972 20.3909 11.2492C20.3909 6.20121 16.2982 2.10858 11.2502 2.10858Z" fill="white" stroke="#0075FF" strokeWidth="0.75" strokeMiterlimit="10"/>
    <path d="M11.2501 2.10858C8.69824 2.10858 6.29883 6.20121 6.29883 11.2492C6.29883 16.2972 8.69824 20.3898 11.2501 20.3898C13.802 20.3898 16.2015 16.2972 16.2015 11.2492C16.2015 6.20121 13.802 2.10858 11.2501 2.10858Z" fill="white" stroke="#0075FF" strokeWidth="0.75" strokeMiterlimit="10"/>
    <path d="M5.15625 5.15552C6.83672 6.34863 8.95224 7.06011 11.2501 7.06011C13.548 7.06011 15.6636 6.34863 17.344 5.15552" fill="white"/>
    <path d="M5.15625 5.15552C6.83672 6.34863 8.95224 7.06011 11.2501 7.06011C13.548 7.06011 15.6636 6.34863 17.344 5.15552" stroke="#0075FF" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17.344 17.3444C15.6636 16.1513 13.548 15.4398 11.2501 15.4398C8.95224 15.4398 6.83672 16.1513 5.15625 17.3444" stroke="#0075FF" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.25 2.10858V20.3898" stroke="#0075FF" strokeWidth="0.75" strokeMiterlimit="10"/>
    <path d="M20.3909 11.249H2.10962" stroke="#0075FF" strokeWidth="0.75" strokeMiterlimit="10"/>
  </svg>
);

const CounterIcon3 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" viewBox="0 0 16 20" fill="none">
    <path d="M2.8125 0.0117188H6.85547C6.89898 0.0117189 6.94091 0.0288028 6.97168 0.0595703C7.00245 0.090338 7.01953 0.132269 7.01953 0.175781V6.32812C7.01953 6.89067 7.24284 7.43034 7.64062 7.82812C8.03841 8.22591 8.57808 8.44922 9.14062 8.44922H15.293C15.3365 8.44922 15.3784 8.4663 15.4092 8.49707C15.4399 8.52784 15.457 8.56977 15.457 8.61328V16.875C15.457 17.6178 15.162 18.3302 14.6367 18.8555C14.1115 19.3807 13.3991 19.6758 12.6562 19.6758H2.8125C2.06969 19.6758 1.35728 19.3807 0.832031 18.8555C0.306784 18.3302 0.0117199 17.6178 0.0117188 16.875V2.8125C0.0117188 2.06969 0.306783 1.35728 0.832031 0.832031C1.35728 0.306783 2.06969 0.0117188 2.8125 0.0117188ZM4.21875 14.0508C4.02916 14.0508 3.84695 14.1257 3.71289 14.2598C3.57883 14.3938 3.50391 14.576 3.50391 14.7656C3.50391 14.9552 3.57883 15.1374 3.71289 15.2715C3.84695 15.4055 4.02916 15.4805 4.21875 15.4805H11.25C11.4396 15.4805 11.6218 15.4055 11.7559 15.2715C11.8899 15.1374 11.9648 14.9552 11.9648 14.7656C11.9648 14.576 11.8899 14.3938 11.7559 14.2598C11.6218 14.1257 11.4396 14.0508 11.25 14.0508H4.21875ZM4.21875 10.5352C4.02916 10.5352 3.84695 10.6101 3.71289 10.7441C3.57883 10.8782 3.50391 11.0604 3.50391 11.25C3.50391 11.4396 3.57883 11.6218 3.71289 11.7559C3.84695 11.8899 4.02916 11.9648 4.21875 11.9648H11.25C11.4396 11.9648 11.6218 11.8899 11.7559 11.7559C11.8899 11.6218 11.9648 11.4396 11.9648 11.25C11.9648 11.0604 11.8899 10.8782 11.7559 10.7441C11.6218 10.6101 11.4396 10.5352 11.25 10.5352H4.21875Z" fill="white" stroke="#0075FF" strokeWidth="0.0234375"/>
  </svg>
);

const CounterIcon4 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="27" height="25" viewBox="0 0 27 25" fill="none">
    <path d="M13.3147 0L17.4292 8.03913L26.6295 9.32827L19.9721 15.5859L21.5437 24.4217L13.3147 20.25L5.0857 24.4217L6.6573 15.5859L-9.44138e-05 9.32827L9.2002 8.03913L13.3147 0Z" fill="white"/>
  </svg>
);

const CounterCards = () => {
  const {
    points_last_24h,
    completed_tasks,
    pending_tasks,
    total_points,
  } = useKPIDashboardReducer((state) => state.dashboardData);

  const counters = [
    {
      id: 1,
      title: 'Points within last 24h',
      value: String(points_last_24h ?? 0),
      change: null,
      isPositive: null,
      icon: CounterIcon1,
      tone: 'info',
    },
    {
      id: 2,
      title: 'Completed Tasks',
      value: String(completed_tasks ?? 0),
      change: null,
      isPositive: null,
      icon: CounterIcon2,
      tone: 'success',
    },
    {
      id: 3,
      title: 'Pending Tasks',
      value: String(pending_tasks ?? 0),
      change: null,
      isPositive: null,
      icon: CounterIcon3,
      tone: 'warning',
    },
    {
      id: 4,
      title: 'Total Points',
      value: String(total_points ?? 0),
      change: null,
      isPositive: null,
      icon: CounterIcon4,
      tone: 'purple',
    },
  ];

  return (
    <div className="kpi-counter-cards">
      {counters.map((counter) => {
        const Icon = counter.icon;
        return (
          <div key={counter.id} className={`kpi-counter-card kpi-counter-card--${counter.tone}`}>
            <div className="kpi-counter-card__icon" aria-hidden="true">
              <Icon />
            </div>
            <div className="kpi-counter-card__content">
              <div className="kpi-counter-card__title">{counter.title}</div>
              <div className="kpi-counter-card__value">{counter.value}</div>
              {counter.change && (
                <div className={`kpi-counter-card__change kpi-counter-card__change--${counter.isPositive ? 'positive' : 'negative'}`}>
                  {counter.change}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CounterCards;

