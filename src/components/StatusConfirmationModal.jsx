import PropTypes from 'prop-types';
import DeleteConfirmIcon from '../assets/images/delete.svg';
import '../design/scss/modal-designs.scss';
import '../design/scss/prospect-modal.scss';
import CustomModal from './CustomModal';

const StatusConfirmationModal = ({
    onCancel,
    onConfirm,
    statusText,
    show,
    isLoading,
    icon = DeleteConfirmIcon,
}) => {
    return (
        <CustomModal
            createModal
            className="modal change-pass fade employee-modal 
      logout-modal"
            show={show}
            closeModal={onCancel}
            body={
                <div className="modal-body">
                    <div className="profile-img">
                        <img src={icon} alt="" />
                    </div>
                    <div className="popup-title">{statusText}</div>
                    <div className="two-btn logout-btn">
                        <button
                            type="submit"
                            className="btn-common close"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="save btn-common red-btn"
                            onClick={onConfirm}
                        >
                            {isLoading ? (
                                <div className="spinner-border spinner-border-sm" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            ) : (
                                'Confirm'
                            )}
                        </button>
                    </div>
                </div>
            }
        />
    );
};

StatusConfirmationModal.propTypes = {
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    statusText: PropTypes.string,
    show: PropTypes.bool,
    isLoading: PropTypes.bool,
    icon: PropTypes.string,
};

export default StatusConfirmationModal;
