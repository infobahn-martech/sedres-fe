import { create } from 'zustand';
import authService from '../services/authService';
import { getAuthData, removeItem, setItem, getItem } from '../shared/helpers/localStorage';
import useAlertReducer from './AlertReducer';
import { normalizePermissionSections } from '../shared/utils/permissions';
import { useDaLocalReachedDates, useDaLocalLaunchHire } from '../shared/store/daStore';

const { isLoggedIn } = getAuthData();

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
      const accessExpiresIn = data?.access_expires_in;
      const refreshExpiresIn = data?.refresh_expires_in;

      // ✅ user data from response
      const authData = {
        userid: data?.userid,
        name: data?.name,
        email: data?.email,
        status: data?.status,
        message: data?.message,
      };

      if (accessToken) {
        setItem("accessToken", accessToken);
        // Store expiration time if provided (in seconds, convert to timestamp)
        if (accessExpiresIn) {
          const expirationTime = Date.now() + (accessExpiresIn * 1000);
          setItem("accessTokenExpiry", expirationTime.toString());
        }
      }

      if (refreshToken) {
        setItem("refreshToken", refreshToken);
        // Store refresh token expiration time if provided
        if (refreshExpiresIn) {
          const expirationTime = Date.now() + (refreshExpiresIn * 1000);
          setItem("refreshTokenExpiry", expirationTime.toString());
        }
      }

      // Store userid in localStorage for refresh persistence
      if (data?.userid) setItem("userid", data.userid);
      // Store user name and email for fallback profile on refresh
      if (data?.name) setItem("userName", data.name);
      if (data?.email) setItem("userEmail", data.email);
      // Store vendor_id for vendor/company portal dashboards (e.g. Transport Company)
      if (data?.vendor_id != null) setItem("vendor_id", data.vendor_id);

      // Purge any previously cached profile/permissions so this login always
      // fetches authoritative permissions from getuserdetail instead of
      // reusing a stale or previously logged-in user's cached permissions.
      removeItem('userProfile');
      removeItem('role_id');

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
    removeItem('accessTokenExpiry');
    removeItem('refreshTokenExpiry');
    removeItem('userid');
    removeItem('userProfile');
    removeItem('userName');
    removeItem('userEmail');
    removeItem('role_id');
    removeItem('vendor_id');

    // These DA local-only fallback stores (see daStore.js) are in-memory,
    // keyed by call id (not by user), and only meant to be cleared by a full
    // page reload — but logout navigates client-side without one, so without
    // this reset a new user logging in on the same tab would still see the
    // previous user's unsaved DA field overrides.
    useDaLocalReachedDates.setState({ reachedDates: {} });
    useDaLocalLaunchHire.setState({ overrides: {} });
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
          name: authData.name || getItem('userName') || 'User',
          email: authData.email || getItem('userEmail') || '',
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
      const response = await authService.getUserDetail(finalUserId);
      const profileData = response.data?.data || response.data;

      // Save to localStorage for future refresh scenarios
      if (profileData) {
        setItem('userProfile', JSON.stringify(profileData));
        if (profileData.role?.role_id != null && profileData.role?.role_id !== '') {
          setItem('role_id', String(profileData.role.role_id));
        }
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
