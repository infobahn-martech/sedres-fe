import { create } from 'zustand';
import businessRuleService from '../services/businessRuleService';
import useAlertReducer from './AlertReducer';

// Guards getCustomFields against out-of-order responses: if the board/disabled/search
// filters change again before an in-flight request resolves, an older response landing
// after the newer one would otherwise silently overwrite the store with stale data.
let customFieldsRequestId = 0;
// Separate request-id guard for recipientCustomFields (below) — kept as its own
// counter/slice so resolving a saved notify action's to/cc custom-field labels on
// reopen never races with or clobbers the board-filtered list the "add custom
// fields" picker modal loads into the shared `customFields` slice above.
let recipientCustomFieldsRequestId = 0;

const useBusinessRuleReducer = create((set) => ({
    isLoadingGet: false,
    triggerTypes: [],

    getTriggerTypes: async ({ params } = {}) => {
        try {
            set({ isLoadingGet: true });
            const { data } = await businessRuleService.getTriggerTypes({ params });
            set({
                triggerTypes: data?.data ?? [],
                isLoadingGet: false,
            });
        } catch (err) {
            set({ triggerTypes: [], isLoadingGet: false });
        }
    },

    isLoadingFields: false,
    fields: [],

    getFields: async ({ params } = {}) => {
        try {
            set({ isLoadingFields: true });
            const { data } = await businessRuleService.getFields({ params });
            set({
                fields: data?.data ?? [],
                isLoadingFields: false,
            });
        } catch (err) {
            set({ fields: [], isLoadingFields: false });
        }
    },

    isLoadingTimeUnits: false,
    timeUnits: [],

    getTimeUnits: async ({ params } = {}) => {
        try {
            set({ isLoadingTimeUnits: true });
            const { data } = await businessRuleService.getTimeUnits({ params });
            set({
                timeUnits: data?.data ?? [],
                isLoadingTimeUnits: false,
            });
        } catch (err) {
            set({ timeUnits: [], isLoadingTimeUnits: false });
        }
    },

    isLoadingCustomFields: false,
    customFields: [],

    getCustomFields: async ({ params } = {}) => {
        const requestId = ++customFieldsRequestId;
        try {
            set({ isLoadingCustomFields: true });
            const { data } = await businessRuleService.getCustomFields({ params });
            if (requestId !== customFieldsRequestId) return;
            set({
                customFields: data?.data ?? [],
                isLoadingCustomFields: false,
            });
        } catch (err) {
            if (requestId !== customFieldsRequestId) return;
            set({ customFields: [], isLoadingCustomFields: false });
        }
    },

    // Unscoped (no board filter) custom-field list, fetched once a saved notify action's
    // settings load, used only to resolve to_custom_fields/cc_custom_fields ids back to a
    // real label on reopen — get_field_details/{type}/{id} returns operator/config info,
    // not a display label, so it can't be relied on for this the way it can for a
    // condition row's operator dropdown.
    isLoadingRecipientCustomFields: false,
    recipientCustomFields: [],

    getRecipientCustomFields: async ({ params } = {}) => {
        const requestId = ++recipientCustomFieldsRequestId;
        try {
            set({ isLoadingRecipientCustomFields: true });
            const { data } = await businessRuleService.getCustomFields({ params });
            if (requestId !== recipientCustomFieldsRequestId) return;
            set({
                recipientCustomFields: data?.data ?? [],
                isLoadingRecipientCustomFields: false,
            });
        } catch (err) {
            if (requestId !== recipientCustomFieldsRequestId) return;
            set({ recipientCustomFields: [], isLoadingRecipientCustomFields: false });
        }
    },

    isLoadingRegularFields: false,
    regularFields: [],

    getRegularFields: async ({ params } = {}) => {
        try {
            set({ isLoadingRegularFields: true });
            const { data } = await businessRuleService.getRegularFields({ params });
            set({
                regularFields: data?.data ?? [],
                isLoadingRegularFields: false,
            });
        } catch (err) {
            set({ regularFields: [], isLoadingRegularFields: false });
        }
    },

    isLoadingThenActionFields: false,
    thenActionRegularFields: [],
    thenActionCustomFields: [],
    thenActionTimeUnits: [],

    getThenActionFields: async (actionTypeId, { params } = {}) => {
        try {
            set({ isLoadingThenActionFields: true });
            const { data } = await businessRuleService.getThenActionFields(actionTypeId, { params });
            set({
                thenActionRegularFields: data?.data?.regular_fields ?? [],
                thenActionCustomFields: data?.data?.custom_fields ?? [],
                thenActionTimeUnits: data?.data?.time_units ?? [],
                isLoadingThenActionFields: false,
            });
        } catch (err) {
            set({
                thenActionRegularFields: [], thenActionCustomFields: [], thenActionTimeUnits: [],
                isLoadingThenActionFields: false,
            });
        }
    },

    isLoadingBusinessRules: false,
    businessRules: [],
    businessRulesCount: 0,

    getBusinessRules: async ({ params } = {}) => {
        try {
            set({ isLoadingBusinessRules: true });
            const { data } = await businessRuleService.getBusinessRules({ params });
            set({
                businessRules: data?.data ?? [],
                businessRulesCount: data?.total ?? 0,
                isLoadingBusinessRules: false,
            });
        } catch (err) {
            set({ businessRules: [], businessRulesCount: 0, isLoadingBusinessRules: false });
        }
    },

    isLoadingBusinessRuleDetails: false,
    businessRuleDetails: null,

    getBusinessRuleById: async (businessRuleId) => {
        try {
            set({ isLoadingBusinessRuleDetails: true, businessRuleDetails: null });
            const { data } = await businessRuleService.getBusinessRuleById(businessRuleId);
            set({
                businessRuleDetails: data?.data ?? null,
                isLoadingBusinessRuleDetails: false,
            });
        } catch (err) {
            set({ businessRuleDetails: null, isLoadingBusinessRuleDetails: false });
        }
    },

    resetBusinessRuleDetails: () => set({ businessRuleDetails: null, isLoadingBusinessRuleDetails: false }),

    isLoadingExecutionLogs: false,
    executionLogs: [],

    // Confirmed endpoint (business_rule/get_execution_logs/{business_rule_id}, params
    // search/from/to) but no documented response shape yet — falls back across a few
    // likely list keys (data.data / data.data.items / data.data.logs) rather than
    // assuming one, and normalizeExecutionLogRow (BusinessRuleFormModal.jsx) does the
    // same best-effort fallback per-row for field names.
    getExecutionLogs: async (businessRuleId, { params } = {}) => {
        try {
            set({ isLoadingExecutionLogs: true });
            const { data } = await businessRuleService.getExecutionLogs(businessRuleId, { params });
            const list = Array.isArray(data?.data) ? data.data
                : Array.isArray(data?.data?.items) ? data.data.items
                    : Array.isArray(data?.data?.logs) ? data.data.logs
                        : [];
            set({ executionLogs: list, isLoadingExecutionLogs: false });
        } catch (err) {
            set({ executionLogs: [], isLoadingExecutionLogs: false });
        }
    },

    resetExecutionLogs: () => set({ executionLogs: [], isLoadingExecutionLogs: false }),

    isLoadingBusinessRuleHistory: false,
    businessRuleHistory: [],

    // TODO: endpoint itself is an unconfirmed guess (see businessRuleService.js) and the
    // response shape is unconfirmed too — same best-effort list/row fallback pattern as
    // getExecutionLogs above.
    getBusinessRuleHistory: async (businessRuleId, { params } = {}) => {
        try {
            set({ isLoadingBusinessRuleHistory: true });
            const { data } = await businessRuleService.getBusinessRuleHistory(businessRuleId, { params });
            const list = Array.isArray(data?.data) ? data.data
                : Array.isArray(data?.data?.items) ? data.data.items
                    : Array.isArray(data?.data?.history) ? data.data.history
                        : [];
            set({ businessRuleHistory: list, isLoadingBusinessRuleHistory: false });
        } catch (err) {
            set({ businessRuleHistory: [], isLoadingBusinessRuleHistory: false });
        }
    },

    resetBusinessRuleHistory: () => set({ businessRuleHistory: [], isLoadingBusinessRuleHistory: false }),

    isTogglingBusinessRuleStatus: false,

    toggleBusinessRuleStatus: async (businessRuleId, { cb, onSettled } = {}) => {
        try {
            set({ isTogglingBusinessRuleStatus: true });
            const { data } = await businessRuleService.toggleBusinessRuleStatus(businessRuleId);
            set({ isTogglingBusinessRuleStatus: false });
            cb && cb(data);
        } catch (err) {
            set({ isTogglingBusinessRuleStatus: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isCreatingBusinessRule: false,

    createBusinessRule: async (payload, { cb, onSettled } = {}) => {
        try {
            set({ isCreatingBusinessRule: true });
            const { data } = await businessRuleService.createBusinessRule(payload);
            set({ isCreatingBusinessRule: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Business rule created.');
            cb && cb(data);
        } catch (err) {
            set({ isCreatingBusinessRule: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isLoadingTriggerConfig: false,
    triggerConfig: null,

    getTriggerConfig: async (triggerTypeId) => {
        try {
            set({ isLoadingTriggerConfig: true, triggerConfig: null });
            const { data } = await businessRuleService.getTriggerConfig(triggerTypeId);
            set({
                triggerConfig: data?.data ?? null,
                isLoadingTriggerConfig: false,
            });
        } catch (err) {
            set({ triggerConfig: null, isLoadingTriggerConfig: false });
        }
    },

    isLoadingFieldDetails: {},
    fieldDetailsByKey: {},

    getFieldDetails: async (fieldType, fieldId) => {
        const key = `${fieldType}-${fieldId}`;
        try {
            set((state) => ({ isLoadingFieldDetails: { ...state.isLoadingFieldDetails, [key]: true } }));
            const { data } = await businessRuleService.getFieldDetails(fieldType, fieldId);
            set((state) => ({
                fieldDetailsByKey: { ...state.fieldDetailsByKey, [key]: data?.data ?? null },
                isLoadingFieldDetails: { ...state.isLoadingFieldDetails, [key]: false },
            }));
        } catch (err) {
            set((state) => ({
                fieldDetailsByKey: { ...state.fieldDetailsByKey, [key]: null },
                isLoadingFieldDetails: { ...state.isLoadingFieldDetails, [key]: false },
            }));
        }
    },

    isLoadingBusinessRuleStats: false,
    businessRuleStats: { available: 0, created: 0, enabled: 0, visible: 0 },

    getBusinessRuleStats: async () => {
        try {
            set({ isLoadingBusinessRuleStats: true });
            const { data } = await businessRuleService.getBusinessRuleStats();
            set({
                businessRuleStats: {
                    available: data?.data?.available ?? 0,
                    created: data?.data?.created ?? 0,
                    enabled: data?.data?.enabled ?? 0,
                    visible: data?.data?.visible ?? 0,
                },
                isLoadingBusinessRuleStats: false,
            });
        } catch (err) {
            set({ businessRuleStats: { available: 0, created: 0, enabled: 0, visible: 0 }, isLoadingBusinessRuleStats: false });
        }
    },

    isLoadingLinkCardActions: false,
    linkCardActions: [],

    getLinkCardPossibleActions: async ({ params } = {}) => {
        try {
            set({ isLoadingLinkCardActions: true });
            const { data } = await businessRuleService.getLinkCardPossibleActions({ params });
            set({
                linkCardActions: data?.data ?? [],
                isLoadingLinkCardActions: false,
            });
        } catch (err) {
            set({ linkCardActions: [], isLoadingLinkCardActions: false });
        }
    },

    isLoadingNotificationSettings: false,
    notificationSettings: null,

    getNotificationSettings: async (notificationId) => {
        try {
            set({ isLoadingNotificationSettings: true, notificationSettings: null });
            const { data } = await businessRuleService.getNotificationSettings(notificationId);
            set({
                notificationSettings: data?.data ?? null,
                isLoadingNotificationSettings: false,
            });
        } catch (err) {
            set({ notificationSettings: null, isLoadingNotificationSettings: false });
        }
    },

    resetNotificationSettings: () => set({ notificationSettings: null, isLoadingNotificationSettings: false }),

    isLoadingLinkCardActionOperators: false,
    linkCardActionOperators: [],

    getLinkCardPossibleActionOperators: async ({ params } = {}) => {
        try {
            set({ isLoadingLinkCardActionOperators: true });
            const { data } = await businessRuleService.getLinkCardPossibleActionOperators({ params });
            set({
                linkCardActionOperators: data?.data ?? [],
                isLoadingLinkCardActionOperators: false,
            });
        } catch (err) {
            set({ linkCardActionOperators: [], isLoadingLinkCardActionOperators: false });
        }
    },

    isSavingNotificationSettings: false,

    saveNotificationSettings: async (payload, { cb, onSettled } = {}) => {
        try {
            set({ isSavingNotificationSettings: true });
            const { data } = await businessRuleService.saveNotificationSettings(payload);
            set({ isSavingNotificationSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Notification settings saved.');
            cb && cb(data);
        } catch (err) {
            set({ isSavingNotificationSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    updateNotificationSettings: async (notificationId, payload, { cb, onSettled } = {}) => {
        try {
            set({ isSavingNotificationSettings: true });
            const { data } = await businessRuleService.updateNotificationSettings(notificationId, payload);
            set({ isSavingNotificationSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Notification settings updated.');
            cb && cb(data);
        } catch (err) {
            set({ isSavingNotificationSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isDeletingNotificationSettings: false,

    deleteNotificationSettings: async (notificationId, { cb, onSettled } = {}) => {
        try {
            set({ isDeletingNotificationSettings: true });
            const { data } = await businessRuleService.deleteNotificationSettings(notificationId);
            set({ isDeletingNotificationSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Notification settings removed.');
            cb && cb(data);
        } catch (err) {
            set({ isDeletingNotificationSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isUpdatingWebServiceSettings: false,

    updateWebServiceSettings: async (webServiceId, payload, { cb, onSettled } = {}) => {
        try {
            set({ isUpdatingWebServiceSettings: true });
            const { data } = await businessRuleService.updateWebServiceSettings(webServiceId, payload);
            set({ isUpdatingWebServiceSettings: false });
            const { success } = useAlertReducer.getState();
            const baseMessage = data?.message || 'Web service settings updated.';
            success(data?.web_service_id ? `${baseMessage} (ID: ${data.web_service_id})` : baseMessage);
            cb && cb(data);
        } catch (err) {
            set({ isUpdatingWebServiceSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isDeletingWebServiceSettings: false,

    deleteWebServiceSettings: async (webServiceId, { cb, onSettled } = {}) => {
        try {
            set({ isDeletingWebServiceSettings: true });
            const { data } = await businessRuleService.deleteWebServiceSettings(webServiceId);
            set({ isDeletingWebServiceSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Web service settings removed.');
            cb && cb(data);
        } catch (err) {
            set({ isDeletingWebServiceSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isLoadingWebServiceSettings: false,
    webServiceSettings: null,

    getWebServiceSettings: async (webServiceId) => {
        try {
            set({ isLoadingWebServiceSettings: true, webServiceSettings: null });
            const { data } = await businessRuleService.getWebServiceSettings(webServiceId);
            set({
                webServiceSettings: data?.data ?? null,
                isLoadingWebServiceSettings: false,
            });
        } catch (err) {
            set({ webServiceSettings: null, isLoadingWebServiceSettings: false });
        }
    },

    resetWebServiceSettings: () => set({ webServiceSettings: null, isLoadingWebServiceSettings: false }),

    isSavingWebServiceSettings: false,

    saveWebServiceSettings: async (payload, { cb, onSettled } = {}) => {
        try {
            set({ isSavingWebServiceSettings: true });
            const { data } = await businessRuleService.saveWebServiceSettings(payload);
            set({ isSavingWebServiceSettings: false });
            const { success } = useAlertReducer.getState();
            const baseMessage = data?.message || 'Web service settings saved.';
            success(data?.web_service_id ? `${baseMessage} (ID: ${data.web_service_id})` : baseMessage);
            cb && cb(data);
        } catch (err) {
            set({ isSavingWebServiceSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isTestingWebServiceSettings: false,

    // Unlike the other actions here, both the rich result (status code / duration /
    // response body) and a hard failure to reach our own backend are rendered inline
    // in the modal, so this reports outcome via cb/onError only — no useAlertReducer
    // toast, to avoid duplicating what the modal already shows.
    //
    // The backend mirrors the invoked service's outcome onto the outer HTTP status
    // (e.g. a target that returns 422 makes this call itself reject with 422), so a
    // rejected promise still carries a full { status, message, data } result body —
    // that's a completed test, not a failure to reach our own endpoint, and goes to
    // cb like the success path. Only a response with no such body is a real failure.
    testWebServiceSettings: async (payload, { cb, onError, onSettled } = {}) => {
        try {
            set({ isTestingWebServiceSettings: true });
            const { data } = await businessRuleService.testWebServiceSettings(payload);
            set({ isTestingWebServiceSettings: false });
            cb && cb(data);
        } catch (err) {
            set({ isTestingWebServiceSettings: false });
            const errData = err?.response?.data;
            if (errData?.data) {
                cb && cb(errData);
            } else {
                onError && onError(err);
            }
        } finally {
            onSettled && onSettled();
        }
    },

    isSavingCreateSubtaskSettings: false,

    saveCreateSubtaskSettings: async (payload, { cb, onSettled } = {}) => {
        try {
            set({ isSavingCreateSubtaskSettings: true });
            const { data } = await businessRuleService.saveCreateSubtaskSettings(payload);
            set({ isSavingCreateSubtaskSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Create subtask settings saved.');
            cb && cb(data);
        } catch (err) {
            set({ isSavingCreateSubtaskSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    updateCreateSubtaskSettings: async (createSubtaskId, payload, { cb, onSettled } = {}) => {
        try {
            set({ isSavingCreateSubtaskSettings: true });
            const { data } = await businessRuleService.updateCreateSubtaskSettings(createSubtaskId, payload);
            set({ isSavingCreateSubtaskSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Create subtask settings updated.');
            cb && cb(data);
        } catch (err) {
            set({ isSavingCreateSubtaskSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isDeletingCreateSubtaskSettings: false,

    deleteCreateSubtaskSettings: async (createSubtaskId, { cb, onSettled } = {}) => {
        try {
            set({ isDeletingCreateSubtaskSettings: true });
            const { data } = await businessRuleService.deleteCreateSubtaskSettings(createSubtaskId);
            set({ isDeletingCreateSubtaskSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Create subtask settings removed.');
            cb && cb(data);
        } catch (err) {
            set({ isDeletingCreateSubtaskSettings: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isLoadingCreateSubtaskSettings: false,
    createSubtaskSettings: null,

    getCreateSubtaskSettings: async (createSubtaskId) => {
        try {
            set({ isLoadingCreateSubtaskSettings: true, createSubtaskSettings: null });
            const { data } = await businessRuleService.getCreateSubtaskSettings(createSubtaskId);
            set({
                createSubtaskSettings: data?.data ?? null,
                isLoadingCreateSubtaskSettings: false,
            });
        } catch (err) {
            set({ createSubtaskSettings: null, isLoadingCreateSubtaskSettings: false });
        }
    },

    resetCreateSubtaskSettings: () => set({ createSubtaskSettings: null, isLoadingCreateSubtaskSettings: false }),
}));

export default useBusinessRuleReducer;