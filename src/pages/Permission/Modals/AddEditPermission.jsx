import { useEffect, useMemo, useState } from "react";
import CustomModal from "../../../components/CustomModal";
import usePermissionReducer from "../../../store/PermissionReducer";
import useAlertReducer from "../../../store/AlertReducer";
import "../../../design/scss/add-permissions.scss";

// Unique toggle ID builder
const buildToggleId = (...parts) => `toggle_${parts.join("_")}`;

// -------------------------------------------
//  TRANSFORM API RESPONSE TO COMPONENT STRUCTURE (Permission page - sub_modules/actions)
// -------------------------------------------
const mapAction = (action) => ({
  id: action.permission_id,
  title: action.action_name,
  permissionId: action.permission_id,
});

const transformPermissionsData = (apiData) => {
  if (!apiData || !Array.isArray(apiData)) return [];

  return apiData.map((level1Item) => {
    const section = {
      id: level1Item.permission_id,
      title: level1Item.module_name,
      permissionId: level1Item.permission_id,
    };

    const hasSubModules = level1Item.sub_modules && level1Item.sub_modules.length > 0;
    const hasActions = level1Item.actions && level1Item.actions.length > 0;

    // Direct actions on the level 1 module (e.g. Dashboard-style, or alongside sub_modules)
    section.items = hasActions ? level1Item.actions.map(mapAction) : [];

    // Sub-modules (level 2), each with their own actions (level 3)
    if (hasSubModules) {
      section.subSections = level1Item.sub_modules.map((subModule) => ({
        id: subModule.permission_id,
        title: subModule.submodule_name,
        permissionId: subModule.permission_id,
        items: (subModule.actions ?? []).map(mapAction),
      }));
    }

    return section;
  });
};

