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

    isLoadingTimeUnits: false,
    timeUnits: [],

    getTimeUnits: async (params) => {
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

    isLoadingRegularFields: false,
    regularFields: [],

    getRegularFields: async (params) => {
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
}));

export default useBusinessRuleReducer;
