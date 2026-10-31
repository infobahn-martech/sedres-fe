import { useForm } from "react-hook-form";
import { useEffect } from "react";
import CustomModal from "../../../components/CustomModal";
import useVehicleReducer from "../../../store/VehicleReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/master-modal-form.scss";

export function VehicleModal({ showModal, closeModal, onSuccess, type = "transport" }) {
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm({
        defaultValues: {
            vehicle_type: "",
            seater: "",
        },
    });

    const { addVehicle, updateVehicle, isBeingUpdated } = useVehicleReducer((state) => state);

    const isEdit = showModal && typeof showModal === "object" && (showModal.vehicle_type_id ?? showModal._id);
    const vehicleTypeId = isEdit ? (showModal.vehicle_type_id ?? showModal._id) : null;

    useEffect(() => {
        if (isEdit) {
            reset({
                vehicle_type: showModal?.vehicle_type ?? "",
                seater: showModal?.seater ?? "",
            });
        } else {
            reset({
                vehicle_type: "",
                seater: "",
            });
        }
    }, [showModal, isEdit, reset]);

    const onSubmit = async (data) => {
        const formData = {
            vehicle_type: data.vehicle_type?.trim() ?? "",
            // valueAsNumber turns an empty input into NaN.
            seater: Number.isNaN(data.seater) || data.seater === "" ? null : data.seater,
        };

        const cb = () => {
            closeModal();
            onSuccess?.();
        };

        if (isEdit) {
            await updateVehicle({
                formData: { vehicle_type_id: vehicleTypeId, ...formData },
                cb,
                type,
            });
        } else {
            await addVehicle({ formData, cb, type });
        }
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {isEdit ? "Edit Vehicle Type" : "Add Vehicle Type"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="vehicleForm" onSubmit={handleSubmit(onSubmit)}>

                    {/* VEHICLE TYPE */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <input
                                className={`form-control ${errors.vehicle_type ? "is-invalid" : ""
                                    }`}
                                placeholder="Vehicle Type"
                                {...register("vehicle_type", {
                                    required: "Vehicle type is required",
                                })}
                            />
                            <label>
                                Vehicle Type <span className="text-danger">*</span>
                            </label>
                        </div>
                        {errors.vehicle_type && (
                            <span className="field-error">
                                {errors.vehicle_type.message}
                            </span>
                        )}
                    </div>

                    {/* SEATER */}
                    <div className="form-field">
                        <div className="form-floating desig-inp">
                            <input
                                type="number"
                                className={`form-control ${errors.seater ? "is-invalid" : ""
                                    }`}
                                placeholder="Seater"
                                min={1}
                                {...register("seater", {
                                    valueAsNumber: true,
                                    validate: (val) =>
                                        Number.isNaN(val) || val === "" || val > 0 || "Seater must be greater than 0",
                                })}
                            />
                            <label>Seater</label>
                        </div>
                        {errors.seater && (
                            <span className="field-error">
                                {errors.seater.message}
                            </span>
                        )}
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
            <button type="submit" form="vehicleForm" className="btn btn-primary" disabled={isBeingUpdated}>
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
