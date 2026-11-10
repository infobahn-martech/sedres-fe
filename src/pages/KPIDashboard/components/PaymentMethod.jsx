import '../../../design/scss/pages/kpi-dashboard/components/PaymentMethod.scss';

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

const PaymentMethod = () => {
  return (
    <div className="kpi-payment-method">
      <div className="kpi-payment-method__header">
        <h3 className="kpi-payment-method__title">Payment Method</h3>
        <button className="kpi-payment-method__add-button">ADD ACCOUNT</button>
      </div>
      <div className="kpi-payment-method__fields">
        <div className="kpi-payment-method__field">
          <label className="kpi-payment-method__label">Bank Account</label>
          <div className="kpi-payment-method__input-wrapper">
            <input
              type="text"
              className="kpi-payment-method__input"
              placeholder="Enter bank account"
            />
            <button className="kpi-payment-method__edit-button">
              <EditIcon />
            </button>
          </div>
        </div>
        <div className="kpi-payment-method__field">
          <div className="kpi-payment-method__input-wrapper">
            <input
              type="text"
              className="kpi-payment-method__input"
              value="781221390823XXXX"
              readOnly
            />
            <button className="kpi-payment-method__edit-button">
              <EditIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethod;

