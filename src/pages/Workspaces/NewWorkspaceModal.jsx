import { useState, useEffect } from 'react';
import CustomModal from '../../components/CustomModal';
import BoardsListModal from './BoardsListModal';
import '../../design/scss/Workspaces.scss';

const NewWorkspaceModal = ({ show, onClose, onSave, isSaving = false }) => {
  const [, setStep] = useState('form'); // Always 'form' now - directly show Team Workspace
  const [workspaceType, setWorkspaceType] = useState('team'); // Always 'team' - skip selection
  const [showBoardsListModal, setShowBoardsListModal] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(true);
  const [formData, setFormData] = useState({
    workspaceName: '',
    boardName: '',
    boardType: 'board', // 'board' or 'aiCanvas'
    linkedBoards: [], // For management workspace
  });

  const handleBack = () => {
    // Back button now just closes the modal instead of going to selection
    handleClose();
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddLinkedBoard = () => {
    // Close New Workspace modal and open Boards List modal
    setShowNewWorkspaceModal(false);
    setShowBoardsListModal(true);
  };

  const handleBoardsListClose = () => {
    // Close Boards List modal and reopen New Workspace modal
    setShowBoardsListModal(false);
    setShowNewWorkspaceModal(true);
  };

  const handleBoardsSelect = (selectedBoards) => {
    setFormData((prev) => ({
      ...prev,
      linkedBoards: selectedBoards,
    }));
    // Close Boards List modal and reopen New Workspace modal
    setShowBoardsListModal(false);
    setShowNewWorkspaceModal(true);
  };

  const handleSave = () => {
    if (onSave && formData.workspaceName && formData.boardName) {
      onSave({
        type: workspaceType,
        ...formData,
      });
    }
    // Modal is closed by parent's callback on successful API response
  };

  const handleClose = () => {
    setStep('form');
    setWorkspaceType('team');
    setShowBoardsListModal(false);
    setShowNewWorkspaceModal(true);
    setFormData({
      workspaceName: '',
      boardName: '',
      boardType: 'board',
      linkedBoards: [],
    });
    onClose();
  };

  // Reset state when modal opens - directly show Team Workspace form
  useEffect(() => {
    if (show) {
      setStep('form');
      setWorkspaceType('team');
      setShowNewWorkspaceModal(true);
      setShowBoardsListModal(false);
      setFormData({
        workspaceName: '',
        boardName: '',
        boardType: 'board',
        linkedBoards: [],
      });
    }
  }, [show]);

  const renderTeamWorkspaceForm = () => (
    <div className="new-workspace-modal-content">
      <div className="new-workspace-modal-header">
        <h2 className="new-workspace-modal-title">Team Workspace</h2>
        <button
          type="button"
          className="new-workspace-modal-close"
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

      <div className="new-workspace-form">
        <div className="workspace-form-description">
          <div className="workspace-form-description-content">
            <p>
              The Team Workspace is a collection of Team Kanban Boards where a team collaborates. A typical Workspace name would be 'Engineering', 'Marketing', 'Operations', 'Design', etc.
            </p>
            <div className="workspace-form-illustration">
              <div className="workspace-illustration-boards">
                <div className="illustration-board board-blue"></div>
                <div className="illustration-board board-orange"></div>
                <div className="illustration-board board-green"></div>
              </div>
              <div className="illustration-connections">
                <div className="illustration-icon-left">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="illustration-icon-right">
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
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-form-fields">
          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Workspace name
              <span className="workspace-form-info-icon" title="Enter a name for your workspace">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </label>
            <input
              type="text"
              className="workspace-form-input"
              placeholder="Enter workspace name"
              value={formData.workspaceName}
              onChange={(e) => handleInputChange('workspaceName', e.target.value)}
            />
          </div>

          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Board name
              <span className="workspace-form-info-icon" title="Enter a name for your board">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </label>
            <input
              type="text"
              className="workspace-form-input"
              placeholder="Enter board name"
              value={formData.boardName}
              onChange={(e) => handleInputChange('boardName', e.target.value)}
            />
          </div>
        </div>

        <div className="workspace-form-actions">
          <button
            type="button"
            className="workspace-form-btn workspace-form-btn-cancel"
            onClick={handleBack}
          >
            Back
          </button>
          <button
            type="button"
            className="workspace-form-btn workspace-form-btn-save"
            onClick={handleSave}
            disabled={!formData.workspaceName || !formData.boardName || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderManagementWorkspaceForm = () => (
    <div className="new-workspace-modal-content">
      <div className="new-workspace-modal-header">
        <h2 className="new-workspace-modal-title">Management Workspace</h2>
        <button
          type="button"
          className="new-workspace-modal-close"
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

      <div className="new-workspace-form">
        <div className="workspace-form-description">
          <div className="workspace-form-description-content">
            <p>
              The Management Workspace allows managers to connect one or more team Kanban boards to a single Management Board and easily manage work across multiple teams.
            </p>
            <div className="workspace-form-illustration">
              <div className="workspace-illustration-hierarchy">
                <div className="illustration-top-row">
                  <div className="illustration-board board-blue"></div>
                  <div className="illustration-board board-orange"></div>
                  <div className="illustration-board board-green"></div>
                </div>
                <div className="illustration-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 11C13.5705 10.4259 13.0226 9.95085 12.3934 9.60707C11.7643 9.26329 11.0685 9.05886 10.3533 9.00766C9.63816 8.95646 8.92037 9.05972 8.24874 9.31026C7.57711 9.5608 6.96705 9.95301 6.46002 10.46L3.46002 13.46C2.54923 14.403 2.04525 15.6661 2.05664 16.977C2.06803 18.288 2.59387 19.5421 3.52091 20.4691C4.44795 21.3962 5.70202 21.922 7.013 21.9334C8.32398 21.9448 9.58699 21.4408 10.53 20.53L12.24 18.82"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="illustration-bottom-row">
                  <div className="illustration-board board-blue"></div>
                  <div className="illustration-board board-orange"></div>
                  <div className="illustration-board board-green"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-form-fields">
          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Workspace name
              <span className="workspace-form-info-icon" title="Enter a name for your workspace">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </label>
            <input
              type="text"
              className="workspace-form-input"
              placeholder="Enter workspace name"
              value={formData.workspaceName}
              onChange={(e) => handleInputChange('workspaceName', e.target.value)}
            />
          </div>

          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Management board
            </label>
            <div className="workspace-form-radio-group">
              <label className="workspace-form-radio">
                <input
                  type="radio"
                  name="managementBoardType"
                  value="aiCanvas"
                  checked={formData.boardType === 'aiCanvas'}
                  onChange={() => handleInputChange('boardType', 'aiCanvas')}
                />
                <span className="workspace-form-radio-label">
                  AI Canvas
                  <span className="workspace-form-info-icon" title="AI Canvas board type">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
              </label>
              <label className="workspace-form-radio">
                <input
                  type="radio"
                  name="managementBoardType"
                  value="board"
                  checked={formData.boardType === 'board'}
                  onChange={() => handleInputChange('boardType', 'board')}
                />
                <span className="workspace-form-radio-label">
                  Board
                  <span className="workspace-form-info-icon" title="Standard board type">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Board name
              <span className="workspace-form-info-icon" title="Enter a name for your board">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </label>
            <input
              type="text"
              className="workspace-form-input"
              placeholder="Enter board name"
              value={formData.boardName}
              onChange={(e) => handleInputChange('boardName', e.target.value)}
            />
          </div>

          <div className="workspace-form-field">
            <label className="workspace-form-label">
              Linked boards
              <span className="workspace-form-info-icon" title="Add team boards to link to this management board">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8M8 11H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </label>
            {formData.linkedBoards.length > 0 ? (
              <div className="workspace-form-linked-boards-list">
                {formData.linkedBoards.map((board) => (
                  <div key={board.id} className="workspace-form-linked-board-item">
                    <span className="workspace-form-linked-board-name">{board.name}</span>
                    <button
                      type="button"
                      className="workspace-form-linked-board-remove"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          linkedBoards: prev.linkedBoards.filter((b) => b.id !== board.id),
                        }));
                      }}
                      aria-label="Remove board"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M12 4L4 12M4 4L12 12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="workspace-form-add-linked-board-small"
                  onClick={handleAddLinkedBoard}
                  title="Add more boards"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="workspace-form-add-linked-board"
                onClick={handleAddLinkedBoard}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="workspace-form-actions">
          <button
            type="button"
            className="workspace-form-btn workspace-form-btn-cancel"
            onClick={handleBack}
          >
            Back
          </button>
          <button
            type="button"
            className="workspace-form-btn workspace-form-btn-save"
            onClick={handleSave}
            disabled={!formData.workspaceName || !formData.boardName || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CustomModal
        show={show && showNewWorkspaceModal}
        closeModal={handleClose}
        className="new-workspace-modal"
        dialgName="new-workspace-modal-dialog"
        createModal={false}
        body={
          <>
            {workspaceType === 'team' && renderTeamWorkspaceForm()}
            {workspaceType === 'management' && renderManagementWorkspaceForm()}
          </>
        }
      />
      <BoardsListModal
        show={showBoardsListModal}
        onClose={handleBoardsListClose}
        onSelect={handleBoardsSelect}
      />
    </>
  );
};

export default NewWorkspaceModal;