// -------------------------------------------
//  MAIN COMPONENT
// -------------------------------------------
export function PermissionModal({
  showModal,
  closeModal,
  userPermissions,
  selectedUser,
  onSuccess,
  updateUserPermission,
  isUpdatingUserPermission,
}) {
  const isUserPermissionMode =
    !!userPermissions && Array.isArray(userPermissions);

  const isEditMode =
    showModal &&
    typeof showModal === "object" &&
    !Array.isArray(showModal) &&
    !isUserPermissionMode;
  const editData = isEditMode ? showModal : null;

  const {
    permissionsList,
    isLoadingPermissions: isLoadingPermissionsList,
    fetchPermissionsList,
    fetchRolePermission,
    assignRolePermission,
    updateRolePermission,
    isBeingUpdated,
  } = usePermissionReducer();

  const { error: showError } = useAlertReducer();

  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [roleText, setRoleText] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleError, setRoleError] = useState("");

  // When opened from User page: list comes from full permissionsList; loading = list loading
  const isLoadingPermissions = isLoadingPermissionsList;

  // Fetch full permissions list when modal opens (both Permission page and User page)
  useEffect(() => {
    if (showModal) {
      setRoleError("");
      fetchPermissionsList();
      if (!isUserPermissionMode) {
        if (isEditMode && editData) {
          const roleId = editData.role_id ?? editData._id ?? editData.id;
          setRoleText(editData.role ?? "");
          setRoleDescription(editData.description ?? "");
          setSelectedPermissions(new Set());
          if (roleId) {
            fetchRolePermission({ role_id: roleId }).then(({ data }) => {
              if (!data) return;
              if (data.description)
                setRoleDescription(data.description ?? "");
              if (Array.isArray(data?.permission_ids)) {
                setSelectedPermissions(new Set(data.permission_ids.map(Number)));
              } else if (data?.permissions?.length) {
                const ids = new Set(
                  data.permissions.map((p) => Number(p.permission_id ?? p.id ?? p))
                );
                setSelectedPermissions(ids);
              } else if (Array.isArray(data?.permission_id)) {
                setSelectedPermissions(new Set(data.permission_id.map(Number)));
              } else if (Array.isArray(data)) {
                const allowed = data
                  .filter((p) => p.is_allowed === "1" || p.is_allowed === 1)
                  .map((p) => Number(p.permission_id ?? p.id ?? p));
                setSelectedPermissions(new Set(allowed));
              }
            });
          }
        } else {
          setRoleText("");
          setRoleDescription("");
          setSelectedPermissions(new Set());
          setRoleError("");
        }
      }
    }
  }, [
    showModal,
    isUserPermissionMode,
    isEditMode,
    editData,
    fetchPermissionsList,
    fetchRolePermission,
  ]);

  // When opened from User page: pre-fill from getUserPermissions (is_allowed === '1'), or reset when none/error
  useEffect(() => {
    if (showModal && isUserPermissionMode && selectedUser) {
      if (userPermissions?.length) {
        const allowed = new Set(
          userPermissions
            .filter((p) => p.is_allowed === "1" || p.is_allowed === 1)
            .map((p) => Number(p.permission_id))
        );
        setSelectedPermissions(allowed);
        const first = userPermissions[0];
        if (first?.role) setRoleText(String(first.role));
        else if (selectedUser?.role) setRoleText(String(selectedUser.role));
      } else {
        setSelectedPermissions(new Set());
        setRoleText("");
        setRoleDescription("");
      }
    }
  }, [showModal, isUserPermissionMode, selectedUser, userPermissions]);

  // Always use full permissions list for display (same structure as Permission page)
  const PERMISSION_SECTIONS = useMemo(() => {
    return transformPermissionsData(permissionsList);
  }, [permissionsList]);

  // Handle permission checkbox change
  const handlePermissionChange = (permissionId, checked) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (checked) newSet.add(Number(permissionId));
      else newSet.delete(Number(permissionId));
      return newSet;
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isUserPermissionMode) {
      if (!selectedUser?.user_id) {
        showError("Invalid user");
        return;
      }

      const permissions = Array.from(
        // Build the full list: every known permission id mapped to is_allowed
        (permissionsList ?? []).flatMap((level1) => {
          const collectIds = (item) => {
            const ids = [item.permission_id];
            if (item.subpermission?.length) {
              item.subpermission.forEach((sub) => ids.push(...collectIds(sub)));
            }
            return ids;
          };
          return collectIds(level1);
        })
      ).map((permission_id) => ({
        permission_id,
        is_allowed: selectedPermissions.has(permission_id) ? 1 : 0,
      }));

      const cb = () => {
        onSuccess?.();
        closeModal?.(null);
      };

      await updateUserPermission?.({
        user_id: selectedUser.user_id,
        permissions,
        cb,
      });
      return;
    }

    const role = roleText?.trim();
    if (!role) {
      setRoleError("Role name is required");
      return;
    }
    setRoleError("");

    if (selectedPermissions.size === 0) {
      showError("Please select at least one permission");
      return;
    }

    const permissionIdArray = Array.from(selectedPermissions).map(Number);
    const cb = () => {
      onSuccess?.();
      closeModal?.(null);
    };

    if (isEditMode && editData) {
      const roleId = editData.role_id ?? editData._id ?? editData.id;
      if (!roleId) {
        showError("Invalid role for update");
        return;
      }
      await updateRolePermission({
        role_id: roleId,
        role,
        description: roleDescription?.trim() ?? "",
        permission_id: permissionIdArray,
        cb,
      });
    } else {
      await assignRolePermission({
        role,
        description: roleDescription?.trim() ?? "",
        permission_id: permissionIdArray,
        cb,
      });
    }
  };

  // Check if a permission is selected
  const isPermissionSelected = (permissionId) => selectedPermissions.has(Number(permissionId));

  // Toggle a sub-module together with all of its actions
  const handleSubToggle = (sub, checked) => {
    const permissionIds = [
      Number(sub.permissionId || sub.id),
      ...(sub.items ?? []).map((item) => Number(item.permissionId || item.id)),
    ];

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      permissionIds.forEach((id) => {
        if (checked) newSet.add(id);
        else newSet.delete(id);
      });
      return newSet;
    });
  };

  // -------------------------------------------
  //  Single checkbox row
  // -------------------------------------------
  const renderCheckRow = ({ id, title, checked, onChange, nested = false }) => (
    <div className={`permRow${nested ? " permRow--nested" : ""}`} key={id}>
      <input
        type="checkbox"
        className="form-check-input"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{title}</label>
    </div>
  );

  const renderActionRow = (idParts, item, nested) => {
    const itemPermissionId = item.permissionId || item.id;
    return renderCheckRow({
      id: buildToggleId(...idParts, item.id),
      title: item.title,
      checked: isPermissionSelected(itemPermissionId),
      onChange: (checked) => handlePermissionChange(itemPermissionId, checked),
      nested,
    });
  };

  // -------------------------------------------
  //  Render Level 2 (sub-module + indented actions)
  // -------------------------------------------
  const renderSubLevel = (section, sub) => {
    const hasItems = sub.items && sub.items.length > 0;
    const isSubSelected =
      isPermissionSelected(sub.permissionId || sub.id) ||
      (hasItems &&
        sub.items.some((item) =>
          isPermissionSelected(item.permissionId || item.id)
        ));

    return (
      <div className="permGroup" key={sub.id}>
        {renderCheckRow({
          id: buildToggleId(section.id, sub.id),
          title: sub.title,
          checked: isSubSelected,
          onChange: (checked) => handleSubToggle(sub, checked),
        })}
        {hasItems &&
          sub.items.map((item) =>
            renderActionRow([section.id, sub.id], item, true)
          )}
      </div>
    );
  };

  // -------------------------------------------
  //  Render Level 1 (column)
  // -------------------------------------------
  const renderTopLevel = (section) => (
    <div className="permColumn" key={section.id}>
      <h6 className="permColumn-title">{section.title}</h6>
      {section.items?.map((item) => renderActionRow([section.id], item, false))}
      {section.subSections?.map((sub) => renderSubLevel(section, sub))}
    </div>
  );

  // -------------------------------------------
  //  Body
  // -------------------------------------------
  const renderBody = () => (
    <div className="modal-body">
      <div className="addPermissions">
        <form id="permissionForm" onSubmit={handleSubmit}>
          {/* UPDATED: Role Text Field + Description Textarea (right side) */}
          <div className="permInputs row g-3">
            <div className="col-md-6">
              <div className="form-field">
                <div className="form-floating desig-inp">
                  <input
                    type="text"
                    className={`form-control${roleError ? " is-invalid" : ""}`}
                    id="floatingRole"
                    placeholder="Role"
                    value={
                      isUserPermissionMode && selectedUser
                        ? selectedUser.role ?? userPermissions?.[0]?.role ?? ""
                        : roleText
                    }
                    readOnly={isUserPermissionMode && selectedUser}
                    onChange={(e) => {
                      setRoleText(e.target.value);
                      if (roleError) setRoleError("");
                    }}
                  />
                  <label htmlFor="floatingRole">Role
                    <span className="text-danger">*</span>
                  </label>
                </div>
                {roleError && (
                  <span className="field-error">{roleError}</span>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <div className="form-field">
                <div className="form-floating desig-inp">
                  <textarea
                    className="form-control permission-description-textarea"
                    id="floatingDesc"
                    placeholder="Description"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    readOnly={isUserPermissionMode && selectedUser}
                  />
                  <label htmlFor="floatingDesc">Description</label>
                </div>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoadingPermissions && (
            <div className="text-center py-4">
              <p>Loading permissions...</p>
            </div>
          )}

          {/* Render dynamic sections */}
          {!isLoadingPermissions && PERMISSION_SECTIONS.length > 0 && (
            <div className="permColumns">
              {PERMISSION_SECTIONS.map((section) => renderTopLevel(section))}
            </div>
          )}

          {/* Empty state */}
          {!isLoadingPermissions && PERMISSION_SECTIONS.length === 0 && (
            <div className="text-center py-4">
              <p>No permissions available</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  // -------------------------------------------
  //  Footer
  // -------------------------------------------
  const renderFooter = () => {
    const isSaving = isUserPermissionMode
      ? !!isUpdatingUserPermission
      : !!isBeingUpdated;

    return (
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => closeModal?.(null)}
          disabled={isSaving}
        >
          Close
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          form="permissionForm"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    );
  };

  return (
    <CustomModal
      className="modal fade addPermissionMod show"
      dialgName="custom-mod custom-mod-xl modal-dialog modal-dialog-centered modal-dialog-scrollable"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={
        <h1 className="modal-title fs-5">
          {isUserPermissionMode && selectedUser
            ? `User Permissions - ${selectedUser.firstName ?? selectedUser.name ?? "User"}`
            : isEditMode
              ? "Edit Designation and Permission"
              : "Add Designation and Permission"}
        </h1>
      }
    />
  );
}
