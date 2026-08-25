import { useForm } from "react-hook-form";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

export function JobStatusBEModal({ showModal, closeModal }) {
    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        defaultValues: showModal?._id
            ? {
                jobStatusName: showModal?.name || "",
                statusCode: showModal?.code || "",
                description: showModal?.description || "",
                order: showModal?.order || 1,
                color: showModal?.color || "#27AE60",
                isFinal: !!showModal?.isFinal,
                isActive: showModal?.isActive ?? true
            }
            : {
                jobStatusName: "",
                statusCode: "",
                description: "",
                order: 1,
                color: "#27AE60",
                isFinal: false,
                isActive: true
            }
    });

    const onSubmit = () => {
        closeModal();
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {showModal?._id ? "Edit Job Status" : "Add Job Status"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="jobStatusForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* JOB STATUS NAME + STATUS CODE */}
                    <div className="row">
                        {/* JOB STATUS NAME */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.jobStatusName ? "is-invalid" : ""
                                            }`}
                                        placeholder="Job Status Name"
                                        {...register("jobStatusName", {
                                            required: "Job status name is required"
                                        })}
                                    />
                                    <label>
                                        Job Status <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.jobStatusName && (
                                    <span className="field-error">
                                        {errors.jobStatusName.message}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* STATUS CODE */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.statusCode ? "is-invalid" : ""
                                            }`}
                                        placeholder="Status Code"
                                        {...register("statusCode", {
                                            required: "Status code is required"
                                        })}
                                    />
                                    <label>
                                        Status Code <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.statusCode && (
                                    <span className="field-error">
                                        {errors.statusCode.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ORDER + COLOR */}
                    <div className="row">
                        {/* DISPLAY ORDER */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="number"
                                        className={`form-control ${errors.order ? "is-invalid" : ""
                                            }`}
                                        placeholder="Display Order"
                                        {...register("order", {
                                            required: "Display order is required",
                                            valueAsNumber: true,
                                            min: {
                                                value: 1,
                                                message: "Order must be at least 1"
                                            }
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

                        {/* COLOR */}
                        <div className="col-lg-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="color"
                                        className={`form-control form-control-color ${errors.color ? "is-invalid" : ""
                                            }`}
                                        id="statusColor"
                                        {...register("color", {
                                            required: "Color is required"
                                        })}
                                    />
                                    <label htmlFor="statusColor">
                                        Status Color <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.color && (
                                    <span className="field-error">
                                        {errors.color.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* FLAGS: ACTIVE + FINAL STATUS */}
                    <div className="row mb-lg-3 mb-sm-0">
                        {/* ACTIVE */}
                        <div className="col-lg-6 d-flex align-items-center">
                            <div className="form-check mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="isActive"
                                    {...register("isActive")}
                                />
                                <label className="form-check-label" htmlFor="isActive">
                                    Active
                                </label>
                            </div>
                        </div>

                        {/* FINAL STATUS */}
                        <div className="col-lg-6 d-flex align-items-center">
                            <div className="form-check mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="isFinal"
                                    {...register("isFinal")}
                                />
                                <label className="form-check-label" htmlFor="isFinal">
                                    Mark as Final Status
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* DESCRIPTION — FULL ROW TEXTAREA */}
                    <div className="mb-lg-3 mb-sm-0 mt-3">
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
            <button type="submit" form="jobStatusForm" className="btn btn-primary">
                Save
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
