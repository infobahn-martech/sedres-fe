export const getAuthData = () => {
  let isLoggedIn = false;
  if (
    localStorage.getItem('accessToken') &&
    localStorage.getItem('accessToken').length
  ) {
    isLoggedIn = true;
  }
  return {
    isLoggedIn,
  };
};

export const setItem = (key, value) => localStorage.setItem(key, value);
export const getItem = (key) => localStorage.getItem(key);
export const removeItem = (key) => localStorage.removeItem(key);

// Cached GET /users/getuserdetail response; the single source for name / email / role on refresh.
export const getStoredProfile = () => {
  try {
    const raw = localStorage.getItem('userProfile');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const getStoredRoleId = () => {
  const roleId = getStoredProfile()?.role?.role_id;
  return roleId === undefined || roleId === null ? '' : String(roleId).trim();
};

// Keys older builds wrote that are now derived from userProfile (or were never read).
const LEGACY_KEYS = ['accessTokenExpiry', 'refreshTokenExpiry', 'userName', 'userEmail', 'role_id'];

export const purgeLegacyStorageKeys = () => {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
};
