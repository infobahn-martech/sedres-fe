import { create } from 'zustand';
import authService from '../services/authService';
import {
  getAuthData,
  removeItem,
  setItem,
  getItem,
  purgeLegacyStorageKeys,
} from '../shared/helpers/localStorage';
import useAlertReducer from './AlertReducer';
import { normalizePermissionSections } from '../shared/utils/permissions';
import { useDaLocalReachedDates, useDaLocalLaunchHire, useDaLocalVerifiedItems } from './daStore';

const { isLoggedIn } = getAuthData();

// Clear keys left behind by older builds for sessions that never log out.
purgeLegacyStorageKeys();

// New module/submodule/action permission system, additive to the existing
// role_id-based checks used throughout the app — see rolePermissions.js,
// groUserRoles.js, etc. Derived from profileData.permissions.sections
// (GET /users/getuserdetail/{userId}) whenever the profile is set, so it
// persists across refresh via the same userProfile localStorage cache and is
// cleared on logout. Defaults to an empty map (== no access) while loading
// or when the API doesn't return permissions.
const derivePermissionState = (profileData) => ({
  permissionMap: normalizePermissionSections(profileData?.permissions?.sections),
});

// Shared in-flight getUserDetail request so concurrent callers (login() and
// PrivateRoutes' mount effect) reuse one network call instead of duplicating it.
let pendingProfileRequest = null;

const fetchUserDetailOnce = (userId) => {
  if (pendingProfileRequest?.userId === userId) return pendingProfileRequest.promise;
  const request = {
    userId,
    promise: authService.getUserDetail(userId).finally(() => {
      if (pendingProfileRequest === request) pendingProfileRequest = null;
    }),
  };
  pendingProfileRequest = request;
  return request.promise;
};

