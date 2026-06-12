import { useState } from "react";
import { useForm } from "react-hook-form";
import CustomModal from "../../../components/CustomModal";
import useCallTypeReducer from "../../../store/CallTypeReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
];

const buildDefaultFields = (existing) => {
    if (Array.isArray(existing) && existing.length > 0) return existing;
    return [];
};

export function CallTypeModal({ showModal, closeModal, onSuccess }) {
    const addCallType = useCallTypeReducer((s) => s.addCallType);
    const updateCallType = useCallTypeReducer((s) => s.updateCallType);
    const isBeingUpdated = useCallTypeReducer((s) => s.isBeingUpdated);

    const isEdit = !!showModal?.call_type_id;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: isEdit
            ? { call_type_name: showModal?.call_type_name }
            : { call_type_name: "" },
    });

    const [fields, setFields] = useState(buildDefaultFields(showModal?.fields));

    const addField = () => {
        setFields((prev) => [
            ...prev,
            { id: Date.now(), label: "", type: "text", required: false },
        ]);
    };

    const removeField = (id) => {
        setFields((prev) => prev.filter((f) => f.id !== id));
    };

    const updateField = (id, key, value) => {
        setFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, [key]: value } : f))
        );
    };

    const onSubmit = async (data) => {
        const payload = {
            call_type_name: data.call_type_name,
            fields: fields.map(({ label, type, required }) => ({ label, type, required })),
        };

        if (isEdit) {
            await updateCallType({
                formData: { call_type_id: showModal.call_type_id, ...payload },
                cb: () => { closeModal(); onSuccess?.(); },
            });
        } else {
            await addCallType({
                formData: payload,
                cb: () => { closeModal(); onSuccess?.(); },
            });
        }
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {isEdit ? "Edit Call Type" : "Add Call Type"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="callTypeForm" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-3">
                        <div className="form-floating desig-inp">
                            <input
                                className={`form-control ${errors.call_type_name ? "is-invalid" : ""}`}
                                placeholder="Call Type Name"
                                {...register("call_type_name", {
                                    required: "Call type name is required",
                                })}
                            />
                            <label>
                                Call Type Name <span className="text-danger">*</span>
                            </label>
                            {errors.call_type_name && (
                                <span className="error text-danger">
                                    {errors.call_type_name.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold">Template Fields</span>
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={addField}
                            >
                                + Add Field
                            </button>
                        </div>

                        {fields.length === 0 && (
                            <p className="text-muted small mb-0">
                                No fields added yet. Click &quot;+ Add Field&quot; to define the template.
                            </p>
                        )}

                        {fields.map((field, idx) => (
                            <div key={field.id} className="row g-2 align-items-center mb-2">
                                <div className="col-5">
                                    <input
                                        className="form-control form-control-sm"
                                        placeholder={`Field ${idx + 1} label`}
                                        value={field.label}
                                        onChange={(e) => updateField(field.id, "label", e.target.value)}
                                    />
                                </div>
                                <div className="col-4">
                                    <select
                                        className="form-select form-select-sm"
                                        value={field.type}
                                        onChange={(e) => updateField(field.id, "type", e.target.value)}
                                    >
                                        {FIELD_TYPES.map((ft) => (
                                            <option key={ft.value} value={ft.value}>
                                                {ft.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-2 d-flex align-items-center gap-1">
                                    <input
                                        type="checkbox"
                                        className="form-check-input mt-0"
                                        id={`req-${field.id}`}
                                        checked={field.required}
                                        onChange={(e) => updateField(field.id, "required", e.target.checked)}
                                    />
                                    <label className="form-check-label small" htmlFor={`req-${field.id}`}>
                                        Req.
                                    </label>
                                </div>
                                <div className="col-1 text-end">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger px-2"
                                        onClick={() => removeField(field.id)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </form>
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>
                Close
            </button>
            <button
                type="submit"
                form="callTypeForm"
                className="btn btn-primary"
                disabled={isBeingUpdated}
            >
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="role-modal-sm"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
