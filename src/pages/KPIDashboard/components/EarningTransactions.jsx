import '../../../design/scss/pages/kpi-dashboard/components/EarningTransactions.scss';

const TickIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.50012 1.40601C4.14006 1.40601 1.40637 4.1397 1.40637 7.49975C1.40637 10.8598 4.14006 13.5935 7.50012 13.5935C10.8602 13.5935 13.5939 10.8598 13.5939 7.49975C13.5939 4.1397 10.8602 1.40601 7.50012 1.40601ZM10.6715 5.45747L6.73401 10.145C6.69082 10.1964 6.63707 10.238 6.57642 10.2668C6.51576 10.2957 6.44961 10.3112 6.38245 10.3123H6.37454C6.30883 10.3122 6.24387 10.2984 6.18386 10.2716C6.12385 10.2449 6.07013 10.2058 6.0262 10.157L4.3387 8.28198C4.29584 8.23653 4.2625 8.18296 4.24064 8.12444C4.21878 8.06592 4.20884 8.00361 4.2114 7.94119C4.21396 7.87877 4.22898 7.8175 4.25556 7.76096C4.28214 7.70443 4.31976 7.65377 4.3662 7.61198C4.41263 7.57019 4.46696 7.53811 4.52597 7.51761C4.58499 7.49712 4.6475 7.48862 4.70985 7.49263C4.77219 7.49664 4.8331 7.51308 4.88901 7.54096C4.94491 7.56885 4.99467 7.60763 5.03538 7.65503L6.36223 9.12925L9.95373 4.85454C10.0343 4.7614 10.1483 4.7037 10.271 4.69392C10.3938 4.68414 10.5155 4.72306 10.6098 4.80226C10.7041 4.88147 10.7634 4.99461 10.7749 5.11721C10.7865 5.23981 10.7493 5.36204 10.6715 5.45747Z" fill="#01B574"/>
  </svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13.7525 10.6656C13.7006 10.6031 13.6497 10.5406 13.5997 10.4803C12.9122 9.64869 12.4963 9.14682 12.4963 6.79276C12.4963 5.57401 12.2047 4.57401 11.63 3.82401C11.2063 3.26995 10.6334 2.84963 9.87845 2.53901C9.86873 2.5336 9.86005 2.52651 9.85282 2.51807C9.58126 1.6087 8.83813 0.999634 8.00001 0.999634C7.16188 0.999634 6.41907 1.6087 6.14751 2.51713C6.14026 2.52527 6.13171 2.53213 6.1222 2.53745C4.36032 3.26276 3.50407 4.65432 3.50407 6.79182C3.50407 9.14682 3.08876 9.64869 2.40064 10.4793C2.35064 10.5396 2.2997 10.6009 2.24782 10.6646C2.11382 10.8262 2.02892 11.0228 2.00317 11.2312C1.97742 11.4395 2.01189 11.6509 2.10251 11.8403C2.29532 12.2465 2.70626 12.4987 3.17532 12.4987H12.8281C13.295 12.4987 13.7031 12.2468 13.8966 11.8424C13.9876 11.653 14.0224 11.4415 13.9968 11.2329C13.9713 11.0243 13.8865 10.8274 13.7525 10.6656Z" fill="#0075FF"/>
    <path d="M7.99998 14.9999C8.45156 14.9995 8.89461 14.8769 9.28216 14.6451C9.6697 14.4134 9.98729 14.081 10.2012 13.6833C10.2113 13.6643 10.2163 13.6429 10.2157 13.6214C10.2151 13.5998 10.2089 13.5788 10.1978 13.5603C10.1866 13.5419 10.1709 13.5266 10.1521 13.516C10.1334 13.5054 10.1122 13.4999 10.0906 13.4999H5.90998C5.8884 13.4998 5.86716 13.5053 5.84834 13.5159C5.82952 13.5265 5.81376 13.5417 5.80259 13.5602C5.79141 13.5787 5.78522 13.5997 5.7846 13.6213C5.78398 13.6429 5.78896 13.6642 5.79905 13.6833C6.01296 14.0809 6.3305 14.4133 6.71799 14.6451C7.10547 14.8769 7.54846 14.9995 7.99998 14.9999Z" fill="#0075FF"/>
  </svg>
);

const CardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M0.999878 11.7495C0.999878 12.2136 1.18425 12.6588 1.51244 12.9869C1.84063 13.3151 2.28575 13.4995 2.74988 13.4995H13.2499C13.714 13.4995 14.1591 13.3151 14.4873 12.9869C14.8155 12.6588 14.9999 12.2136 14.9999 11.7495V6.93701H0.999878V11.7495ZM3.06238 9.37451C3.06238 9.12587 3.16115 8.88741 3.33696 8.7116C3.51278 8.53578 3.75124 8.43701 3.99988 8.43701H5.49988C5.74852 8.43701 5.98697 8.53578 6.16279 8.7116C6.3386 8.88741 6.43738 9.12587 6.43738 9.37451V9.99951C6.43738 10.2482 6.3386 10.4866 6.16279 10.6624C5.98697 10.8382 5.74852 10.937 5.49988 10.937H3.99988C3.75124 10.937 3.51278 10.8382 3.33696 10.6624C3.16115 10.4866 3.06238 10.2482 3.06238 9.99951V9.37451Z" fill="#F6AD55"/>
    <path d="M13.2499 2.49915H2.74988C2.28575 2.49915 1.84063 2.68352 1.51244 3.01171C1.18425 3.3399 0.999878 3.78502 0.999878 4.24915V5.06164H14.9999V4.24915C14.9999 3.78502 14.8155 3.3399 14.4873 3.01171C14.1591 2.68352 13.714 2.49915 13.2499 2.49915Z" fill="#F6AD55"/>
  </svg>
);

const EarningTransactions = () => {
  const transactions = [
    { amount: 2400, date: '22 July', status: 'Pending Earning', icon: <BellIcon /> },
    { amount: 2400, date: '30 July', status: 'Released Earning', icon: <CardIcon /> },
    { amount: 2260, date: '20 August', status: 'Pending Earning', icon: <BellIcon /> },
    { amount: 2260, date: '29 August', status: 'Released Earning', icon: <CardIcon /> },
    { amount: 2865, date: '23 September', status: 'Pending Earning', icon: <BellIcon /> },
    { amount: 2865, date: '31 August', status: 'Released Earning', icon: <CardIcon /> },
  ];

  return (
    <div className="kpi-earning-transactions">
      <div className="kpi-earning-transactions__header">
        <h3 className="kpi-earning-transactions__title">Earning Transactions</h3>
        <div className="kpi-earning-transactions__summary">
          <TickIcon />
          <span>+30% this month</span>
        </div>
      </div>
      <div className="kpi-earning-transactions__list">
        {transactions.map((transaction, index) => (
          <div key={index} className="kpi-earning-transactions__item">
            <div className="kpi-earning-transactions__item-content">
              <div className="kpi-earning-transactions__icon-wrapper">
                <div className="kpi-earning-transactions__icon">{transaction.icon}</div>
              </div>
              <div className="kpi-earning-transactions__details">
                <div className="kpi-earning-transactions__amount">SAR {transaction.amount.toLocaleString()}</div>
                <div className="kpi-earning-transactions__meta">
                  <span className="kpi-earning-transactions__date">{transaction.date}</span>
                  <span className="kpi-earning-transactions__separator">-</span>
                  <span className="kpi-earning-transactions__status">{transaction.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EarningTransactions;

