import { useState, useEffect } from 'react';
import CustomModal from '../../components/CustomModal';
import PremiumSelect from '../../components/form/PremiumSelect';
import usePortReducer from '../../store/PortReducer';
import '../../design/scss/Workspaces.scss';

const AddBoardModal = ({ show, onClose, onSave, workspaceId, isSaving = false }) => {
  const [boardName, setBoardName] = useState('');
  const [portId, setPortId] = useState('');
  const { ports, getPorts } = usePortReducer((s) => s);

  useEffect(() => {
    if (show) {
      setBoardName('');
      setPortId('');
      getPorts({ params: { limit: 1000 } });
    }
  }, [show]);

  const portOptions = (ports ?? []).map((p) => {
    const id = p?.port_id ?? p?._id ?? p?.id;
    return {
      value: String(id ?? ''),
      label: String(p?.port ?? p?.name ?? p?.port_name ?? id ?? ''),
    };
  });

  const canSave = Boolean(boardName?.trim()) && Boolean(portId);

  const handleSave = () => {
    if (onSave && canSave) {
      onSave({
        workspaceId,
        boardName: boardName.trim(),
        portId: Number(portId),
      });
    }
    // Modal closes via parent's callback on successful API response
  };

  const handleClose = () => {
    setBoardName('');
    setPortId('');
    onClose();
  };

  return (
    <>
      <CustomModal
        show={show}
        closeModal={handleClose}
        className="add-board-modal"
        dialgName="add-board-modal-dialog"
        createModal={false}
        body={
          <div className="add-board-modal-content">
            {/* Header */}
            <div className="add-board-modal-header">
              <h2 className="add-board-modal-title">Board</h2>
              <button
                type="button"
                className="add-board-modal-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M15 5L5 15M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Description Section */}
            <div className="add-board-description">
              <div className="add-board-description-content">
                <p>
                  The Team Board allows your team to visualize, track, and manage their work in a single place. This board helps your team stay aligned and organized while working on tasks and goals together.
                </p>
                <div className="add-board-illustration">
                  <div className="add-board-illustration-container">
                    <div className="add-board-illustration-icon-top">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M3 12L7 8M7 8L3 4M7 8H21M21 12L17 16M17 16L21 20M17 16H3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="add-board-illustration-icon-bottom">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                        />
                        <path
                          d="M8 8H16M8 12H16M8 16H12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="add-board-illustration-boards">
                      <div className="add-board-illustration-board board-blue">
                        <div className="board-top-border"></div>
                        <div className="board-content">
                          <div className="board-line"></div>
                          <div className="board-line"></div>
                          <div className="board-line-short"></div>
                        </div>
                      </div>
                      <div className="add-board-illustration-board board-orange">
                        <div className="board-top-border"></div>
                        <div className="board-content">
                          <div className="board-line"></div>
                          <div className="board-line"></div>
                          <div className="board-line-short"></div>
                        </div>
                      </div>
                      <div className="add-board-illustration-board board-green">
                        <div className="board-top-border"></div>
                        <div className="board-content">
                          <div className="board-line"></div>
                          <div className="board-line"></div>
                          <div className="board-line-short"></div>
                        </div>
                      </div>
                    </div>
                    <svg className="add-board-illustration-dashed-line" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
                      <line x1="18%" y1="55%" x2="10%" y2="92%" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                      <line x1="82%" y1="45%" x2="90%" y2="8%" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="add-board-form-fields add-board-form-fields--row">
              <div className="add-board-form-field">
                <label className="add-board-form-label">
                  Board name
                </label>
                <input
                  type="text"
                  className="add-board-form-input"
                  placeholder="Enter board name"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </div>
              <div className="add-board-form-field">
                <label className="add-board-form-label">
                  Port
                </label>
                <PremiumSelect
                  className="add-board-port-select"
                  value={portId}
                  onChange={(e) => setPortId(e.target.value)}
                  options={portOptions}
                  placeholder="Select Port"
                  searchPlaceholder="Search port..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="add-board-form-actions">
              <button
                type="button"
                className="add-board-form-btn add-board-form-btn-cancel"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="add-board-form-btn add-board-form-btn-save"
                onClick={handleSave}
                disabled={!canSave || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        }
      />
    </>
  );
};

export default AddBoardModal;

