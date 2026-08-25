import { useForm, Controller } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

const STATUS_MODULE_OPTIONS = [
    { value: "husbandry", label: "Husbandry" },
    { value: "transport", label: "Transport" },
    { value: "crew", label: "Crew" },
    { value: "warehouse", label: "Warehouse" },
];

export function StatusModal({ showModal, closeModal }) {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: showModal?._id
            ? {
                statusName: showModal?.name,
                statusCode: showModal?.code,
                description: showModal?.description,
                module: showModal?.module,
                order: showModal?.order,
                color: showModal?.color || "#2f80ed",
            }
            : {},
    });

    const onSubmit = () => {
        closeModal();
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {showModal?._id ? "Edit Status" : "Add Status"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="statusForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* STATUS NAME */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <input
                                className={`form-control ${errors.statusName ? "is-invalid" : ""
                                    }`}
                                placeholder="Status Name"
                                {...register("statusName", {
                                    required: "Status name is required",
                                })}
                            />
                            <label>
                                Status Name <span className="text-danger">*</span>
                            </label>
                        </div>
                        {errors.statusName && (
                            <span className="field-error">
                                {errors.statusName.message}
                            </span>
                        )}
                    </div>

                    {/* STATUS CODE */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <input
                                className="form-control"
                                placeholder="Status Code"
                                {...register("statusCode")}
                            />
                            <label>Status Code</label>
                        </div>
                    </div>

                    {/* DESCRIPTION */}
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

                    {/* TYPE / MODULE */}
                    <div className="form-field">
                        <div className="phone-wrapper">
                            <label className="phone-label">Type / Module</label>
                            <Controller
                                name="module"
                                control={control}
                                render={({ field }) => (
                                    <PremiumSelect
                                        value={field.value != null ? String(field.value) : ""}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        options={STATUS_MODULE_OPTIONS}
                                        placeholder="Select"
                                        searchPlaceholder="Search module..."
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* DISPLAY ORDER */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <input
                                type="number"
                                className="form-control"
                                placeholder="Display Order"
                                {...register("order")}
                            />
                            <label>Display Order</label>
                        </div>
                    </div>

                    {/* STATUS COLOR */}
                    <div className="form-field">
                        <label className="mb-2 fw-semibold">Status Color</label>
                        <input
                            type="color"
                            className="form-control form-control-color"
                            {...register("color")}
                            style={{ height: "45px", width: "70px", padding: 0 }}
                        />
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
            <button type="submit" form="statusForm" className="btn btn-primary">
                Save
            </button>
        </div>
    );

    return (
        <CustomModal
            className="status-modal-sm"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