const useAuthReducer = create((set) => ({
  authData: null,
  userProfile: null,
  isLoginLoading: false,
  isLoggedIn,
  errorMessage: '',
  successMessage: '',
  profileData: null,
  profileEditLoader: null,
  isProfileFetchLoading: false,
  permissionMap: normalizePermissionSections(undefined),
  isFirstLogin: false,
  login: async ({ email, password, remember_me = false }) => {
    try {
      set({ isLoginLoading: true, errorMessage: "" });

      const { data } = await authService.doLoginValidate(email, password, remember_me);

      // ✅ token location based on your response
      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token;

      // ✅ user data from response
      const authData = {
        userid: data?.userid,
        name: data?.name,
        email: data?.email,
        status: data?.status,
        message: data?.message,
      };

      if (accessToken) setItem("accessToken", accessToken);
      if (refreshToken) setItem("refreshToken", refreshToken);

      // userid survives refresh and keys the cached userProfile (which holds name / email / role).
      if (data?.userid) setItem("userid", data.userid);
      // Store vendor_id for vendor/company portal dashboards (e.g. Transport Company)
      if (data?.vendor_id != null) setItem("vendor_id", data.vendor_id);

      // Purge any previously cached profile/permissions so this login always
      // fetches authoritative permissions from getuserdetail instead of
      // reusing a stale or previously logged-in user's cached permissions.
      removeItem('userProfile');

      set({
        authData,
        isLoggedIn: true,
        isLoginLoading: false,
        errorMessage: "",
        isFirstLogin: !!data?.is_first_login,
      });
      const { success } = useAlertReducer.getState();
      success(data && data.message);

      // If token and userid exist, fetch user details (with API call on login)
      if (accessToken && data?.userid) {
        const { getUserProfile } = useAuthReducer.getState();
        getUserProfile(data.userid, false); // false = allow API call on login
      }
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Login failed. Please try again.",
        isLoginLoading: false,
      });
      error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please try again."
      );
    }
  },
  googleLogin: async ({ token, tokenType }) => {
    try {
      set({ isLoginLoading: true });
      const { data } = await authService.googleLoginValidate(
        token.access_token,
        tokenType,
      );
      const authData = data.data.userData;
      setItem('accessToken', data.data.token.accessToken);
      setItem('refreshToken', data.data.token.refreshToken);
      set({ authData, isLoggedIn: true, isLoginLoading: false });
    } catch (err) {
      set({
        errorMessage: err?.response?.data?.message ?? err?.message,
        isLoginLoading: false,
      });
    }
  },
  doLogout: () => {
    set({
      userProfile: null,
      profileData: null,
      authData: null,
      successMessage: '',
      isLoggedIn: false,
      errorMessage: null,
      ...derivePermissionState(null),
    });
    removeItem('accessToken');
    removeItem('refreshToken');
    removeItem('userid');
    removeItem('userProfile');
    removeItem('vendor_id');
    purgeLegacyStorageKeys();

    // These DA local-only fallback stores (see daStore.js) are in-memory,
    // keyed by call id (not by user), and only meant to be cleared by a full
    // page reload — but logout navigates client-side without one, so without
    // this reset a new user logging in on the same tab would still see the
    // previous user's unsaved DA field overrides.
    useDaLocalReachedDates.setState({ reachedDates: {} });
    useDaLocalLaunchHire.setState({ overrides: {} });
    useDaLocalVerifiedItems.setState({ verifiedItemIds: {} });
  },
  getUserProfile: async (userId = null, skipApiCall = false) => {
    try {
      set({ isProfileFetchLoading: true });

      // Get userId from parameter, authData state, or localStorage
      const state = useAuthReducer.getState();
      const finalUserId = userId || state.authData?.userid || getItem('userid');

      if (!finalUserId) {
        throw new Error("User ID is required to fetch user profile");
      }

      // Try to get cached profile from localStorage first (for refresh scenarios)
      const cachedProfile = getItem('userProfile');
      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          // Use cached profile if it belongs to the same user
          if (parsedProfile.userid === finalUserId || parsedProfile.userid === getItem('userid')) {
            set({
              profileData: parsedProfile,
              userProfile: parsedProfile,
              isProfileFetchLoading: false,
              ...derivePermissionState(parsedProfile),
            });
            // If skipApiCall is true (refresh scenario), don't make API call
            if (skipApiCall) {
              return;
            }
          }
        } catch {
          // If parsing fails, continue to API call
        }
      }

      // Skip API call if explicitly requested (for refresh scenarios)
      if (skipApiCall) {
        // Create fallback profile from available data without API call
        const authData = state.authData || {};
        let role = { role_id: '2' }; // Default to Admin role
        let permissions;

        // Try to get role/permissions from cached profile if available
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.role) {
              role = parsed.role;
            }
            if (parsed.permissions) {
              permissions = parsed.permissions;
            }
          } catch {
            // Use default role if parsing fails
          }
        }

        const fallbackProfileData = {
          userid: finalUserId,
          name: authData.name || 'User',
          email: authData.email || '',
          status: authData.status || 'active',
          role: role,
          permissions,
          ...authData
        };
        set({
          profileData: fallbackProfileData,
          userProfile: fallbackProfileData,
          isProfileFetchLoading: false,
          ...derivePermissionState(fallbackProfileData),
        });
        return;
      }

      // Always use getUserDetail endpoint (only if not skipping)
      const response = await fetchUserDetailOnce(finalUserId);
      const profileData = response.data?.data || response.data;

      // Save to localStorage for future refresh scenarios
      if (profileData) {
        setItem('userProfile', JSON.stringify(profileData));
      }

      set({
        profileData,
        userProfile: profileData,
        isProfileFetchLoading: false,
        ...derivePermissionState(profileData),
      });
    } catch {
      // Always return success with fallback profile data
      const state = useAuthReducer.getState();
      const authData = state.authData || {};

      // Try to get cached profile
      const cachedProfile = getItem('userProfile');
      let fallbackProfileData;

      if (cachedProfile) {
        try {
          fallbackProfileData = JSON.parse(cachedProfile);
        } catch {
          // If parsing fails, create new fallback
          fallbackProfileData = {
            userid: authData.userid || userId || getItem('userid'),
            name: authData.name || 'User',
            email: authData.email || '',
            status: authData.status || 'active',
            role: { role_id: '2' }, // Default to Admin role
            ...authData
          };
        }
      } else {
        // Create fallback profile data based on available auth data
        fallbackProfileData = {
          userid: authData.userid || userId || getItem('userid'),
          name: authData.name || 'User',
          email: authData.email || '',
          status: authData.status || 'active',
          role: { role_id: '2' }, // Default to Admin role
          ...authData
        };
      }

      set({
        profileData: fallbackProfileData,
        userProfile: fallbackProfileData,
        isProfileFetchLoading: false,
        ...derivePermissionState(fallbackProfileData),
      });

    }
  },

  patchUserProfile: async ({ value, cb }) => {
    try {
      set({ profileEditLoader: true });
      const { data } = await authService.editUserProfile(value);
      const profileData = data.data;
      set({ profileData, profileEditLoader: false });
      const { success } = useAlertReducer.getState();
      success(data && data.message);
      cb && cb();
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage: 'Something went wrong updating user profile',
        profileEditLoader: false,
      });
      error(err?.response?.data?.message ?? err.message);
    }
  },
  forgotPassword: async ({ email }) => {
    try {
      set({ isLoginLoading: true, errorMessage: "" });
      const { data } = await authService.forgotPassword(email);
      set({ isLoginLoading: false, errorMessage: "" });
      const { success } = useAlertReducer.getState();
      success(data?.message || "Password reset link sent to your email");
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to send reset link. Please try again.",
        isLoginLoading: false,
      });
      error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send reset link. Please try again."
      );
    }
  },
  resetPassword: async ({ token, user_id, new_password }) => {
    try {
      set({ isLoginLoading: true, errorMessage: "" });
      const { data } = await authService.resetPassword({ token, user_id, new_password });
      set({ isLoginLoading: false, errorMessage: "", successMessage: data?.message || "Password reset successfully" });
      const { success } = useAlertReducer.getState();
      success(data?.message || "Password reset successfully");
      return { success: true, message: data?.message || "Password reset successfully" };
    } catch (err) {
      const { error } = useAlertReducer.getState();
      set({
        errorMessage:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to reset password. Please try again.",
        isLoginLoading: false,
      });
      error(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to reset password. Please try again."
      );
      return { success: false, error: err?.response?.data?.message || err?.message || "Failed to reset password. Please try again." };
    }
  },
  clearFirstLogin: () => set({ isFirstLogin: false }),
}));

export default useAuthReducer;
