import { useForm, Controller } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import CustomModal from '../../../components/CustomModal';
import PremiumSelect from '../../../components/form/PremiumSelect';
// Same RTL Quill editor (tables, image upload/resize/wrap) as the Vessel Registration template modal.
import { QuillEditor, isHtmlEmpty } from '../../VesselRegistrationTemplate/Modals/AddEditVesselRegistrationTemplate';
import useCrewImmigrationTemplateReducer from '../../../store/CrewImmigrationTemplateReducer';
import usePortReducer from '../../../store/PortReducer';
import { CREW_IMMIGRATION_TEMPLATE_TYPE } from '../../../services/crewImmigrationTemplateService';
import { resolveTemplateId } from '../templateId';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';
import '../../../design/scss/pages/vessel-registration-template/modals/AddEditVesselRegistrationTemplate.scss';

export function AddEditCrewImmigrationTemplateModal({ showModal, closeModal, onSuccess }) {
  const templateId = resolveTemplateId(showModal);
  const isEdit = !!templateId;

  const { createTemplate, updateTemplate, isBeingUpdated } = useCrewImmigrationTemplateReducer((s) => s);
  const { ports, getPorts } = usePortReducer((s) => s);

  const defaultValues = useMemo(
    () =>
      isEdit && showModal
        ? {
            port_id: String(showModal?.port_id ?? ''),
            template_name: showModal?.template_name ?? '',
            description: showModal?.description ?? '',
            content: showModal?.more_description ?? '',
          }
        : { port_id: '', template_name: '', description: '', content: '' },
    [isEdit, showModal]
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues });

  useEffect(() => {
    getPorts({ params: { limit: 1000 } });
  }, []);

  useEffect(() => {
    reset(defaultValues);
  }, [showModal, reset]);

  const onSubmit = (data) => {
    const payload = {
      port_id: data.port_id ? Number(data.port_id) : null,
      template_name: data.template_name?.trim() ?? '',
      template_type: CREW_IMMIGRATION_TEMPLATE_TYPE,
      description: data.description ?? '',
      more_description: data.content ?? '',
    };

    const cb = () => {
      onSuccess?.();
      closeModal();
    };

    if (isEdit) {
      updateTemplate({ formData: { ...payload, template_id: Number(templateId) }, cb });
    } else {
      createTemplate({ formData: payload, cb });
    }
  };

  const renderHeader = () => (
    <h1 className="modal-title">
      {isEdit ? 'Edit Crew Immigration Template' : 'Add Crew Immigration Template'}
    </h1>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="crewImmigrationTemplateForm" onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="desig-inp">
                    <label className="mb-2 d-block">
                      Port <span className="text-danger">*</span>
                    </label>
                    <Controller
                      name="port_id"
                      control={control}
                      rules={{ required: 'Port is required' }}
                      render={({ field }) => (
                        <PremiumSelect
                          value={field.value != null ? String(field.value) : ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={(ports ?? []).map((p) => {
                            const id = p?.port_id ?? p?._id ?? p?.id;
                            return {
                              value: String(id ?? ''),
                              label: String(p?.port ?? p?.name ?? p?.port_name ?? id ?? ''),
                            };
                          })}
                          placeholder="Select Port"
                          searchPlaceholder="Search port..."
                          hasError={Boolean(errors.port_id)}
                        />
                      )}
                    />
                  </div>
                  {errors.port_id && <span className="field-error">{errors.port_id.message}</span>}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="desig-inp">
                    <label className="mb-2 d-block">
                      Template Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter template name"
                      dir="auto"
                      {...register('template_name', { required: 'Template name is required' })}
                    />
                  </div>
                  {errors.template_name && (
                    <span className="field-error">{errors.template_name.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-12">
                <div className="form-field">
                  <div className="desig-inp">
                    <label className="mb-2 d-block">Description</label>
                    <textarea
                      className="form-control"
                      placeholder=""
                      rows={3}
                      dir="rtl"
                      {...register('description')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-12">
                <div className="form-field">
                  <div className="desig-inp">
                    <label className="mb-2 d-block">
                      Content <span className="text-danger">*</span>
                    </label>
                    <Controller
                      name="content"
                      control={control}
                      rules={{
                        required: 'Content is required',
                        validate: (v) => !isHtmlEmpty(v) || 'Content is required',
                      }}
                      render={({ field }) => (
                        <QuillEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter content..."
                        />
                      )}
                    />
                  </div>
                  {errors.content && <span className="field-error">{errors.content.message}</span>}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button type="button" className="btn btn-outline" onClick={closeModal} disabled={isBeingUpdated}>
        Close
      </button>
      <button
        type="submit"
        form="crewImmigrationTemplateForm"
        className="btn btn-primary"
        disabled={isBeingUpdated}
      >
        {isBeingUpdated ? 'Saving...' : 'Save'}
      </button>
    </div>
  );

  return (
    <CustomModal
      className="appointment-acceptance-modal-lg"
      dialgName="modal-dialog modal-dialog-centered"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={renderHeader()}
    />
  );
}
