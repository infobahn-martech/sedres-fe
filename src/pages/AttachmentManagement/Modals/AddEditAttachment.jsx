import { useForm, Controller } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import CustomModal from '../../../components/CustomModal';
import PremiumSelect from '../../../components/form/PremiumSelect';
import useCommonAttachmentReducer from '../../../store/CommonAttachmentReducer';
import usePortReducer from '../../../store/PortReducer';
import useCallTypeReducer from '../../../store/CallTypeReducer';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';

const ATTACHMENT_CATEGORY_OPTIONS = ['Pre Arrival', 'Arrival', 'Departure'].map((value) => ({
  value,
  label: value,
}));

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// The list API returns port / call type names; resolve them back to ids when no id is sent.
const resolveOptionValue = (options, id, label) => {
  if (id !== undefined && id !== null && String(id).trim() !== '') return String(id);
  const match = options.find((opt) => normalize(opt.label) === normalize(label));
  return match ? match.value : '';
};

export function AddEditAttachmentModal({ showModal, closeModal, onSuccess }) {
  const row = showModal && typeof showModal === 'object' ? showModal : null;
  const attachmentId = row?.attachment_id;
  const isEdit = attachmentId !== undefined && attachmentId !== null;

  const { createAttachment, updateAttachment, isBeingUpdated } = useCommonAttachmentReducer((s) => s);
  const { ports, getPorts } = usePortReducer((s) => s);
  const { callTypes, getCallTypes } = useCallTypeReducer((s) => s);

  const portOptions = useMemo(
    () =>
      (ports ?? []).map((p) => {
        const id = p?.port_id ?? p?._id ?? p?.id;
        return { value: String(id ?? ''), label: String(p?.port ?? p?.name ?? p?.port_name ?? id ?? '') };
      }),
    [ports]
  );

  const callTypeOptions = useMemo(
    () =>
      (Array.isArray(callTypes) ? callTypes : []).map((ct) => ({
        value: String(ct?.call_type_id ?? ''),
        label: String(ct?.call_type_name ?? ct?.call_type ?? ct?.call_type_id ?? ''),
      })),
    [callTypes]
  );

  const defaultValues = useMemo(
    () => ({
      port_id: row ? resolveOptionValue(portOptions, row.port_id, row.port ?? row.port_name) : '',
      call_type_id: row
        ? resolveOptionValue(callTypeOptions, row.call_type_id, row.call_type ?? row.call_type_name)
        : '',
      category: row?.category ?? '',
      attachment_type: row?.attachment_type ?? '',
      attachment: null,
    }),
    [row, portOptions, callTypeOptions]
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
    getCallTypes({ limit: 1000 });
  }, []);

  // Re-apply once ports / call types load so edit mode can resolve names to ids.
  useEffect(() => {
    if (isEdit) reset(defaultValues);
  }, [isEdit, defaultValues, reset]);

  const onSubmit = (data) => {
    const formData = new FormData();
    if (isEdit) formData.append('attachment_id', attachmentId);
    formData.append('port_id', data.port_id);
    formData.append('call_type_id', data.call_type_id);
    formData.append('category', data.category);
    formData.append('attachment_type', data.attachment_type?.trim() ?? '');
    const file = data.attachment?.[0];
    if (file) formData.append('attachment', file);

    const cb = () => {
      onSuccess?.();
      closeModal();
    };
    if (isEdit) updateAttachment({ formData, cb });
    else createAttachment({ formData, cb });
  };

  const renderSelect = (name, label, options, placeholder) => (
    <div className="col-lg-6 col-sm-12">
      <div className="form-field">
        <div className="desig-inp">
          <label className="mb-2 d-block">
            {label} <span className="text-danger">*</span>
          </label>
          <Controller
            name={name}
            control={control}
            rules={{ required: `${label} is required` }}
            render={({ field }) => (
              <PremiumSelect
                value={field.value != null ? String(field.value) : ''}
                onChange={(e) => field.onChange(e.target.value)}
                options={options}
                placeholder={placeholder}
                searchPlaceholder="Search..."
                hasError={Boolean(errors[name])}
              />
            )}
          />
        </div>
        {errors[name] && <span className="field-error">{errors[name].message}</span>}
      </div>
    </div>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="commonAttachmentForm" onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              {renderSelect('port_id', 'Port', portOptions, 'Select Port')}
              {renderSelect('call_type_id', 'Call Type', callTypeOptions, 'Select Call Type')}
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              {renderSelect('category', 'Category', ATTACHMENT_CATEGORY_OPTIONS, 'Select Category')}
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="desig-inp">
                    <label className="mb-2 d-block">
                      Attachment Type <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Pre Arrival Information"
                      {...register('attachment_type', {
                        required: 'Attachment type is required',
                        validate: (v) => !!v?.trim() || 'Attachment type is required',
                      })}
                    />
                  </div>
                  {errors.attachment_type && (
                    <span className="field-error">{errors.attachment_type.message}</span>
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
                    <label className="mb-2 d-block">
                      Attachment {!isEdit && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      {...register('attachment', {
                        validate: (files) => isEdit || files?.length > 0 || 'Attachment is required',
                      })}
                    />
                    {isEdit && row?.file_url && (
                      <div className="mt-2">
                        Current file:{' '}
                        <a href={row.file_url} target="_blank" rel="noopener noreferrer">
                          {row.file_name || 'View file'}
                        </a>
                        <span className="text-muted"> (choose a new file to replace it)</span>
                      </div>
                    )}
                  </div>
                  {errors.attachment && <span className="field-error">{errors.attachment.message}</span>}
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
      <button type="submit" form="commonAttachmentForm" className="btn btn-primary" disabled={isBeingUpdated}>
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
      header={<h1 className="modal-title">{isEdit ? 'Edit Attachment' : 'Add Attachment'}</h1>}
    />
  );
}
