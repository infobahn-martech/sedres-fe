import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

// You can later move these to a constants file if needed
const MODULE_OPTIONS = [
    { label: "Husbandry", value: "husbandry" },
    { label: "Crew Management", value: "crew_management" },
    { label: "Transport", value: "transport" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Hotel", value: "hotel" },
    { label: "Billing", value: "billing" },
];

const CUSTOM_FIELD_STATUS_OPTIONS = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
];

const FIELD_TYPE_OPTIONS = [
    { label: "Text", value: "text" },
    { label: "Textarea", value: "textarea" },
    { label: "Number", value: "number" },
    { label: "Decimal", value: "decimal" },
    { label: "Email", value: "email" },
    { label: "Phone", value: "phone" },
    { label: "Date", value: "date" },
    { label: "Date & Time", value: "datetime" },
    { label: "Dropdown", value: "dropdown" },
    { label: "Multi Select", value: "multi_select" },
    { label: "Checkbox", value: "checkbox" },
    { label: "Toggle / Switch", value: "toggle" },
    { label: "Radio", value: "radio" },
    { label: "File Upload", value: "file" },
    { label: "Image Upload", value: "image" },
];

export function CustomFieldModal({ showModal, closeModal }) {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
        setValue,
    } = useForm({
        defaultValues: showModal?._id
            ? {
                customFieldName: showModal?.name || "",
                fieldKey: showModal?.key || "",
                description: showModal?.description || "",
                module: showModal?.module || "",
                type: showModal?.type || "",
                order: showModal?.order || 1,
                isRequired: !!showModal?.isRequired,
                isActive: showModal?.isActive ?? true,
            }
            : {
                customFieldName: "",
                fieldKey: "",
                description: "",
                module: "",
                type: "",
                order: 1,
                isRequired: false,
                isActive: true,
            },
    });

    const customFieldName = useWatch({ control, name: "customFieldName" });
    const fieldKey = useWatch({ control, name: "fieldKey" });

    // Auto-generate fieldKey from label for ADD mode only (and when fieldKey is empty)
    useEffect(() => {
        if (!showModal?._id && customFieldName && !fieldKey) {
            const generatedKey = customFieldName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "");
            setValue("fieldKey", generatedKey);
        }
    }, [customFieldName, fieldKey, setValue, showModal]);

    const onSubmit = () => {
        // You can transform data here before sending to API if needed
        closeModal();
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {showModal?._id ? "Edit Custom Field" : "Add Custom Field"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="customFieldForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* SECTION: BASIC DETAILS */}
                    <div className="row">
                        {/* MODULE */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Module <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="module"
                                        control={control}
                                        rules={{ required: "Module is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={MODULE_OPTIONS.map((m) => ({
                                                    value: String(m.value),
                                                    label: String(m.label),
                                                }))}
                                                placeholder="Select Module"
                                                searchPlaceholder="Search module..."
                                                hasError={Boolean(errors.module)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.module && (
                                    <span className="field-error">
                                        {errors.module.message}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* FIELD LABEL */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.customFieldName ? "is-invalid" : ""
                                            }`}
                                        placeholder="Custom Field Name"
                                        {...register("customFieldName", {
                                            required: "Custom field name is required",
                                        })}
                                    />
                                    <label>
                                        Custom Field Name <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.customFieldName && (
                                    <span className="field-error">
                                        {errors.customFieldName.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        {/* FIELD KEY */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.fieldKey ? "is-invalid" : ""
                                            }`}
                                        placeholder="field_key"
                                        {...register("fieldKey", {
                                            required: "Field key is required",
                                        })}
                                    // If you want it fully readonly, uncomment:
                                    // readOnly
                                    />
                                    <label>
                                        Field Key <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.fieldKey && (
                                    <span className="field-error">
                                        {errors.fieldKey.message}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* FIELD TYPE */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Field Type <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="type"
                                        control={control}
                                        rules={{ required: "Field type is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={FIELD_TYPE_OPTIONS.map((ft) => ({
                                                    value: String(ft.value),
                                                    label: String(ft.label),
                                                }))}
                                                placeholder="Select Type"
                                                searchPlaceholder="Search field type..."
                                                hasError={Boolean(errors.type)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.type && (
                                    <span className="field-error">
                                        {errors.type.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* DESCRIPTION — FULL ROW TEXTAREA */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <textarea
                                className="form-control"
                                placeholder="Description"
                                style={{ height: "120px" }}
                                {...register("description")}
                            ></textarea>
                            <label>Description</label>
                        </div>
                    </div>

                    {/* SECTION: VALIDATION & BEHAVIOR */}
                    <div className="modal-section-title mt-3">
                        Validation &amp; Behavior
                    </div>
                    <div className="row">
                        {/* REQUIRED */}
                        <div className="col-lg-4 mb-lg-3 mb-sm-0">
                            <div className="form-check mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="isRequired"
                                    {...register("isRequired")}
                                />
                                <label className="form-check-label" htmlFor="isRequired">
                                    Required Field
                                </label>
                            </div>
                        </div>

                        {/* STATUS */}
                        <div className="col-lg-4 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Status <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="isActive"
                                        control={control}
                                        rules={{ required: "Status is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={
                                                    field.value === undefined || field.value === null
                                                        ? ""
                                                        : String(Boolean(field.value))
                                                }
                                                onChange={(e) =>
                                                    field.onChange(e.target.value === "true")
                                                }
                                                options={CUSTOM_FIELD_STATUS_OPTIONS}
                                                placeholder="Select status"
                                                searchPlaceholder="Search status..."
                                                hasError={Boolean(errors.isActive)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.isActive && (
                                    <span className="field-error">
                                        {errors.isActive.message}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ORDER */}
                        <div className="col-lg-4 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="number"
                                        className={`form-control ${errors.order ? "is-invalid" : ""
                                            }`}
                                        placeholder="Order"
                                        {...register("order", {
                                            required: "Display order is required",
                                            valueAsNumber: true,
                                            min: {
                                                value: 1,
                                                message: "Order must be at least 1",
                                            },
                                        })}
                                    />
                                    <label>
                                        Display Order <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.order && (
                                    <span className="field-error">
                                        {errors.order.message}
                                    </span>
                                )}
                            </div>
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
                onClick={() => closeModal(null)}
            >
                Close
            </button>
            <button type="submit" form="customFieldForm" className="btn btn-primary">
                Save
            </button>
        </div>
    );

    return (
        <CustomModal
            className="role-modal-sm" // you can change to a larger class if needed
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
