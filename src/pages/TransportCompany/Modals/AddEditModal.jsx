import { useForm, useFieldArray, Controller } from 'react-hook-form';
import PremiumSelect from '../../../components/form/PremiumSelect';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';
import { useEffect, useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import CustomModal from '../../../components/CustomModal';
import useTransportCompanyReducer from '../../../store/TransportCompanyReducer';
import useVehicleReducer from '../../../store/VehicleReducer';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';

const emptyDriver = () => ({
  transport_driver_id: '',
  driver_name: '',
  contact_no: '',
  vehicle_type_id: '',
});

const mapDriversFromApi = (list) => {
  const rows = Array.isArray(list) ? list : [];
  if (rows.length === 0) return [emptyDriver()];
  return rows.map((d) => ({
    transport_driver_id: d.transport_driver_id != null ? String(d.transport_driver_id) : '',
    driver_name: d.driver_name ?? '',
    contact_no: d.contact_no ?? '',
    vehicle_type_id: d.vehicle_type_id != null ? String(d.vehicle_type_id) : '',
  }));
};

export function TransportCompanyModal({ showModal, closeModal, onSuccess }) {
  const transportCompanyId = showModal?.transport_company_id ?? showModal?._id;
  const isEdit = !!transportCompanyId;

  const { addTransportCompany, updateTransportCompany, getTransportCompanyById, isBeingUpdated } =
    useTransportCompanyReducer((state) => state);

  const { vehicles = [], getVehicles } = useVehicleReducer((state) => state);

  const [loadError, setLoadError] = useState('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      transport_company: '',
      contact_no: '',
      email: '',
      drivers: [emptyDriver()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'drivers',
  });

  useEffect(() => {
    if (showModal) {
      getVehicles?.({ params: {} });
    }
  }, [showModal, getVehicles]);

  useEffect(() => {
    if (showModal && !transportCompanyId) {
      setLoadError('');
      reset({
        transport_company: '',
        contact_no: '',
        email: '',
        drivers: [emptyDriver()],
      });
    }
  }, [showModal, transportCompanyId, reset]);

  useEffect(() => {
    if (!showModal || !transportCompanyId) {
      setLoadError('');
      return;
    }

    let cancelled = false;
    setLoadError('');
    setIsLoadingDetail(true);

    (async () => {
      try {
        const row = await getTransportCompanyById(transportCompanyId);
        if (cancelled || !row) return;
        reset({
          transport_company: String(row.transport_company ?? ''),
          contact_no: String(row.contact_no ?? ''),
          email: String(row.email ?? ''),
          drivers: mapDriversFromApi(row.drivers),
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.response?.data?.message ?? e?.message ?? 'Failed to load company');
        }
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showModal, transportCompanyId, getTransportCompanyById, reset]);

  const onSubmit = async (data) => {
    const driversPayload = (data.drivers ?? []).map((d) => {
      const entry = {
        driver_name: d.driver_name?.trim() ?? '',
        contact_no: d.contact_no?.trim() ?? '',
        vehicle_type_id: Number(d.vehicle_type_id),
      };
      const existingId = d.transport_driver_id?.toString().trim();
      if (isEdit && existingId) {
        return { transport_driver_id: Number(existingId), ...entry };
      }
      return entry;
    });

    const payload = {
      transport_company: data.transport_company?.trim() ?? '',
      contact_no: data.contact_no?.trim() ?? '',
      email: data.email?.trim() ?? '',
      drivers: driversPayload,
    };

    const cb = () => {
      closeModal();
      onSuccess?.();
    };

    if (isEdit) {
      await updateTransportCompany({
        formData: { transport_company_id: transportCompanyId, ...payload },
        cb,
      });
    } else {
      await addTransportCompany({ formData: payload, cb });
    }
  };

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{isEdit ? 'Edit Transport Company' : 'Add Transport Company'}</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body transport-company-modal-body">
      <div className="lead-form">
        {isEdit && isLoadingDetail && (
          <div className="text-center py-4 text-muted">Loading...</div>
        )}
        <form
          id="transportCompanyForm"
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: isEdit && isLoadingDetail ? 'none' : undefined }}
        >
          {loadError && <div className="alert alert-danger mb-3">{loadError}</div>}

          <div className="mb-lg-3 mb-sm-0">
            <div className="transport-field">
              <div className="form-floating desig-inp">
                <input
                  type="text"
                  className={`form-control ${errors.transport_company ? 'is-invalid' : ''}`}
                  placeholder=" "
                  disabled={isEdit && isLoadingDetail}
                  {...register('transport_company', { required: 'Company name is required' })}
                />
                <label>
                  Transport company <span className="text-danger">*</span>
                </label>
              </div>
              <div className="transport-field__error">
                {errors.transport_company?.message}
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="transport-field">
              <div className="phone-wrapper">
                <label className="phone-label">
                  Contact no <span className="text-danger">*</span>
                </label>
                <Controller
                  name="contact_no"
                  control={control}
                  rules={{
                    required: 'Contact number is required',
                    validate: (value) => {
                      const digits = (value || '').replace(/\D/g, '');
                      return (
                        digits.length >= 7 ||
                        'Enter a valid phone number'
                      );
                    },
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      country="sa"
                      enableSearch
                      inputClass="phone-input"
                      buttonClass="phone-flag"
                      disabled={isEdit && isLoadingDetail}
                    />
                  )}
                />
              </div>
              <div className="transport-field__error">
                {errors.contact_no?.message}
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="transport-field">
              <div className="form-floating desig-inp">
                <input
                  type="email"
                  className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                  placeholder=" "
                  disabled={isEdit && isLoadingDetail}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  })}
                />
                <label>
                  Email <span className="text-danger">*</span>
                </label>
              </div>
              <div className="transport-field__error">
                {errors.email?.message}
              </div>
            </div>
          </div>

          <div className="mt-2 transport-company-drivers">
            <div className="transport-company-drivers__header">
              <span
                className="transport-company-drivers__header-title"
                id="transport-company-driver-details-heading"
              >
                Driver details
              </span>
            </div>
            <div
              className="transport-company-drivers__list"
              aria-labelledby="transport-company-driver-details-heading"
            >
              {fields.map((field, index) => (
                <div className="transport-company-driver-row" key={field.id}>
                  <input type="hidden" {...register(`drivers.${index}.transport_driver_id`)} />
                  <div className="transport-company-driver-row__fields">
                    <div className="transport-company-driver-field">
                      <div className="transport-field">
                        <label className="transport-company-driver-field__label">
                          Driver name <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control transport-company-driver-field__input ${errors.drivers?.[index]?.driver_name ? 'is-invalid' : ''}`}
                          placeholder="Enter driver name"
                          disabled={isEdit && isLoadingDetail}
                          {...register(`drivers.${index}.driver_name`, {
                            required: 'Driver name is required',
                          })}
                        />
                        <div className="transport-field__error">
                          {errors.drivers?.[index]?.driver_name?.message}
                        </div>
                      </div>
                    </div>
                    <div className="transport-company-driver-field">
                      <div className="transport-field">
                        <div className="phone-wrapper">
                          <label className="phone-label">
                            Contact no <span className="text-danger">*</span>
                          </label>
                          <Controller
                            name={`drivers.${index}.contact_no`}
                            control={control}
                            rules={{
                              required: 'Contact number is required',
                              validate: (value) => {
                                const digits = (value || '').replace(/\D/g, '');
                                return (
                                  digits.length >= 7 ||
                                  'Enter a valid phone number'
                                );
                              },
                            }}
                            render={({ field }) => (
                              <PhoneInput
                                {...field}
                                country="sa"
                                enableSearch
                                inputClass="phone-input"
                                buttonClass="phone-flag"
                                disabled={isEdit && isLoadingDetail}
                              />
                            )}
                          />
                        </div>
                        <div className="transport-field__error">
                          {errors.drivers?.[index]?.contact_no?.message}
                        </div>
                      </div>
                    </div>
                    <div className="transport-company-driver-field transport-company-driver-field--vehicle">
                      <div className="transport-field">
                        <label className="transport-company-driver-field__label">
                          Vehicle type <span className="text-danger">*</span>
                        </label>
                        <div className="transport-company-driver-field--select">
                          <Controller
                            name={`drivers.${index}.vehicle_type_id`}
                            control={control}
                            rules={{ required: 'Vehicle type is required' }}
                            render={({ field }) => (
                              <PremiumSelect
                                value={field.value != null ? String(field.value) : ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                options={(vehicles || []).map((v) => {
                                  const id = v.vehicle_type_id ?? v._id;
                                  return {
                                    value: String(id ?? ''),
                                    label: String(
                                      v.vehicle_type ??
                                        v.name ??
                                        `Vehicle ${v.vehicle_type_id ?? v._id ?? ''}`,
                                    ),
                                  };
                                })}
                                placeholder="Select vehicle type"
                                searchPlaceholder="Search vehicle type..."
                                disabled={isEdit && isLoadingDetail}
                                hasError={Boolean(errors.drivers?.[index]?.vehicle_type_id)}
                              />
                            )}
                          />
                        </div>
                        <div className="transport-field__error">
                          {errors.drivers?.[index]?.vehicle_type_id?.message}
                        </div>
                      </div>
                    </div>
                    <div className="transport-company-driver-row__actions">
                      <span
                        className="transport-company-driver-field__label transport-company-driver-row__actions-spacer"
                        aria-hidden="true"
                      >
                        &nbsp;
                      </span>
                      <div className="transport-company-driver-row__actions-buttons">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger transport-company-driver-row__remove"
                            onClick={() => remove(index)}
                            title="Remove driver"
                            aria-label="Remove driver"
                          >
                            <FiX size={18} />
                          </button>
                        )}
                        {index === fields.length - 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary transport-company-drivers__add transport-company-drivers__add--icon"
                            onClick={() => append(emptyDriver())}
                            disabled={isEdit && isLoadingDetail}
                            title="Add driver"
                            aria-label="Add driver"
                          >
                            <FiPlus size={18} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer transport-company-modal-footer">
      <button
        type="button"
        className="btn btn-outline"
        onClick={closeModal}
        disabled={isBeingUpdated || (isEdit && isLoadingDetail)}
      >
        Close
      </button>
      <button
        type="submit"
        form="transportCompanyForm"
        className="btn btn-primary"
        disabled={isBeingUpdated || (isEdit && isLoadingDetail)}
      >
        {isBeingUpdated ? 'Saving...' : 'Save'}
      </button>
    </div>
  );

  return (
    <CustomModal
      className="fade role-modal-sm modal show transport-company-modal"
      dialgName="modal-dialog modal-dialog-centered modal-xl transport-company-modal-dialog"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={renderHeader()}
    />
  );
}
