import { FiX } from 'react-icons/fi';
import CustomModal from '../../components/CustomModal';
import '../../design/scss/structure/header/ToolModals.scss';

function ToolModal({ show, onClose, title, icon, className = '', children }) {
  const header = (
    <div className="tool-modal-header">
      <span className="tool-modal-icon">{icon}</span>
      <h2 className="tool-modal-title">{title}</h2>
      <button type="button" className="tool-modal-close" onClick={onClose} aria-label="Close">
        <FiX />
      </button>
    </div>
  );

  return (
    <CustomModal
      className={`modal fade show tool-modal ${className}`}
      dialgName="modal-dialog modal-dialog-centered"
      show={show}
      closeModal={onClose}
      header={header}
      body={<div className="tool-modal-body">{children}</div>}
    />
  );
}

export default ToolModal;
