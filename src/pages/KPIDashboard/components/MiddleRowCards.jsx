import React from 'react';
import SatisfactionRateCard from './SatisfactionRateCard';
import TaskCompletionSpeedCard from './TaskCompletionSpeedCard';
import '../../../design/scss/pages/kpi-dashboard/components/MiddleRowCards.scss';

const MiddleRowCards = () => {
  return (
    <div className="kpi-dashboard__grid kpi-middle-row">
      <div className="kpi-middle-row__satisfaction">
        <SatisfactionRateCard />
      </div>
      <div className="kpi-middle-row__task-speed">
        <TaskCompletionSpeedCard />
      </div>
    </div>
  );
};

export default MiddleRowCards;
