import '../../../design/scss/pages/kpi-dashboard/components/PendingBalanceCard.scss';

const GraphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="61" height="20" viewBox="0 0 61 20" fill="none">
    <path d="M1.00024 8.2C1.70263 11.8 4.50024 18.5 11.0002 18C17.5002 17.5 18.2788 1 29.6574 1C41.036 1 41.036 20.0286 60.0002 3.57143" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PendingBalanceCard = () => {
  return (
    <div className="kpi-pending-balance">
      <div className="kpi-pending-balance__header">
        <div className="kpi-pending-balance__title">Pending Balance</div>
        <div className="kpi-pending-balance__graph-icon">
          <GraphIcon />
        </div>
      </div>
      <div className="kpi-pending-balance__amount">SAR 2,865</div>
      <div className="kpi-pending-balance__credited">
        <div className="kpi-pending-balance__credited-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="14" height="10" rx="2" stroke="#01B574" strokeWidth="1.5"/>
            <path d="M5 8H11M5 10H11" stroke="#01B574" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Last Credited Balance
        </div>
        <div className="kpi-pending-balance__credited-details">
          <div className="kpi-pending-balance__credited-date">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
              <path d="M5 1V4M11 1V4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M2 7H14" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
            </svg>
            28/10/2025, 16:36
          </div>
          <div className="kpi-pending-balance__credited-amount">SAR 2,260</div>
        </div>
      </div>
    </div>
  );
};

export default PendingBalanceCard;

