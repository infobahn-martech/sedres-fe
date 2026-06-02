import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import CommonSelect from "../../../components/CommonSelect";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import useHospitalReducer from "../../../store/HospitalReducer";
import hospitalService from "../../../services/hospitalService";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "./hospital-service-modal.scss";

export function HospitalServiceModal({ showModal, closeModal, onSuccess }) {
    const { addUpdateHospitalService, getServicesByHospital, isBeingUpdated } = useHospitalReducer(
        (state) => state,
    );

    const isEdit =
        showModal && typeof showModal === "object" && !!(showModal.hospital_id ?? showModal.hospital_service_id);

    const [hospitalOptions, setHospitalOptions] = useState([]);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm({
        defaultValues: {
            hospital_id: null,
            service_ids: [],
            remarks: "",
        },
    });

    const selectedServiceIds = useWatch({ control, name: "service_ids", defaultValue: [] });
    const selectedCount = useMemo(
        () => (Array.isArray(selectedServiceIds) ? selectedServiceIds.length : 0),
        [selectedServiceIds],
    );

    useEffect(() => {
        if (!showModal) return;
        let cancelled = false;
        setLoadingOptions(true);
        (async () => {
            try {
                const [hRes, sRes] = await Promise.all([
                    hospitalService.getHospitalData({
                        params: { page: 1, limit: 1000, searchTerm: "" },
                    }),
                    hospitalService.getMedicalServiceData({
                        params: { page: 1, limit: 1000, searchTerm: "" },
                    }),
                ]);
                if (cancelled) return;
                const hRaw = hRes.data?.data ?? hRes.data?.hospitals ?? [];
                const sRaw = sRes.data?.data ?? sRes.data?.medical_services ?? [];
                setHospitalOptions(
                    (Array.isArray(hRaw) ? hRaw : []).map((h) => {
                        const id = h.hospital_id ?? h._id;
                        return {
                            value: id != null ? Number(id) : id,
                            label: h.hospital_name ?? String(id ?? ""),
                        };
                    }),
                );
                setServiceOptions(
                    (Array.isArray(sRaw) ? sRaw : []).map((s) => ({
                        value: Number(s.service_id ?? s._id),
                        label: s.service_name ?? String(s.service_id ?? ""),
                    })),
                );
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showModal]);

    useEffect(() => {
        if (!showModal) return;
        if (showModal === true) {
            reset({ hospital_id: null, service_ids: [], remarks: "" });
            return;
        }
        if (typeof showModal === "object") {
            const hid = showModal.hospital_id;
            reset({
                hospital_id: hid != null ? Number(hid) : null,
                service_ids: (showModal.services || [])
                    .map((s) => Number(s.service_id))
                    .filter((id) => !Number.isNaN(id)),
                remarks: showModal.remarks ?? "",
            });
        }
    }, [showModal, reset]);

    useEffect(() => {
        if (!isEdit || typeof showModal !== "object") return;
        const hid = showModal.hospital_id;
        if (!hid) return;
        let cancelled = false;
        (async () => {
            const detail = await getServicesByHospital(hid);
            if (cancelled || !detail) return;
            const ids = (detail.services || [])
                .map((s) => Number(s.service_id))
                .filter((id) => !Number.isNaN(id));
            const fallbackIds = (showModal.services || [])
                .map((s) => Number(s.service_id))
                .filter((id) => !Number.isNaN(id));
            const resolvedHid = detail.hospital_id ?? hid;
            reset({
                hospital_id: resolvedHid != null ? Number(resolvedHid) : null,
                service_ids: ids.length ? ids : fallbackIds,
                remarks: detail.remarks ?? showModal.remarks ?? "",
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit, showModal, getServicesByHospital, reset]);

    const onSubmit = (data) => {
        const hospitalId = data.hospital_id;
        if (hospitalId == null) return;

        const payload = {
            hospital_id: hospitalId,
            service_ids: Array.isArray(data.service_ids) ? data.service_ids.map(Number) : [],
            remarks: (data.remarks || "").trim(),
        };

        addUpdateHospitalService({
            formData: payload,
            cb: () => {
                closeModal(null);
                onSuccess?.();
            },
        });
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {isEdit ? "Edit Hospital Services" : "Add Hospital Services"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="hospitalServiceForm" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="phone-wrapper">
                            <label className="phone-label" htmlFor="hospital-service-hospital">
                                Hospital <span className="text-danger">*</span>
                            </label>
                            <Controller
                                name="hospital_id"
                                control={control}
                                rules={{ required: "Hospital is required" }}
                                render={({ field }) => (
                                    <PremiumSelect
                                        value={field.value != null ? String(field.value) : ""}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            field.onChange(raw === "" ? null : Number(raw));
                                        }}
                                        options={hospitalOptions.map((o) => ({
                                            value: String(o.value),
                                            label: o.label,
                                        }))}
                                        placeholder={
                                            loadingOptions ? "Loading…" : "Select Hospital"
                                        }
                                        searchPlaceholder="Search hospital..."
                                        disabled={loadingOptions || isBeingUpdated}
                                        hasError={Boolean(errors.hospital_id)}
                                        menuPortalTarget={
                                            typeof document !== "undefined" ? document.body : null
                                        }
                                        menuPosition="fixed"
                                    />
                                )}
                            />
                            {errors.hospital_id && (
                                <span className="error text-danger">
                                    {errors.hospital_id.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mb-lg-3 mb-sm-0">
                        <div className="phone-wrapper">
                            <label className="phone-label" htmlFor="hospital-service-services">
                                Services <span className="text-danger">*</span>
                                {selectedCount > 0 && (
                                    <span className="text-muted ms-1">({selectedCount} selected)</span>
                                )}
                            </label>
                            <Controller
                                name="service_ids"
                                control={control}
                                rules={{
                                    validate: (v) =>
                                        (Array.isArray(v) && v.length > 0) ||
                                        "Select at least one service",
                                }}
                                render={({ field }) => {
                                    const selectedOptions = serviceOptions.filter((o) =>
                                        (field.value || []).includes(o.value),
                                    );

                                    return (
                                        <CommonSelect
                                            inputId="hospital-service-services"
                                            isMulti
                                            options={serviceOptions}
                                            value={selectedOptions}
                                            onChange={(opts) => {
                                                field.onChange(
                                                    Array.isArray(opts)
                                                        ? opts.map((o) => o.value)
                                                        : [],
                                                );
                                            }}
                                            placeholder={
                                                loadingOptions ? "Loading…" : "Select Service(s)"
                                            }
                                            className={`hospital-service-multi-select ${errors.service_ids ? "is-invalid" : ""
                                                }`}
                                            classNamePrefix="react-select"
                                            isDisabled={loadingOptions || isBeingUpdated}
                                            menuPosition="fixed"
                                            closeMenuOnSelect={false}
                                            hideSelectedOptions={false}
                                            maxheight={220}
                                        />
                                    );
                                }}
                            />
                            {errors.service_ids && (
                                <span className="error text-danger">
                                    {errors.service_ids.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-floating desig-inp master-modal-form__textarea-tall">
                            <textarea
                                id="hospital-service-remarks"
                                className={`form-control ${errors.remarks ? "is-invalid" : ""}`}
                                placeholder="Remarks"
                                {...register("remarks")}
                            />
                            <label htmlFor="hospital-service-remarks">Remarks</label>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button
                type="button"
                className="btn btn-outline"
                onClick={closeModal}
                disabled={isBeingUpdated}
            >
                Close
            </button>

            <button
                type="submit"
                form="hospitalServiceForm"
                className="btn btn-primary"
                disabled={isBeingUpdated || loadingOptions}
            >
                {isBeingUpdated ? "Saving…" : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="role-modal-sm master-modal-form hospital-service-modal"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
