import { useEffect } from "react";
import { useForm } from "react-hook-form";
import CustomModal from "../../../components/CustomModal";
import useLaunchHireServiceReducer from "../../../store/LaunchHireServiceReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/master-modal-form.scss";

export function FleetModal({ showModal, closeModal, onSuccess }) {
    const {
        addLaunchHireService,
        updateLaunchHireService,
        getLaunchHireServiceById,
        serviceDetail,
        isBeingUpdated,
        isDetailLoading,
        clearServiceDetail,
    } = useLaunchHireServiceReducer((state) => state);

    const isEdit = !!showModal?.launchhire_service_id;
    const serviceId = showModal?.launchhire_service_id;

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm({
        defaultValues: {
            service_name: "",
            description: "",
        },
    });

    useEffect(() => {
        if (isEdit && serviceId) {
            getLaunchHireServiceById(serviceId);
        } else {
            clearServiceDetail?.();
            reset({
                service_name: "",
                description: "",
            });
        }
    }, [isEdit, serviceId, getLaunchHireServiceById, clearServiceDetail, reset]);

    useEffect(() => {
        if (serviceDetail && isEdit) {
            reset({
                service_name: serviceDetail?.service_name ?? "",
                description: serviceDetail?.description ?? "",
            });
        }
    }, [serviceDetail, isEdit, reset]);

    const onSubmit = (data) => {
        const payload = {
            service_name: data.service_name,
            description: data.description || null,
        };

        if (isEdit) {
            updateLaunchHireService({
                formData: {
                    ...payload,
                    launchhire_service_id: serviceId,
                },
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        } else {
            addLaunchHireService({
                formData: payload,
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        }
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {isEdit ? "Edit Service" : "Add Service"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="launchHireServiceForm" onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-floating desig-inp">
                            <input
                                type="text"
                                className={`form-control ${errors.service_name ? "is-invalid" : ""}`}
                                placeholder="Service Name"
                                {...register("service_name", {
                                    required: "Service name is required",
                                })}
                            />
                            <label>
                                Service Name <span className="text-danger">*</span>
                            </label>
                            {errors.service_name && (
                                <span className="error text-danger">
                                    {errors.service_name.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-floating desig-inp">
                            <textarea
                                className="form-control"
                                placeholder="Description"
                                {...register("description")}
                            />
                            <label>Description</label>
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
                form="launchHireServiceForm"
                className="btn btn-primary"
                disabled={isBeingUpdated || (isEdit && isDetailLoading)}
            >
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="role-modal-sm master-modal-form"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
