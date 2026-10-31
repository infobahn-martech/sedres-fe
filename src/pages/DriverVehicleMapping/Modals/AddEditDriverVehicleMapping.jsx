import { useForm, Controller } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import { useEffect, useMemo } from "react";
import CustomModal from "../../../components/CustomModal";
import useDriverVehicleMappingReducer from "../../../store/DriverVehicleReducer";
import useDriverReducer from "../../../store/DriverReducer";
import useVehicleReducer from "../../../store/VehicleReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

const EMPTY_DRIVER_LIST = [];

/** IDs from GET mapping row — backends vary (`driver_id`, nested objects, etc.). */
function pickDriverIdFromMappingRow(row) {
    if (!row || typeof row !== "object") return "";
    const v =
        row.driver_id ??
        row.transport_driver_id ??
        row.transport_driver_Id ??
        row.driverId ??
        row.driver?.driver_id ??
        row.driver?.transport_driver_id ??
        row.driver?.id;
    return v != null && String(v).trim() !== "" ? String(v) : "";
}

/** Match mapping row to `/transport/all_drivers` when list payload omits FK ids (employee_no / name only). */
function resolveDriverIdFromMasterList(row, list) {
    const direct = pickDriverIdFromMappingRow(row);
    if (direct) return direct;
    if (!Array.isArray(list) || list.length === 0) return "";

    const rowEmployeeRaw = row?.employee_no ?? row?.driver_no;
    const rowEmployee = rowEmployeeRaw != null ? String(rowEmployeeRaw).trim() : "";
    const rowName =
        row?.driver_name != null ? String(row.driver_name).trim().toLowerCase() : "";

    for (const d of list) {
        const did = String(d.driver_id ?? d.transport_driver_id ?? d._id ?? "");
        if (!did) continue;

        if (rowEmployee) {
            const emp = d.employee_no != null ? String(d.employee_no).trim() : "";
            const dn = d.driver_no != null ? String(d.driver_no).trim() : "";
            if (emp && rowEmployee === emp) return did;
            if (dn && rowEmployee === dn) return did;
        }

        if (rowName && d.driver_name != null) {
            const n = String(d.driver_name).trim().toLowerCase();
            if (n === rowName) return did;
        }
    }
    return "";
}

function pickVehicleTypeIdFromMappingRow(row) {
    if (!row || typeof row !== "object") return "";
    const v =
        row.vehicle_type_id ??
        row.vehicle_type_Id ??
        row.vehicleTypeId ??
        row.vehicle_id ??
        row.vehicle?.vehicle_type_id ??
        row.vehicle_type?.vehicle_type_id ??
        row.vehicle_type?._id ??
        row.vehicle?.id;
    return v != null && String(v).trim() !== "" ? String(v) : "";
}

/** Match display label from mapping row to `/transport/all_vehicle_types?vehicle_purpose=...`. */
function resolveVehicleTypeIdFromMasterList(row, list) {
    const direct = pickVehicleTypeIdFromMappingRow(row);
    if (direct) return direct;
    if (!Array.isArray(list) || list.length === 0) return "";

    const rowVt =
        row?.vehicle_type != null ? String(row.vehicle_type).trim().toLowerCase() : "";
    if (!rowVt) return "";

    for (const v of list) {
        const vid = String(v.vehicle_type_id ?? v._id ?? "");
        if (!vid) continue;
        const lbl = v.vehicle_type ?? v.name;
        if (lbl != null && String(lbl).trim().toLowerCase() === rowVt) return vid;
    }
    return "";
}

