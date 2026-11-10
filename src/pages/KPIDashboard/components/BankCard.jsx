import '../../../design/scss/pages/kpi-dashboard/components/BankCard.scss';

const MoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <g clipPath="url(#clip0_87_31)">
      <path d="M6 10C4.9 10 4 10.9 4 12C4 13.1 4.9 14 6 14C7.1 14 8 13.1 8 12C8 10.9 7.1 10 6 10ZM18 10C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14C19.1 14 20 13.1 20 12C20 10.9 19.1 10 18 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="white" />
    </g>
    <defs>
      <clipPath id="clip0_87_31">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const BankCard = () => {
  return (
    <div className="kpi-bank-card">
      <div className="kpi-bank-card__header">
        <div className="kpi-bank-card__bank-name">IBC Bank</div>
        <button className="kpi-bank-card__toggle">
          <MoreIcon />
        </button>
      </div>
      <div className="kpi-bank-card__number">7812 2139 0823 XXXX</div>
    </div>
  );
};

export default BankCard;

