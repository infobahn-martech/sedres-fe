import '../../../design/scss/pages/kpi-dashboard/components/BillingInformation.scss';

const DomainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <g clipPath="url(#clip0_1_247)">
      <path d="M12 7V3H2V21H22V7H12ZM6 19H4V17H6V19ZM6 15H4V13H6V15ZM6 11H4V9H6V11ZM6 7H4V5H6V7ZM10 19H8V17H10V19ZM10 15H8V13H10V15ZM10 11H8V9H10V11ZM10 7H8V5H10V7ZM20 19H12V17H14V15H12V13H14V11H12V9H20V19ZM18 11H16V13H18V11ZM18 15H16V17H18V15Z" fill="#01B574"/>
    </g>
    <defs>
      <clipPath id="clip0_1_247">
        <rect width="24" height="24" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <g clipPath="url(#clip0_1_180)">
      <path d="M1.5 8.73003V10.25C1.5 10.39 1.61 10.5 1.75 10.5H3.27C3.335 10.5 3.4 10.475 3.445 10.425L8.905 4.97003L7.03 3.09503L1.575 8.55003C1.525 8.60003 1.5 8.66003 1.5 8.73003ZM10.355 3.52003C10.55 3.32503 10.55 3.01003 10.355 2.81503L9.185 1.64503C8.99 1.45003 8.675 1.45003 8.48 1.64503L7.565 2.56003L9.44 4.43503L10.355 3.52003Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1_180">
        <rect width="12" height="12" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
    <g clipPath="url(#clip0_1_141)">
      <path d="M3.75 11.875C3.75 12.5625 4.3125 13.125 5 13.125H10C10.6875 13.125 11.25 12.5625 11.25 11.875V5.625C11.25 4.9375 10.6875 4.375 10 4.375H5C4.3125 4.375 3.75 4.9375 3.75 5.625V11.875ZM11.25 2.5H9.6875L9.24375 2.05625C9.13125 1.94375 8.96875 1.875 8.80625 1.875H6.19375C6.03125 1.875 5.86875 1.94375 5.75625 2.05625L5.3125 2.5H3.75C3.40625 2.5 3.125 2.78125 3.125 3.125C3.125 3.46875 3.40625 3.75 3.75 3.75H11.25C11.5937 3.75 11.875 3.46875 11.875 3.125C11.875 2.78125 11.5937 2.5 11.25 2.5Z" fill="#F53C2B"/>
    </g>
    <defs>
      <clipPath id="clip0_1_141">
        <rect width="15" height="15" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const BillingInformation = () => {
  const billingEntries = [
    {
      id: 1,
      name: 'Mohommed Rahman',
      companyName: 'Sedress',
      email: 'rahman@sedress.com',
      accountNumber: '321548956542',
      isActive: true,
    },
    {
      id: 2,
      name: 'Mohommed Rahman',
      companyName: 'Sedress',
      email: 'rahman@sedress.com',
      accountNumber: '8848548541',
      isActive: false,
    },
    {
      id: 3,
      name: 'Mohommed Rahman',
      companyName: 'Sedress',
      email: 'rahman@sedress.com',
      accountNumber: '3516516532886',
      isActive: false,
    },
  ];

  return (
    <div className="kpi-billing-information">
      <h3 className="kpi-billing-information__title">Billing Information</h3>
      <div className="kpi-billing-information__list">
        {billingEntries.map((entry) => (
          <div key={entry.id} className="kpi-billing-card">
            <div className="kpi-billing-card__header">
              <div className="kpi-billing-card__name-section">
                <div className="kpi-billing-card__name">{entry.name}</div>
                {entry.isActive && (
                  <div className="kpi-billing-card__active-badge">
                    <DomainIcon />
                    <span>ACTIVE</span>
                  </div>
                )}
              </div>
            </div>
            <div className="kpi-billing-card__content">
              <div className="kpi-billing-card__field">
                <span className="kpi-billing-card__field-label">Company Name:</span>
                <span className="kpi-billing-card__field-value">{entry.companyName}</span>
              </div>
              <div className="kpi-billing-card__field">
                <span className="kpi-billing-card__field-label">Email Address:</span>
                <span className="kpi-billing-card__field-value">{entry.email}</span>
              </div>
              <div className="kpi-billing-card__field">
                <span className="kpi-billing-card__field-label">Account Number:</span>
                <span className="kpi-billing-card__field-value">{entry.accountNumber}</span>
              </div>
            </div>
            <div className="kpi-billing-card__actions">
              <button className="kpi-billing-card__delete">
                <DeleteIcon />
                DELETE
              </button>
              <button className="kpi-billing-card__edit">
                <EditIcon />
                EDIT
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BillingInformation;

