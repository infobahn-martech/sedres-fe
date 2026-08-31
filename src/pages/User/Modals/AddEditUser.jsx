import { useForm, Controller } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import PhoneInput from "react-phone-input-2";
import PremiumSelect from "../../../components/form/PremiumSelect";
import "react-phone-input-2/lib/bootstrap.css";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import userIcon from "../../../assets/images/DummyProPic.avif";
import edit from "../../../assets/images/edit.svg";
import useUserReducer from "../../../store/UserReducer";
import useRoleReducer from "../../../store/RoleReducer";
import usePortReducer from "../../../store/PortReducer";
import Gateway from "../../../gateway/gateway";

export function UserModal({ showModal, closeModal, onSuccess }) {
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(
    showModal?.image || userIcon
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
    watch,
    setValue,
    getValues,
  } = useForm({
    defaultValues: {
      phone: "",
      name: "",
      username: "",
      email: "",
      roleid: "",
      port_id: "",
      address: "",
    },
  });

  const watchedUsername = watch("username");

  const { createUser, updateUser, addEditLoader } = useUserReducer(
    (state) => state
  );
  const { fetchRoles, roles, isLoading: isLoadingRoles } = useRoleReducer(
    (state) => state
  );
  const { getPorts, ports, isLoading: isLoadingPorts } = usePortReducer(
    (state) => state
  );

  // --- helpers ---
  const roleOptions = useMemo(() => {
    return (roles || []).map((r) => ({
      id: String(r?._id ?? r?.role_id ?? ""), // ✅ supports either _id or role_id
      name: r?.name || "",
    }));
  }, [roles]);

  const isRolesReady = !isLoadingRoles && roleOptions.length > 0;
  const roleSelectOptions = useMemo(
    () => roleOptions.map((role) => ({ value: role.id, label: role.name })),
    [roleOptions]
  );

  const portOptions = useMemo(() => {
    return (ports || []).map((port) => {
      const id = port?.port_id ?? port?._id ?? port?.id;
      const name = port?.port ?? port?.name ?? port?.port_name ?? "";
      return {
        id: String(id ?? ""),
        name,
      };
    });
  }, [ports]);

  const isPortsReady = !isLoadingPorts && portOptions.length > 0;
  const portSelectOptions = useMemo(
    () => portOptions.map((port) => ({ value: port.id, label: port.name })),
    [portOptions]
  );

  // Fetch roles when modal opens
  useEffect(() => {
    fetchRoles({ params: { page: 1, limit: 100 } });
    getPorts({ params: { page: 1, limit: 1000 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset other fields immediately when showModal changes (NOT role)
  useEffect(() => {
    if (showModal?.user_id) {
      reset({
        name: showModal?.name || "",
        username: showModal?.username || "",
        email: showModal?.email || "",
        phone: showModal?.phone || "",
        address: showModal?.address || "",
        roleid: "", // ✅ keep empty first, set after roles loaded
        port_id: "",
      });

      setProfileImagePreview(showModal?.avatar_path || userIcon);
      setProfileImage(null);
    } else {
      reset({
        phone: "",
        name: "",
        username: "",
        email: "",
        roleid: "",
        port_id: "",
        address: "",
      });

      setProfileImagePreview(userIcon);
      setProfileImage(null);
    }
  }, [showModal, reset]);

  // ✅ SET ROLE ONLY AFTER ROLES LOADED
  useEffect(() => {
    if (!showModal?.user_id) return; // only for edit
    if (!isRolesReady) return;

    const incomingRoleId = String(showModal?.role_id || "");
    if (!incomingRoleId) return;

    const exists = roleOptions.some((r) => r.id === incomingRoleId);
    if (!exists) return;

    // avoid extra setValue if already set
    const current = String(getValues("roleid") || "");
    if (current !== incomingRoleId) {
      setValue("roleid", incomingRoleId, { shouldValidate: true });
    }
  }, [showModal?.user_id, showModal?.role_id, isRolesReady, roleOptions, setValue, getValues]);

  useEffect(() => {
    if (!showModal?.user_id) return;
    if (!isPortsReady) return;

    const incomingPortId = String(showModal?.port_id || "");
    if (!incomingPortId) return;

    const exists = portOptions.some((p) => p.id === incomingPortId);
    if (!exists) return;

    const current = String(getValues("port_id") || "");
    if (current !== incomingPortId) {
      setValue("port_id", incomingPortId, { shouldValidate: true });
    }
  }, [showModal?.user_id, showModal?.port_id, isPortsReady, portOptions, setValue, getValues]);

  useEffect(() => {
    const usernameInput = (watchedUsername || "").trim();

    if (!usernameInput) {
      if (!showModal?.user_id) {
        setValue("username", "", { shouldValidate: true });
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await Gateway.post("/users/suggest_username", {
          name: usernameInput,
        });

        const suggestion = data?.suggestion || "";
        if (!suggestion) return;

        const currentUsername = String(getValues("username") || "");
        const existingUsername = String(showModal?.username || "");

        if (!currentUsername || currentUsername === existingUsername) {
          setValue("username", suggestion, { shouldValidate: true });
        }
      } catch (error) {
        void error;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedUsername, showModal?.user_id, showModal?.username, getValues, setValue]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();

      formData.append("name", data.name);
      formData.append("username", data.username);
      formData.append("email", data.email);
      formData.append("phone", data.phone);
      formData.append("address", data.address || "");
      formData.append("roleid", data.roleid);
      formData.append("port_id", data.port_id);

      if (profileImage) {
        formData.append("profileimg", profileImage);
      } else if (showModal?.user_id && showModal?.avatar_path) {
        // NOTE: if backend expects FILE only, remove this else-if
        formData.append("profileimg", showModal.avatar_path);
      }

      if (showModal?.user_id) {
        await updateUser({
          id: showModal?.user_id,
          formData,
          cb: () => {
            closeModal();
            onSuccess && onSuccess();
          },
        });
      } else {
        await createUser({
          formData,
          cb: () => {
            closeModal();
            onSuccess && onSuccess();
          },
        });
      }
    } catch (error) {
      void error;
    }
  };

  const renderHeader = () => (
    <>
      <h1 className="modal-title">
        {showModal?.user_id ? "Edit User" : "Add User"}
      </h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="userForm" onSubmit={handleSubmit(onSubmit)}>
          {/* ===== Avatar Upload ===== */}
          <div className="d-flex justify-content-center mb-4">
            <div className="avatar-outer">
              <div className="avatar-wrapper">
                <img
                  src={profileImagePreview}
                  alt="User Avatar"
                  className="avatar-image"
                />
              </div>
              <label htmlFor="avatarUpload" className="avatar-edit-icon">
                <img src={edit} alt="Edit" className="avatar-edit-pencil" />
              </label>

              <input
                type="file"
                id="avatarUpload"
                className="d-none"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* ===== Name + Email ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              {/* NAME */}
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <input
                      type="text"
                      className={`form-control ${errors.name ? "is-invalid" : ""}`}
                      placeholder="Name"
                      autoComplete="off"
                      {...register("name", {
                        required: "Name is required",
                        pattern: {
                          value: /^[A-Za-z\s]+$/,
                          message: "Name cannot contain numbers or special characters",
                        },
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                        },
                      })}
                    />
                    <label>
                      Name <span className="text-danger">*</span>
                    </label>
                  </div>
                  {errors.name && (
                    <span className="field-error">
                      {errors.name.message}
                    </span>
                  )}
                </div>
              </div>

              {/* EMAIL */}
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <input
                      type="email"
                      className={`form-control ${errors.email ? "is-invalid" : ""}`}
                      placeholder="Email"
                      autoComplete="off"
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Enter a valid email",
                        },
                      })}
                    />
                    <label>
                      Email <span className="text-danger">*</span>
                    </label>
                  </div>
                  {errors.email && (
                    <span className="field-error">
                      {errors.email.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Username + Role ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <input
                      type="text"
                      className={`form-control ${errors.username ? "is-invalid" : ""}`}
                      placeholder="Username"
                      {...register("username")}
                    />
                    <label>Username</label>
                  </div>
                  {errors.username && (
                    <span className="field-error">
                      {errors.username.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">
                      User Role <span className="text-danger">*</span>
                    </label>
                    <Controller
                      name="roleid"
                      control={control}
                      rules={{ required: "User role is required" }}
                      render={({ field }) => (
                        <PremiumSelect
                          value={field.value != null ? String(field.value) : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={roleSelectOptions}
                          placeholder={
                            isLoadingRoles ? "Loading roles..." : "Select User Role"
                          }
                          searchPlaceholder="Search role..."
                          disabled={!isRolesReady}
                          hasError={Boolean(errors.roleid)}
                          menuPortalTarget={
                            typeof document !== "undefined"
                              ? document.body
                              : undefined
                          }
                          menuClassName="user-modal-premium-select-menu"
                        />
                      )}
                    />
                  </div>
                  {errors.roleid && (
                    <span className="field-error">
                      {errors.roleid.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Phone + Port ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">Phone</label>

                    <Controller
                      name="phone"
                      control={control}
                      rules={{
                        validate: (value) => {
                          if (!value) return true;
                          const digits = (value || "").replace(/\D/g, "");
                          return digits.length >= 7 || "Enter a valid phone number";
                        },
                      }}
                      render={({ field }) => (
                        <PhoneInput
                          {...field}
                          country="sa"
                          enableSearch
                          inputClass="phone-input"
                          buttonClass="phone-flag"
                        />
                      )}
                    />
                  </div>
                  {errors.phone && (
                    <span className="field-error">
                      {errors.phone.message}
                    </span>
                  )}
                </div>
              </div>
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">Port</label>
                    <Controller
                      name="port_id"
                      control={control}
                      render={({ field }) => (
                        <PremiumSelect
                          value={field.value != null ? String(field.value) : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={portSelectOptions}
                          placeholder={
                            isLoadingPorts ? "Loading ports..." : "Select Port"
                          }
                          searchPlaceholder="Search port..."
                          disabled={!isPortsReady}
                          hasError={Boolean(errors.port_id)}
                          menuPortalTarget={
                            typeof document !== "undefined"
                              ? document.body
                              : undefined
                          }
                          menuClassName="user-modal-premium-select-menu"
                        />
                      )}
                    />
                  </div>
                  {errors.port_id && (
                    <span className="field-error">
                      {errors.port_id.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Address ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <textarea
                      className="form-control address-textarea"
                      placeholder="Address"
                      {...register("address")}
                    />
                    <label>Address</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button
        type="button"
        className="btn btn-outline"
        onClick={closeModal}
        disabled={addEditLoader}
      >
        Close
      </button>

      <button
        type="submit"
        form="userForm"
        className="btn btn-primary"
        disabled={addEditLoader}
      >
        {addEditLoader ? (
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        ) : showModal?.user_id ? (
          "Update"
        ) : (
          "Save"
        )}
      </button>
    </div>
  );

  return (
    <CustomModal
      className="user-modal-sm add-edit-user-modal"
      dialgName="modal-dialog modal-dialog-centered"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={renderHeader()}
    />
  );
}