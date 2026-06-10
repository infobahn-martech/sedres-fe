import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import PremiumDateField from "../../../components/PremiumDateField";
import useFleetReducer from "../../../store/FleetReducer";
import operatorService from "../../../services/operatorService";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/master-modal-form.scss";

export function FleetModal({ showModal, closeModal, onSuccess }) {
    const {
        addFleet,
        updateFleet,
        getFleetById,
        fleetDetail,
        isBeingUpdated,
        isDetailLoading,
        clearFleetDetail,
    } = useFleetReducer((state) => state);

    const isEdit = !!showModal?.taxi_boat_id;
    const fleetId = showModal?.taxi_boat_id;

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
    } = useForm({
        defaultValues: {
            taxi_boat_name: "",
            registration_no: "",
            operator_id: "",
            capacity_persons: "",
            insurance_expiry: "",
            certificate_expiry: "",
        },
    });

    const [operatorList, setOperatorList] = React.useState([]);

    useEffect(() => {
        const fetchOperators = async () => {
            try {
                const { data } = await operatorService.getAllOperators({
                    limit: 1000,
                    page: 1,
                });
                setOperatorList(data?.data ?? []);
            } catch {
                setOperatorList([]);
            }
        };
        if (showModal) fetchOperators();
    }, [!!showModal]);

    useEffect(() => {
        if (isEdit && fleetId) {
            getFleetById(fleetId);
        } else {
            clearFleetDetail?.();
            reset({
                taxi_boat_name: "",
                registration_no: "",
                operator_id: "",
                capacity_persons: "",
                insurance_expiry: "",
                certificate_expiry: "",
            });
        }
    }, [isEdit, fleetId]);

    useEffect(() => {
        if (fleetDetail && isEdit) {
            reset({
                taxi_boat_name: fleetDetail?.taxi_boat_name ?? "",
                registration_no: fleetDetail?.registration_no ?? "",
                operator_id: fleetDetail?.operator_id ?? "",
                capacity_persons: fleetDetail?.capacity_persons ?? "",
                insurance_expiry: fleetDetail?.insurance_expiry
                    ? fleetDetail.insurance_expiry.split("T")[0]
                    : "",
                certificate_expiry: fleetDetail?.certificate_expiry
                    ? fleetDetail.certificate_expiry.split("T")[0]
                    : "",
            });
        }
    }, [fleetDetail, isEdit, reset]);

    const onSubmit = (data) => {
        const payload = {
            taxi_boat_name: data.taxi_boat_name,
            registration_no: data.registration_no,
            operator_id: Number(data.operator_id),
            capacity_persons: data.capacity_persons ? Number(data.capacity_persons) : null,
            insurance_expiry: data.insurance_expiry || null,
            certificate_expiry: data.certificate_expiry || null,
        };

        if (isEdit) {
            updateFleet({
                formData: { ...payload, taxi_boat_id: fleetId },
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        } else {
            addFleet({
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
            {isEdit ? "Edit Fleet" : "Add Fleet"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="fleetForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* Taxi Boat Name + Registration No */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.taxi_boat_name ? "is-invalid" : ""}`}
                                        placeholder="Taxi Boat Name"
                                        {...register("taxi_boat_name", {
                                            required: "Taxi boat name is required",
                                        })}
                                    />
                                    <label>Taxi Boat Name <span className="text-danger">*</span></label>
                                    {errors.taxi_boat_name && (
                                        <span className="error text-danger">{errors.taxi_boat_name.message}</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Registration No"
                                        {...register("registration_no")}
                                    />
                                    <label>Registration No</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Operator + Capacity */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Operator <span className="text-danger">*</span></label>
                                    <Controller
                                        name="operator_id"
                                        control={control}
                                        rules={{ required: "Operator is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={operatorList.map((op) => ({
                                                    value: String(op.operator_id ?? ""),
                                                    label: String(op.operator_name ?? ""),
                                                }))}
                                                placeholder="Select Operator"
                                                searchPlaceholder="Search operator..."
                                                hasError={Boolean(errors.operator_id)}
                                            />
                                        )}
                                    />
                                    {errors.operator_id && (
                                        <span className="error text-danger">{errors.operator_id.message}</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="number"
                                        className="form-control"
                                        placeholder="Capacity (Persons)"
                                        min="1"
                                        {...register("capacity_persons")}
                                    />
                                    <label>Capacity (Persons)</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insurance Expiry + Certificate Expiry */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <PremiumDateField
                                    control={control}
                                    name="insurance_expiry"
                                    label="Insurance Expiry"
                                />
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <PremiumDateField
                                    control={control}
                                    name="certificate_expiry"
                                    label="Certificate Expiry"
                                />
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
                onClick={closeModal}
                disabled={isBeingUpdated}
            >
                Close
            </button>
            <button
                type="submit"
                form="fleetForm"
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
