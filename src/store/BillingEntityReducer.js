import { create } from 'zustand';
import billingEntityService from '../services/billingEntityService';
import useAlertReducer from './AlertReducer';

const useBillingEntityReducer = create((set) => ({
  isLoading: false,
  errorMessage: '',
  successMessage: '',
  billingEntities: null,
  totalCount: null,
  addEditLoader: false,
  isLogoUploading: false,
  logoUploadEntityId: null,
  selectedBillingEntity: null,
  isLoadingEntityDetail: false,

  getBillingEntities: async ({ params }) => {
    try {
      set({ isLoading: true });
      const { data } = await billingEntityService.getBillingEntities({ params });
      const raw = data?.data ?? data ?? [];
      const list = (Array.isArray(raw) ? raw : []).map((row) => ({
        ...row,
        _id: row._id ?? row.id,
        name: row.name,
        customerId: row.customer_id ?? row.customerId,
        vatNo: row.vat_no ?? row.vatNo,
        phoneNumber: row.phone_number ?? row.phoneNumber,
        email: row.email,
        contactPerson: row.contact_person ?? row.contactPerson,
        credit_limit: row.credit_limit ?? row.creditLimit ?? null,
        createdAt: row.created_at ?? row.createdAt,
        updatedAt: row.updated_at ?? row.updatedAt,
      }));
      const total =
        data?.pagination?.total ??
        data?.totalCount ??
        data?.total ??
        list?.length ??
        0;
      set({
        billingEntities: list,
        totalCount: total,
        isLoading: false,
      });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ errorMessage: error?.message, isLoading: false });
      showError(
        error?.response?.data?.message ?? error?.message ?? 'Failed to fetch billing entities'
      );
    }
  },
  getEntityDetailById: async ({ entityId, cb }) => {
    try {
      set({ isLoadingEntityDetail: true });
      const { data } = await billingEntityService.getEntityDetailById(entityId);
      const entity = data?.data ?? null;
      set({ selectedBillingEntity: entity, isLoadingEntityDetail: false });
      cb && cb(entity);
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ isLoadingEntityDetail: false });
      showError(error?.response?.data?.message ?? error?.message ?? 'Failed to fetch billing entity details');
    }
  },

  updateBillingEntityDetail: async ({ entityId, billingEntityName, creditLimit, logoFile, cb }) => {
    try {
      set({ addEditLoader: true });
      const formData = new FormData();
      formData.append('entity_id', entityId);
      formData.append('billing_entity', billingEntityName);
      formData.append('credit_limit', creditLimit || '');
      if (logoFile) formData.append('entity_logo', logoFile);
      const { data } = await billingEntityService.updateBillingEntityDetail(formData);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Billing entity updated successfully');
      cb && cb(data);
      set({ addEditLoader: false });
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({ addEditLoader: false });
      showError(
        error?.response?.data?.message ?? error?.message ?? 'Failed to update billing entity'
      );
    }
  },

  updateBillingEntityLogo: async ({ entityId, file, cb }) => {
    try {
      set({ isLogoUploading: true, logoUploadEntityId: entityId });
      const formData = new FormData();
      formData.append('entity_id', entityId);
      formData.append('entity_logo', file);
      const { data } = await billingEntityService.updateBillingEntityLogo(formData);
      const { success } = useAlertReducer.getState();
      success(data?.message ?? 'Billing entity logo updated successfully');
      cb && cb(data);
      set({
        successMessage: data?.message ?? '',
        isLogoUploading: false,
        logoUploadEntityId: null,
      });
      return true;
    } catch (error) {
      const { error: showError } = useAlertReducer.getState();
      set({
        errorMessage: error?.message ?? 'Failed to update billing entity logo',
        isLogoUploading: false,
        logoUploadEntityId: null,
      });
      showError(
        error?.response?.data?.message ?? error?.message ?? 'Failed to update billing entity logo'
      );
      return false;
    }
  },
}));

export default useBillingEntityReducer;
