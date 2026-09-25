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
import useWorkSpaceReducer from "../../../store/WorkSpaceReducer";
import useWorkFlowReducer from "../../../store/WorkFlowReducer";
import Gateway from "../../../gateway/gateway";

// Accepts an array, a comma-separated string, or a single id and returns string ids
const toIdArray = (value) => {
  if (value == null || value === "") return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map((id) => String(id).trim()).filter(Boolean);
};

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
      board_ids: [],
      workflow_ids: [],
      address: "",
    },
  });

  const watchedUsername = watch("username");
  const watchedBoardIds = watch("board_ids");
  const boardIdsKey = (watchedBoardIds || []).join(",");

  const { createUser, updateUser, addEditLoader } = useUserReducer(
    (state) => state
  );
  const { fetchRoles, roles, isLoading: isLoadingRoles } = useRoleReducer(
    (state) => state
  );
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer(
    (state) => state
  );
  const { boardsWorkflows, isLoadingBoardsWorkflows, getWorkflowsByBoards } =
    useWorkFlowReducer((state) => state);

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

  const boardSelectOptions = useMemo(
    () =>
      (workspaces || []).flatMap((w) =>
        (w.boards ?? []).map((b) => ({
          value: String(b.board_id),
          label: b.board_name,
        }))
      ),
    [workspaces]
  );

  // With several boards selected, suffix the board name so same-named workflows stay distinguishable
  const workflowSelectOptions = useMemo(() => {
    if (!boardIdsKey) return [];
    const multipleBoards = boardIdsKey.includes(",");
    return (boardsWorkflows || []).map((wf) => {
      const boardLabel = boardSelectOptions.find((b) => b.value === wf.board_id)?.label;
      return {
        value: String(wf.workflow_id),
        label: multipleBoards && boardLabel
          ? `${wf.workflow_name} (${boardLabel})`
          : wf.workflow_name,
      };
    });
  }, [boardIdsKey, boardsWorkflows, boardSelectOptions]);

  const isWorkflowsReady =
    !!boardIdsKey && !isLoadingBoardsWorkflows && workflowSelectOptions.length > 0;

  // Fetch roles when modal opens
  useEffect(() => {
    fetchRoles({ params: { page: 1, limit: 100 } });
    if (!workspaces?.length) listAllWorkspaces();
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
        board_ids: [],
        workflow_ids: [],
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
        board_ids: [],
        workflow_ids: [],
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

  // Pre-fill boards on edit once boards are loaded
  useEffect(() => {
    if (!showModal?.user_id) return;

    const incomingBoardIds = toIdArray(showModal?.board_ids).filter((id) =>
      boardSelectOptions.some((b) => b.value === id)
    );
    if (!incomingBoardIds.length) return;

    if ((getValues("board_ids") || []).join(",") !== incomingBoardIds.join(",")) {
      setValue("board_ids", incomingBoardIds, { shouldValidate: true });
    }
  }, [showModal?.user_id, showModal?.board_ids, boardSelectOptions, setValue, getValues]);

  // Load workflows for all selected boards
  useEffect(() => {
    getWorkflowsByBoards({ boardIds: boardIdsKey ? boardIdsKey.split(",") : [] });
  }, [boardIdsKey, getWorkflowsByBoards]);

  // Pre-fill workflows on edit once the boards' workflows are loaded
  useEffect(() => {
    if (!showModal?.user_id) return;
    if (!isWorkflowsReady) return;

    const incomingWorkflowIds = toIdArray(showModal?.workflow_ids).filter((id) =>
      workflowSelectOptions.some((w) => w.value === id)
    );
    if (!incomingWorkflowIds.length) return;

    if ((getValues("workflow_ids") || []).join(",") !== incomingWorkflowIds.join(",")) {
      setValue("workflow_ids", incomingWorkflowIds, { shouldValidate: true });
    }
  }, [showModal?.user_id, showModal?.workflow_ids, isWorkflowsReady, workflowSelectOptions, setValue, getValues]);

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
      (data.board_ids || []).forEach((id) => formData.append("board_ids[]", id));
      (data.workflow_ids || []).forEach((id) => formData.append("workflow_ids[]", id));

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

              {/* ===== Board + Workflow ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">Board</label>
                    <Controller
                      name="board_ids"
                      control={control}
                      render={({ field }) => (
                        <PremiumSelect
                          isMulti
                          className="premium-select--multi"
                          value={field.value || []}
                          onChange={(e) => {
                            const nextBoardIds = e.target.value;
                            field.onChange(nextBoardIds);
                            // Drop workflows that belonged to a deselected board
                            const keptWorkflowIds = new Set(
                              boardsWorkflows
                                .filter((wf) => nextBoardIds.includes(wf.board_id))
                                .map((wf) => String(wf.workflow_id))
                            );
                            setValue(
                              "workflow_ids",
                              (getValues("workflow_ids") || []).filter((id) =>
                                keptWorkflowIds.has(id)
                              )
                            );
                          }}
                          options={boardSelectOptions}
                          placeholder={
                            boardSelectOptions.length ? "Select Boards" : "Loading boards..."
                          }
                          searchPlaceholder="Search board..."
                          disabled={!boardSelectOptions.length}
                          hasError={Boolean(errors.board_ids)}
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
                  {errors.board_ids && (
                    <span className="field-error">
                      {errors.board_ids.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">Workflow</label>
                    <Controller
                      name="workflow_ids"
                      control={control}
                      render={({ field }) => (
                        <PremiumSelect
                          isMulti
                          className="premium-select--multi"
                          value={field.value || []}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={workflowSelectOptions}
                          placeholder={
                            !boardIdsKey
                              ? "Select a board first"
                              : isLoadingBoardsWorkflows
                                ? "Loading workflows..."
                                : "Select Workflows"
                          }
                          searchPlaceholder="Search workflow..."
                          disabled={!isWorkflowsReady}
                          hasError={Boolean(errors.workflow_ids)}
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
                  {errors.workflow_ids && (
                    <span className="field-error">
                      {errors.workflow_ids.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Phone + Address ===== */}
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