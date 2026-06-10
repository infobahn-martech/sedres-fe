import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CustomModal from "../../../components/CustomModal";
import useOperatorReducer from "../../../store/OperatorReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import PremiumSelect from "../../../components/form/PremiumSelect";

const OPERATOR_STATUS_OPTIONS = [
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Pending", label: "Pending" },
];

const PREMIUM_DATEPICKER_PROPS = {
    dateFormat: "dd/MM/yyyy",
    placeholderText: "dd/mm/yyyy",
    className: "form-control premium-date-input",
    popperClassName: "premium-datepicker-popper",
    calendarClassName: "premium-datepicker-calendar",
    showPopperArrow: false,
};

const parseISODate = (value) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const toISODate = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export function OperatorModal({ showModal, closeModal, onSuccess }) {
    const {
        addOperator,
        updateOperator,
        getOperatorById,
        operatorDetail,
        isBeingUpdated,
        isDetailLoading,
        clearOperatorDetail,
    } = useOperatorReducer((state) => state);

    const isEdit = !!showModal?.operator_id;
    const operatorId = showModal?.operator_id;

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
    } = useForm({
        defaultValues: {
            operator_name: "",
            port_id: "3",
            contact_person: "",
            contact_no: "",
            email: "",
            license_no: "",
            license_expiry: "",
            contract_start_date: "",
            contract_expiry_date: "",
            status: "Active",
        },
    });

    useEffect(() => {
        if (isEdit && operatorId) {
            getOperatorById(operatorId);
        } else {
            clearOperatorDetail?.();
            reset({
                operator_name: "",
                port_id: "3",
                contact_person: "",
                contact_no: "",
                email: "",
                license_no: "",
                license_expiry: "",
                contract_start_date: "",
                contract_expiry_date: "",
                status: "Active",
            });
        }
    }, [isEdit, operatorId]);

    useEffect(() => {
        if (operatorDetail && isEdit) {
            reset({
                operator_name: operatorDetail?.operator_name ?? "",
                port_id: "3",
                contact_person: operatorDetail?.contact_person ?? "",
                contact_no: operatorDetail?.contact_no ?? "",
                email: operatorDetail?.email ?? "",
                license_no: operatorDetail?.license_no ?? "",
                license_expiry: operatorDetail?.license_expiry
                    ? operatorDetail.license_expiry.split("T")[0]
                    : "",
                contract_start_date: operatorDetail?.contract_start_date
                    ? operatorDetail.contract_start_date.split("T")[0]
                    : "",
                contract_expiry_date: operatorDetail?.contract_expiry_date
                    ? operatorDetail.contract_expiry_date.split("T")[0]
                    : "",
                status: operatorDetail?.status ?? "Active",
            });
        }
    }, [operatorDetail, isEdit, reset]);

    const onSubmit = (data) => {
        const basePayload = {
            operator_name: data.operator_name,
            port_id: 3,
            contact_person: data.contact_person,
            contact_no: data.contact_no,
            email: data.email?.trim(),
            license_no: data.license_no,
            license_expiry: data.license_expiry,
            contract_start_date: data.contract_start_date,
            contract_expiry_date: data.contract_expiry_date,
        };

        if (isEdit) {
            updateOperator({
                formData: {
                    ...basePayload,
                    operator_id: operatorId,
                    status: data.status,
                },
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        } else {
            addOperator({
                formData: basePayload,
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        }
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {isEdit ? "Edit Operator" : "Add Operator"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="operatorForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* Name + Contact Person */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.operator_name ? "is-invalid" : ""}`}
                                        placeholder="Operator Name"
                                        {...register("operator_name", {
                                            required: "Operator name is required",
                                        })}
                                    />
                                    <label>Operator Name <span className="text-danger">*</span></label>
                                    {errors.operator_name && (
                                        <span className="error text-danger">{errors.operator_name.message}</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.contact_person ? "is-invalid" : ""}`}
                                        placeholder="Contact Person"
                                        {...register("contact_person", {
                                            required: "Contact person is required",
                                        })}
                                    />
                                    <label>Contact Person <span className="text-danger">*</span></label>
                                    {errors.contact_person && (
                                        <span className="error text-danger">{errors.contact_person.message}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Email + Contact No */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="email"
                                        className={`form-control ${errors.email ? "is-invalid" : ""}`}
                                        placeholder="Email"
                                        {...register("email", {
                                            required: "Email is required",
                                            pattern: {
                                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                message: "Enter a valid email",
                                            },
                                        })}
                                    />
                                    <label>Email <span className="text-danger">*</span></label>
                                    {errors.email && (
                                        <span className="error text-danger">{errors.email.message}</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Contact No <span className="text-danger">*</span></label>
                                    <Controller
                                        name="contact_no"
                                        control={control}
                                        rules={{
                                            required: "Contact no is required",
                                            validate: (value) => {
                                                const digits = (value || "").replace(/\D/g, "");
                                                return digits.length >= 7 || "Enter a valid phone number";
                                            },
                                        }}
                                        render={({ field }) => (
                                            <PhoneInput
                                                {...field}
                                                country="sa"
                                                enableSearch
                                                inputClass="phone-input"
                                                buttonClass="phone-flag"
                                            />
                                        )}
                                    />
                                    {errors.contact_no && (
                                        <span className="error text-danger">{errors.contact_no.message}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* License No + License Expiry */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="License No"
                                        {...register("license_no")}
                                    />
                                    <label>License No</label>
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <Controller
                                    name="license_expiry"
                                    control={control}
                                    render={({ field }) => (
                                        <div
                                            className={`form-floating desig-inp premium-date-field ${field.value ? "has-value" : ""}`}
                                        >
                                            <DatePicker
                                                {...PREMIUM_DATEPICKER_PROPS}
                                                selected={parseISODate(field.value)}
                                                onChange={(date) => field.onChange(toISODate(date))}
                                            />
                                            <label>License Expiry</label>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contract Start + Contract Expiry */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <Controller
                                    name="contract_start_date"
                                    control={control}
                                    render={({ field }) => (
                                        <div
                                            className={`form-floating desig-inp premium-date-field ${field.value ? "has-value" : ""}`}
                                        >
                                            <DatePicker
                                                {...PREMIUM_DATEPICKER_PROPS}
                                                selected={parseISODate(field.value)}
                                                onChange={(date) => field.onChange(toISODate(date))}
                                            />
                                            <label>Contract Start Date</label>
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <Controller
                                    name="contract_expiry_date"
                                    control={control}
                                    render={({ field }) => (
                                        <div
                                            className={`form-floating desig-inp premium-date-field ${field.value ? "has-value" : ""}`}
                                        >
                                            <DatePicker
                                                {...PREMIUM_DATEPICKER_PROPS}
                                                selected={parseISODate(field.value)}
                                                onChange={(date) => field.onChange(toISODate(date))}
                                            />
                                            <label>Contract Expiry Date</label>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status (edit only) */}
                    {isEdit && (
                        <div className="mb-lg-3 mb-sm-0">
                            <div className="permInputs row">
                                <div className="col-lg-6 col-sm-12">
                                    <div className="phone-wrapper">
                                        <label className="phone-label">Status</label>
                                        <Controller
                                            name="status"
                                            control={control}
                                            render={({ field }) => (
                                                <PremiumSelect
                                                    value={field.value != null ? String(field.value) : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    options={OPERATOR_STATUS_OPTIONS}
                                                    placeholder="Select status..."
                                                    searchPlaceholder="Search status..."
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                form="operatorForm"
                className="btn btn-primary"
                disabled={isBeingUpdated || (isEdit && isDetailLoading)}
            >
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="user-modal-sm"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}