import BankCard from './BankCard';
import PendingBalanceCard from './PendingBalanceCard';
import PaymentMethod from './PaymentMethod';
import BillingInformation from './BillingInformation';
import EarningTransactions from './EarningTransactions';
import '../../../design/scss/pages/kpi-dashboard/components/Earnings.scss';

const Earnings = () => {
    return (
        <div className="kpi-earnings">
            <div className="kpi-earnings__subtitle">Billing</div>
            <div className="kpi-earnings__content">
                <div className="kpi-earnings__left">
                    <div className="kpi-earnings__top-row">
                        <BankCard />
                        <PendingBalanceCard />
                    </div>
                    <PaymentMethod />
                    <BillingInformation />
                </div>
                <div className="kpi-earnings__right">
                    <EarningTransactions />
                </div>
            </div>
        </div>
    );
};

export default Earnings;