export function DriverVehicleMappingModal({ showModal, closeModal, onSuccess, type = "transport" }) {
    const driverVehicleId = showModal?.driver_vehicle_id ?? showModal?._id;
    const isEdit = typeof showModal === "object" && showModal !== null && !!driverVehicleId;

    const { addDriverVehicleMapping, updateDriverVehicleMapping, isBeingUpdated } = useDriverVehicleMappingReducer((state) => state);
    const drivers = useDriverReducer((state) => state.drivers);
    const fetchAllDrivers = useDriverReducer((state) => state.fetchAllDrivers);
    const vehicles = useVehicleReducer((state) => state.vehicles);
    const getVehicleTypes = useVehicleReducer((state) => state.getVehicleTypes);

    const driversList = drivers != null ? drivers : EMPTY_DRIVER_LIST;
    const vehiclesList = vehicles ?? EMPTY_DRIVER_LIST;

    const { register, control, handleSubmit, formState: { errors }, reset } = useForm({
        defaultValues: {
            driver_id: "",
            vehicle_type_id: "",
            plate_no: "",
        },
    });

    useEffect(() => {
        if (showModal) {
            fetchAllDrivers?.({ params: {} });
            getVehicleTypes?.({ type });
        }
    }, [showModal]);

    useEffect(() => {
        if (!showModal) return;

        const addMode = typeof showModal !== "object" || !driverVehicleId;
        if (addMode) {
            reset({ driver_id: "", vehicle_type_id: "", plate_no: "" });
            return;
        }

        const directDriver = pickDriverIdFromMappingRow(showModal);
        if (!directDriver && drivers === null) return;

        const driverVal = resolveDriverIdFromMasterList(showModal, driversList);
        const vehicleVal = resolveVehicleTypeIdFromMasterList(showModal, vehiclesList);

        reset({
            driver_id: driverVal ? String(driverVal) : "",
            vehicle_type_id: vehicleVal ? String(vehicleVal) : "",
            plate_no: showModal?.plate_no ?? "",
        });
    }, [showModal, reset, driverVehicleId, drivers, vehicles]);

    const driverSelectOptions = useMemo(() => {
        const base = driversList.map((d) => {
            const id = d.driver_id ?? d.transport_driver_id ?? d._id;
            return {
                value: String(id ?? ""),
                label: String(
                    d.driver_name ?? d.name ?? `Driver ${d.driver_id ?? d._id ?? ""}`,
                ),
            };
        }).filter((o) => o.value !== "");

        if (!isEdit || typeof showModal !== "object") return base;

        const resolved = resolveDriverIdFromMasterList(showModal, driversList);
        const label = showModal?.driver_name;
        if (resolved && label && !base.some((o) => o.value === String(resolved))) {
            return [{ value: String(resolved), label: String(label) }, ...base];
        }
        return base;
    }, [driversList, isEdit, showModal]);

    const vehicleSelectOptions = useMemo(() => {
        const base = vehiclesList.map((v) => {
            const id = v.vehicle_type_id ?? v._id;
            return {
                value: String(id ?? ""),
                label: String(
                    v.vehicle_type ?? v.name ?? `Vehicle ${v.vehicle_type_id ?? v._id ?? ""}`,
                ),
            };
        }).filter((o) => o.value !== "");

        if (!isEdit || typeof showModal !== "object") return base;

        const resolved = resolveVehicleTypeIdFromMasterList(showModal, vehiclesList);
        const label = showModal?.vehicle_type ?? showModal?.vehicle_type_name;
        if (resolved && label && !base.some((o) => o.value === String(resolved))) {
            return [{ value: String(resolved), label: String(label) }, ...base];
        }
        return base;
    }, [vehiclesList, isEdit, showModal]);

    const onSubmit = async (data) => {
        const driver_id = data.driver_id;
        const vehicle_type_id = data.vehicle_type_id;
        const plate_no = data.plate_no?.trim() ?? "";
        const cb = () => {
            closeModal();
            onSuccess?.();
        };
        if (isEdit) {
            await updateDriverVehicleMapping({
                formData: {
                    driver_vehicle_id: driverVehicleId,
                    driver_id,
                    vehicle_type_id,
                    plate_no,
                },
                cb,
            });
        } else {
            await addDriverVehicleMapping({
                formData: { driver_id, vehicle_type_id, plate_no },
                cb,
            });
        }
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {isEdit ? "Edit Driver Vehicle Mapping" : "Add Driver Vehicle Mapping"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="driverVehicleMappingForm" onSubmit={handleSubmit(onSubmit)}>

                    {/* DRIVER SELECT */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-field">
                            <div className="phone-wrapper">
                                <label className="phone-label">
                                    Driver <span className="text-danger">*</span>
                                </label>
                                <Controller
                                    name="driver_id"
                                    control={control}
                                    rules={{ required: "Driver is required" }}
                                    render={({ field }) => (
                                        <PremiumSelect
                                            value={field.value != null ? String(field.value) : ""}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            options={driverSelectOptions}
                                            placeholder="Select Driver"
                                            searchPlaceholder="Search driver..."
                                            hasError={Boolean(errors.driver_id)}
                                        />
                                    )}
                                />
                            </div>
                            {errors.driver_id && (
                                <span className="field-error">{errors.driver_id.message}</span>
                            )}
                        </div>
                    </div>

                    {/* VEHICLE SELECT */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-field">
                            <div className="phone-wrapper">
                                <label className="phone-label">
                                    Vehicle <span className="text-danger">*</span>
                                </label>
                                <Controller
                                    name="vehicle_type_id"
                                    control={control}
                                    rules={{ required: "Vehicle is required" }}
                                    render={({ field }) => (
                                        <PremiumSelect
                                            value={field.value != null ? String(field.value) : ""}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            options={vehicleSelectOptions}
                                            placeholder="Select Vehicle"
                                            searchPlaceholder="Search vehicle..."
                                            hasError={Boolean(errors.vehicle_type_id)}
                                        />
                                    )}
                                />
                            </div>
                            {errors.vehicle_type_id && (
                                <span className="field-error">{errors.vehicle_type_id.message}</span>
                            )}
                        </div>
                    </div>

                    {/* PLATE NO */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="form-field">
                            <div className="form-floating desig-inp">
                                <input
                                    type="text"
                                    className={`form-control ${errors.plate_no ? "is-invalid" : ""}`}
                                    placeholder=" "
                                    {...register("plate_no", { required: "Plate number is required" })}
                                />
                                <label>
                                    Plate No <span className="text-danger">*</span>
                                </label>
                            </div>
                            {errors.plate_no && (
                                <span className="field-error">{errors.plate_no.message}</span>
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
            <button type="submit" form="driverVehicleMappingForm" className="btn btn-primary" disabled={isBeingUpdated}>
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="fade role-modal-sm modal show"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
