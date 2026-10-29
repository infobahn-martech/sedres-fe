import React, { useState, useEffect } from 'react';
import { FiCamera, FiEdit2, FiX } from 'react-icons/fi';
import CustomModal from '../../../components/CustomModal';
import useAuthReducer from '../../../store/AuthReducer';
import '../../../design/scss/pages/kpi-dashboard/components/ProfileModal.scss';

const ProfileModal = ({ show, onClose }) => {
  const profileData = useAuthReducer((state) => state.profileData);

  const [isEditing, setIsEditing] = useState(false);
  const [, setAvatarFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    avatar: null,
  });

  useEffect(() => {
    if (show && profileData) {
      const userDetails = profileData?.data || profileData;
      setFormData({
        name: userDetails.name || profileData.firstName || '',
        phone: userDetails.phone || '',
        email: userDetails.email || '',
        avatar: userDetails.image || profileData.avatar || null,
      });
      setIsEditing(false);
    }
  }, [show, profileData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          avatar: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    setAvatarFile(null);
  };

  const handleCancel = () => {
    if (profileData) {
      const userDetails = profileData?.data || profileData;
      setFormData({
        name: userDetails.name || profileData.firstName || '',
        phone: userDetails.phone || '',
        email: userDetails.email || '',
        avatar: userDetails.image || profileData.avatar || null,
      });
    }
    setAvatarFile(null);
    setIsEditing(false);
  };

  const getUserInitial = () => {
    const name = formData.name || '';
    if (name) {
      return name.charAt(0).toUpperCase() || 'U';
    }
    return 'U';
  };

  const getUserFullName = () => {
    return formData.name || 'User';
  };

  const renderHeader = () => (
    <div className="profile-modal__header">
      <h2 className="profile-modal__title">Profile Details</h2>
      <button
        type="button"
        className="profile-modal__close-btn"
        onClick={() => {
          handleCancel();
          onClose();
        }}
        aria-label="Close"
      >
        <FiX size={24} />
      </button>
    </div>
  );

  const renderBody = () => (
    <div className="profile-modal__body">
      <div className="profile-modal__content">
        {/* Profile Image Section */}
        <div className="profile-modal__image-section">
          <div className="profile-modal__image-wrapper">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Profile"
                className="profile-modal__image"
              />
            ) : (
              <div className="profile-modal__image-placeholder">
                {getUserInitial()}
              </div>
            )}
            {isEditing && (
              <label
                htmlFor="profile-image-upload"
                className="profile-modal__camera-btn"
              >
                <FiCamera size={18} />
                <input
                  id="profile-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
          <div className="profile-modal__name-display">
            <h3 className="profile-modal__user-name">{getUserFullName()}</h3>
            <p className="profile-modal__user-email">{formData.email || 'No email'}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="profile-modal__form">
          <div className="profile-modal__form-row">
            <div className="profile-modal__form-group">
              <label className="profile-modal__label">
                Name
                {isEditing && <span className="profile-modal__required">*</span>}
              </label>
              <input
                type="text"
                className="profile-modal__input"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Enter name"
              />
            </div>
          </div>

          <div className="profile-modal__form-row">
            <div className="profile-modal__form-group">
              <label className="profile-modal__label">Email</label>
              <input
                type="email"
                className="profile-modal__input"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Email address"
              />
            </div>

            <div className="profile-modal__form-group">
              <label className="profile-modal__label">
                Phone
                {isEditing && <span className="profile-modal__required">*</span>}
              </label>
              <input
                type="tel"
                className="profile-modal__input"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Enter phone number"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="profile-modal__actions">
          {!isEditing ? (
            <>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--secondary"
                onClick={() => {
                  handleCancel();
                  onClose();
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--primary"
                onClick={handleEdit}
              >
                <FiEdit2 size={18} />
                Edit Profile
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--primary"
                onClick={handleSave}
              >
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <CustomModal
      className="profile-modal"
      dialgName="profile-modal__dialog"
      createModal={false}
      show={show}
      closeModal={() => {
        handleCancel();
        onClose();
      }}
      header={renderHeader()}
      body={renderBody()}
    />
  );
};

export default ProfileModal;
