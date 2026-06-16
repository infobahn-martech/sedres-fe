import { useForm } from "react-hook-form";
import CustomModal from "../../../components/CustomModal";
import usePackingTypeReducer from "../../../store/PackingTypeReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

export function PackingTypeModal({ showModal, closeModal, onSuccess }) {
    const addPackingType = usePackingTypeReducer((s) => s.addPackingType);
    const updatePackingType = usePackingTypeReducer((s) => s.updatePackingType);
    const isBeingUpdated = usePackingTypeReducer((s) => s.isBeingUpdated);

    const isEdit = !!showModal?.package_type_id;

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm({
        defaultValues: isEdit
            ? { package_type: showModal?.package_type }
            : { package_type: "" }
    });

    const onSubmit = async (data) => {
        if (isEdit) {
            await updatePackingType({
                formData: {
                    package_type_id: showModal.package_type_id,
                    package_type: data.package_type,
                },
                cb: () => {
                    closeModal();
                    onSuccess?.();
                },
            });
        } else {
            await addPackingType({
                formData: { package_type: data.package_type },
                cb: () => {
                    closeModal();
                    onSuccess?.();
                },
            });
        }
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {isEdit ? "Edit Packaging Type" : "Add Packaging Type"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="packingTypeForm" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-floating desig-inp">
                            <input
                                className={`form-control ${errors.package_type ? "is-invalid" : ""}`}
                                placeholder="Packaging Type Name"
                                {...register("package_type", {
                                    required: "Packaging type name is required"
                                })}
                            />
                            <label>
                                Packaging Type <span className="text-danger">*</span>
                            </label>

                            {errors.package_type && (
                                <span className="error text-danger">
                                    {errors.package_type.message}
                                </span>
                            )}
                        </div>
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
                form="packingTypeForm"
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
