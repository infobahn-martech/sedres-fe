import { create } from 'zustand';
import businessRuleService from '../services/businessRuleService';

const useBusinessRuleReducer = create((set) => ({
    isLoadingGet: false,
    triggerTypes: [],

    getTriggerTypes: async (params) => {
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

    getFields: async (params) => {
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

    isLoadingCustomFields: false,
    customFields: [],

    getCustomFields: async (params) => {
        try {
            set({ isLoadingCustomFields: true });
            const { data } = await businessRuleService.getCustomFields({ params });
            set({
                customFields: data?.data ?? [],
                isLoadingCustomFields: false,
            });
        } catch (err) {
            set({ customFields: [], isLoadingCustomFields: false });
        }
    },
}));

export default useBusinessRuleReducer;
