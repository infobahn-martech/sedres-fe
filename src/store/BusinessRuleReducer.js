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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
            set({ executionLogs: [], isLoadingExecutionLogs: false });
        }
    },

    resetExecutionLogs: () => set({ executionLogs: [], isLoadingExecutionLogs: false }),

    isLoadingExportExecutionLogs: false,

    // Confirmed endpoint: business_rule/export_execution_logs/{business_rule_id},
    // params from/to (both optional). Responds 200 even on a backend-side failure
    // (JSON error body instead of a file), so the content-type is read from the
    // actual response headers rather than assumed, and a JSON body is treated as
    // an error instead of downloaded as a broken file.
    exportExecutionLogsFile: async (businessRuleId, { params, cb } = {}) => {
        try {
            set({ isLoadingExportExecutionLogs: true });
            const response = await businessRuleService.exportExecutionLogs(businessRuleId, { params });
            set({ isLoadingExportExecutionLogs: false });
            const contentType = response.headers?.['content-type'] ?? '';
            if (contentType.includes('json')) {
                const text = await response.data.text();
                const { error } = useAlertReducer.getState();
                try { error(JSON.parse(text)?.message ?? 'Failed to export execution log report'); }
                catch { error('Failed to export execution log report'); }
                cb?.(null);
                return;
            }
            const blob = new Blob([response.data], { type: contentType || 'application/pdf' });
            const url = URL.createObjectURL(blob);
            cb?.(url, contentType);
        } catch (err) {
            const { error } = useAlertReducer.getState();
            set({ isLoadingExportExecutionLogs: false });
            if (err?.response?.data instanceof Blob) {
                const text = await err.response.data.text();
                try { error(JSON.parse(text)?.message ?? 'Failed to export execution log report'); }
                catch { error('Failed to export execution log report'); }
            } else {
                error(err?.response?.data?.message ?? err.message);
            }
            cb?.(null);
        }
    },

    isLoadingBusinessRuleHistory: false,
    businessRuleHistory: [],

    // Confirmed endpoint (business_rule/get_history/{business_rule_id}, param: search).
    // Response is a flat array under data.data; fallback keys kept as a safety net.
    getBusinessRuleHistory: async (businessRuleId, { params } = {}) => {
        try {
            set({ isLoadingBusinessRuleHistory: true });
            const { data } = await businessRuleService.getBusinessRuleHistory(businessRuleId, { params });
            const list = Array.isArray(data?.data) ? data.data
                : Array.isArray(data?.data?.items) ? data.data.items
                    : Array.isArray(data?.data?.history) ? data.data.history
                        : [];
            set({ businessRuleHistory: list, isLoadingBusinessRuleHistory: false });
        } catch {
            set({ businessRuleHistory: [], isLoadingBusinessRuleHistory: false });
        }
    },

    resetBusinessRuleHistory: () => set({ businessRuleHistory: [], isLoadingBusinessRuleHistory: false }),

    // Keyed by business_rule_id rather than a single flag, so toggling one row's
    // switch doesn't disable every other row's switch while its request is in flight.
    isTogglingBusinessRuleStatus: {},

    toggleBusinessRuleStatus: async (businessRuleId, { cb, onSettled } = {}) => {
        try {
            set((state) => ({ isTogglingBusinessRuleStatus: { ...state.isTogglingBusinessRuleStatus, [businessRuleId]: true } }));
            const { data } = await businessRuleService.toggleBusinessRuleStatus(businessRuleId);
            set((state) => ({
                // get_business_rule_list has no is_enabled field - the table reads the enabled flag off
                // `status` ("1"/"0"), which doubles as the reference-validity text ("Missing reference")
                // for broken rules. Patch both: is_enabled for any consumer that does have that field
                // (e.g. a future list shape, or get_business_rule_by_id), and status for the list table -
                // but leave status alone if it was showing a "Missing reference" string, since the toggle
                // response doesn't tell us whether that reference issue is still present.
                businessRules: state.businessRules.map((rule) => {
                    if ((rule?.business_rule_id ?? rule?.id) !== businessRuleId) return rule;
                    const wasMissingReference = typeof rule?.status === 'string' && /missing/i.test(rule.status);
                    return {
                        ...rule,
                        is_enabled: data?.is_enabled,
                        status: wasMissingReference ? rule.status : String(data?.is_enabled),
                    };
                }),
                isTogglingBusinessRuleStatus: { ...state.isTogglingBusinessRuleStatus, [businessRuleId]: false },
            }));
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Business rule status updated.');
            cb && cb(data);
        } catch (err) {
            set((state) => ({ isTogglingBusinessRuleStatus: { ...state.isTogglingBusinessRuleStatus, [businessRuleId]: false } }));
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

    isUpdatingBusinessRule: false,

    updateBusinessRule: async (businessRuleId, payload, { cb, onSettled } = {}) => {
        try {
            set({ isUpdatingBusinessRule: true });
            const { data } = await businessRuleService.updateBusinessRule(businessRuleId, payload);
            set({ isUpdatingBusinessRule: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Business rule updated.');
            cb && cb(data);
        } catch (err) {
            set({ isUpdatingBusinessRule: false });
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    // Keyed by business_rule_id, same reasoning as isTogglingBusinessRuleStatus - copying
    // one row shouldn't disable the Copy action on every other row while it's in flight.
    isDuplicatingBusinessRule: {},

    duplicateBusinessRule: async (businessRuleId, { cb, onSettled } = {}) => {
        try {
            set((state) => ({ isDuplicatingBusinessRule: { ...state.isDuplicatingBusinessRule, [businessRuleId]: true } }));
            const { data } = await businessRuleService.duplicateBusinessRule(businessRuleId);
            set((state) => ({ isDuplicatingBusinessRule: { ...state.isDuplicatingBusinessRule, [businessRuleId]: false } }));
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Business rule duplicated successfully.');
            cb && cb(data);
        } catch (err) {
            set((state) => ({ isDuplicatingBusinessRule: { ...state.isDuplicatingBusinessRule, [businessRuleId]: false } }));
            const { error } = useAlertReducer.getState();
            error(err?.response?.data?.message ?? err.message);
        } finally {
            onSettled && onSettled();
        }
    },

    isDeletingBusinessRule: false,

    deleteBusinessRule: async (businessRuleId, { cb, onSettled } = {}) => {
        try {
            set({ isDeletingBusinessRule: true });
            const { data } = await businessRuleService.deleteBusinessRule(businessRuleId);
            set({ isDeletingBusinessRule: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Business rule deleted successfully.');
            cb && cb(data);
        } catch (err) {
            set({ isDeletingBusinessRule: false });
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
            set({ notificationSettings: null, isLoadingNotificationSettings: false });
        }
    },

    resetNotificationSettings: () => set({ notificationSettings: null, isLoadingNotificationSettings: false }),

    // Read-only variant for the THEN-column list preview (subject pills shown on the
    // collapsed notify action card). Deliberately does not touch notificationSettings —
    // that single shared slot is bound to whichever notify action the settings modal
    // currently has open, and previewing every saved notify action on an edit-mode
    // reopen would otherwise race/clobber it.
    getNotificationSettingsPreview: async (notificationId) => {
        try {
            const { data } = await businessRuleService.getNotificationSettings(notificationId);
            return data?.data ?? null;
        } catch {
            return null;
        }
    },

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
        } catch {
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
        } catch {
            set({ webServiceSettings: null, isLoadingWebServiceSettings: false });
        }
    },

    resetWebServiceSettings: () => set({ webServiceSettings: null, isLoadingWebServiceSettings: false }),

    // Read-only variant for the THEN-column list preview (service name shown on the
    // collapsed invoke action card). Deliberately does not touch webServiceSettings — that
    // single shared slot is bound to whichever invoke action the settings modal currently
    // has open, and previewing every saved invoke action on an edit-mode reopen would
    // otherwise race/clobber it. Mirrors getNotificationSettingsPreview.
    getWebServiceSettingsPreview: async (webServiceId) => {
        try {
            const { data } = await businessRuleService.getWebServiceSettings(webServiceId);
            return data?.data ?? null;
        } catch {
            return null;
        }
    },

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

    // onError is optional: the backend sometimes reports its saved-earlier
    // "temporary" create-subtask record (from a prior saveCreateSubtaskSettings
    // call) as no longer found once the parent business rule has since been
    // saved/promoted. When a caller passes onError, that failure is handed back
    // instead of toasted here, so CreateSubtaskSettingsModal can recover by
    // re-creating the record via saveCreateSubtaskSettings rather than dead-ending
    // the user's edit.
    updateCreateSubtaskSettings: async (createSubtaskId, payload, { cb, onError, onSettled } = {}) => {
        try {
            set({ isSavingCreateSubtaskSettings: true });
            const { data } = await businessRuleService.updateCreateSubtaskSettings(createSubtaskId, payload);
            set({ isSavingCreateSubtaskSettings: false });
            const { success } = useAlertReducer.getState();
            success(data?.message || 'Create subtask settings updated.');
            cb && cb(data);
        } catch (err) {
            set({ isSavingCreateSubtaskSettings: false });
            if (onError) {
                onError(err);
            } else {
                const { error } = useAlertReducer.getState();
                error(err?.response?.data?.message ?? err.message);
            }
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
        } catch {
            set({ createSubtaskSettings: null, isLoadingCreateSubtaskSettings: false });
        }
    },

    resetCreateSubtaskSettings: () => set({ createSubtaskSettings: null, isLoadingCreateSubtaskSettings: false }),

    // Read-only variant for the THEN-column list preview (owner/deadline/description shown
    // on the collapsed "Create subtask" action card). Deliberately does not touch
    // createSubtaskSettings — that single shared slot is bound to whichever subtask action
    // the settings modal currently has open, and previewing every saved subtask action on an
    // edit-mode reopen would otherwise race/clobber it. Mirrors getNotificationSettingsPreview.
    getCreateSubtaskSettingsPreview: async (createSubtaskId) => {
        try {
            const { data } = await businessRuleService.getCreateSubtaskSettings(createSubtaskId);
            return data?.data ?? null;
        } catch {
            return null;
        }
    },
}));

export default useBusinessRuleReducer;