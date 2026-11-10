import { FiLogOut, FiX } from 'react-icons/fi';
import CustomModal from '../../../components/CustomModal';
import '../../../design/scss/pages/kpi-dashboard/components/SignOutModal.scss';

const SignOutModal = ({ show, onClose, onConfirm, isLoading }) => {
  const renderHeader = () => (
    <div className="signout-modal__header">
      <h2 className="signout-modal__title">Sign Out</h2>
      <button
        type="button"
        className="signout-modal__close-btn"
        onClick={onClose}
        aria-label="Close"
      >
        <FiX size={24} />
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="signout-modal__body">
      <div className="signout-modal__content">
        {/* Icon Section */}
        <div className="signout-modal__icon-wrapper">
          <div className="signout-modal__icon-circle">
            <FiLogOut size={48} />
          </div>
        </div>

        {/* Message Section */}
        <div className="signout-modal__message">
          <h3 className="signout-modal__question">Are you sure you want to sign out?</h3>
          <p className="signout-modal__description">
            You will need to log in again to access your account.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="signout-modal__actions">
          <button
            type="button"
            className="signout-modal__btn signout-modal__btn--secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="signout-modal__btn signout-modal__btn--primary"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="signout-modal__spinner" />
                Signing out...
              </>
            ) : (
              <>
                <FiLogOut size={18} />
                Sign Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CustomModal
      className="signout-modal"
      dialgName="signout-modal__dialog"
      createModal={false}
      show={show}
      closeModal={onClose}
      header={renderHeader()}
      body={renderBody()}
    />
  );
};

export default SignOutModal;
