// Normalises the `permissions.sections` payload from GET /users/getuserdetail/{userId}
// into O(1)-lookup Sets, keyed by module_key / submodule_key / action_key only
// (never display names, never numeric permission_id). This is the new,
// permission-key based access system that runs ALONGSIDE the existing
// role_id-based checks (see rolePermissions.js, groUserRoles.js, etc.) — it does
// not replace them.
//
// NOTE: frontend permission checks only control UI visibility/navigation.
// Backend endpoints must independently validate user permissions.

export const buildCompoundKey = (...parts) => parts.filter(Boolean).join(":");

/**
 * @param {Array} sections - data.permissions.sections from getuserdetail
 * @returns {{modules: Set, moduleActions: Set, submodules: Set, submoduleActions: Set}}
 */
export const normalizePermissionSections = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      modules: new Set(),
      moduleActions: new Set(),
      submodules: new Set(),
      submoduleActions: new Set(),
    };
  }

  const modules = new Set();
  const moduleActions = new Set();
  const submodules = new Set();
  const submoduleActions = new Set();

  sections.forEach((section) => {
    const moduleKey = section?.module_key;
    if (!moduleKey) return;
    modules.add(moduleKey);

    (section.actions || []).forEach((action) => {
      if (!action?.action_key) return;
      moduleActions.add(buildCompoundKey(moduleKey, action.action_key));
    });

    (section.sub_modules || []).forEach((sub) => {
      const submoduleKey = sub?.submodule_key;
      if (!submoduleKey) return;
      submodules.add(buildCompoundKey(moduleKey, submoduleKey));

      (sub.actions || []).forEach((action) => {
        if (!action?.action_key) return;
        submoduleActions.add(
          buildCompoundKey(moduleKey, submoduleKey, action.action_key)
        );
      });
    });
  });

  return { modules, moduleActions, submodules, submoduleActions };
};

export const checkHasModule = (permissionMap, moduleKey) => {
  if (!moduleKey) return false;
  return Boolean(permissionMap?.modules?.has(moduleKey));
};

export const checkHasSubmodule = (permissionMap, moduleKey, submoduleKey) => {
  if (!moduleKey || !submoduleKey) return false;
  return Boolean(
    permissionMap?.submodules?.has(buildCompoundKey(moduleKey, submoduleKey))
  );
};

export const checkHasPermission = (
  permissionMap,
  { moduleKey, submoduleKey, actionKey } = {}
) => {
  if (!permissionMap || !moduleKey || !actionKey) return false;

  if (submoduleKey) {
    return Boolean(
      permissionMap.submoduleActions?.has(
        buildCompoundKey(moduleKey, submoduleKey, actionKey)
      )
    );
  }

  return Boolean(
    permissionMap.moduleActions?.has(buildCompoundKey(moduleKey, actionKey))
  );
};
