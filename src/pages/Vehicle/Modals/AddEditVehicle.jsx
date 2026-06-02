import { useForm, Controller, useWatch } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import { useEffect } from "react";
import CustomModal from "../../../components/CustomModal";
import useVehicleReducer from "../../../store/VehicleReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/master-modal-form.scss";

const VEHICLE_PURPOSE_OPTIONS = [
    { value: "crew_transport", label: "Crew Transport" },
    { value: "material", label: "Material" },
];

export function VehicleModal({ showModal, closeModal, onSuccess }) {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm({
        defaultValues: {
            vehicle_type: "",
            vehicle_purpose: "",
            seater: "",
        },
    });

    const { addVehicle, updateVehicle, isBeingUpdated } = useVehicleReducer((state) => state);
    const vehiclePurpose = useWatch({ control, name: "vehicle_purpose" });
    const showSeater = vehiclePurpose === "crew_transport";

    const isEdit = showModal && typeof showModal === "object" && (showModal.vehicle_type_id ?? showModal._id);
    const vehicleTypeId = isEdit ? (showModal.vehicle_type_id ?? showModal._id) : null;

    useEffect(() => {
        if (isEdit) {
            reset({
                vehicle_type: showModal?.vehicle_type ?? "",
                vehicle_purpose: showModal?.vehicle_purpose ?? "",
                seater: showModal?.seater ?? "",
            });
        } else {
            reset({
                vehicle_type: "",
                vehicle_purpose: "",
                seater: "",
            });
        }
    }, [showModal, isEdit, reset]);

    const onSubmit = async (data) => {
        const formData = {
            vehicle_type: data.vehicle_type?.trim() ?? "",
            vehicle_purpose: data.vehicle_purpose ?? "",
            seater: showSeater ? (data.seater ?? null) : null,
        };

        const cb = () => {
            closeModal();
            onSuccess?.();
        };

        if (isEdit) {
            await updateVehicle({
                formData: { vehicle_type_id: vehicleTypeId, ...formData },
                cb,
            });
        } else {
            await addVehicle({ formData, cb });
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
                    <div className="mb-lg-3 mb-sm-0">
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
                            {errors.vehicle_type && (
                                <span className="error text-danger">
                                    {errors.vehicle_type.message}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* VEHICLE PURPOSE */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="phone-wrapper">
                            <label className="phone-label">
                                Vehicle Purpose <span className="text-danger">*</span>
                            </label>
                            <Controller
                                name="vehicle_purpose"
                                control={control}
                                rules={{ required: "Vehicle purpose is required" }}
                                render={({ field }) => (
                                    <PremiumSelect
                                        value={field.value != null ? String(field.value) : ""}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        options={VEHICLE_PURPOSE_OPTIONS}
                                        placeholder="Select Vehicle Purpose"
                                        searchPlaceholder="Search vehicle purpose..."
                                        hasError={Boolean(errors.vehicle_purpose)}
                                        menuPortalTarget={
                                            typeof document !== "undefined" ? document.body : null
                                        }
                                        menuPosition="fixed"
                                    />
                                )}
                            />
                            {errors.vehicle_purpose && (
                                <span className="error text-danger">
                                    {errors.vehicle_purpose.message}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* SEATER - Only show when Crew Transport is selected */}
                    {showSeater && (
                        <div className="mb-lg-3 mb-sm-0">
                            <div className="form-floating desig-inp">
                                <input
                                    type="number"
                                    className={`form-control ${errors.seater ? "is-invalid" : ""
                                        }`}
                                    placeholder="Seater"
                                    min={1}
                                    {...register("seater", {
                                        required: showSeater ? "Seater is required" : false,
                                        valueAsNumber: true,
                                        validate: (val) =>
                                            !showSeater || val > 0 || "Seater must be greater than 0",
                                    })}
                                />
                                <label>
                                    Seater <span className="text-danger">*</span>
                                </label>
                                {errors.seater && (
                                    <span className="error text-danger">
                                        {errors.seater.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}


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
