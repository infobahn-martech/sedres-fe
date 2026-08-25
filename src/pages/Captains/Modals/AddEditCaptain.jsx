import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import CustomModal from "../../../components/CustomModal";
import DatePickerField from "../../KanbanBoard/CardFormTabs/shared/components/DatePickerField";
import useCaptainReducer from "../../../store/CaptainReducer";
import fleetService from "../../../services/fleetService";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/captain-modal.scss";
import PremiumSelect from "../../../components/form/PremiumSelect";

export function CaptainModal({ showModal, closeModal, onSuccess }) {
    const {
        addCaptain,
        updateCaptain,
        getCaptainById,
        captainDetail,
        isBeingUpdated,
        isDetailLoading,
        clearCaptainDetail,
    } = useCaptainReducer((state) => state);

    const isEdit = !!showModal?.taxiboat_captain_id;
    const captainId = showModal?.taxiboat_captain_id;

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
    } = useForm({
        defaultValues: {
            captain_name: "",
            taxi_boat_id: "",
            contact_no: "",
            license_no: "",
            license_expiry: "",
        },
    });

    const [taxiBoatList, setTaxiBoatList] = useState([]);

    useEffect(() => {
        const fetchTaxiBoats = async () => {
            try {
                const { data } = await fleetService.getAllFleet({
                    limit: 1000,
                    page: 1,
                });
                setTaxiBoatList(data?.data ?? []);
            } catch {
                setTaxiBoatList([]);
            }
        };
        if (showModal) fetchTaxiBoats();
    }, [!!showModal]);

    useEffect(() => {
        if (isEdit && captainId) {
            getCaptainById(captainId);
        } else {
            clearCaptainDetail?.();
            reset({
                captain_name: "",
                taxi_boat_id: "",
                contact_no: "",
                license_no: "",
                license_expiry: "",
            });
        }
    }, [isEdit, captainId, getCaptainById, clearCaptainDetail, reset]);

    useEffect(() => {
        if (captainDetail && isEdit) {
            reset({
                captain_name: captainDetail?.captain_name ?? "",
                taxi_boat_id: captainDetail?.taxi_boat_id ?? "",
                contact_no: captainDetail?.contact_no ?? "",
                license_no: captainDetail?.license_no ?? "",
                license_expiry: captainDetail?.license_expiry
                    ? captainDetail.license_expiry.split("T")[0]
                    : "",
            });
        }
    }, [captainDetail, isEdit, reset]);

    const onSubmit = (data) => {
        const payload = {
            captain_name: data.captain_name,
            taxi_boat_id: Number(data.taxi_boat_id),
            contact_no: data.contact_no,
            license_no: data.license_no || null,
            license_expiry: data.license_expiry || null,
        };

        if (isEdit) {
            updateCaptain({
                formData: {
                    ...payload,
                    taxiboat_captain_id: captainId,
                },
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        } else {
            addCaptain({
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
            {isEdit ? "Edit Captain" : "Add Captain"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body captain-modal">
            <div className="lead-form">
                <form id="captainForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* <div className="d-flex justify-content-center mb-4">
                        <img
                            src={userIcon}
                            alt="User"
                            style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "3px solid #e6e6e6",
                            }}
                        />
                    </div> */}

                    {/* Captain Name */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="text"
                                            className={`form-control ${errors.captain_name ? "is-invalid" : ""}`}
                                            placeholder="Captain Name"
                                            {...register("captain_name", {
                                                required: "Captain name is required",
                                                pattern: {
                                                    value: /^[A-Za-z\s]+$/,
                                                    message: "Captain name cannot contain numbers or special characters",
                                                },
                                                onChange: (e) => {
                                                    e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                                                },
                                            })}
                                        />
                                        <label>
                                            Captain Name <span className="text-danger">*</span>
                                        </label>
                                    </div>
                                    {errors.captain_name && (
                                        <span className="field-error">{errors.captain_name.message}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Taxi Boat + Contact No */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-field">
                                    <div className="phone-wrapper">
                                        <label className="phone-label">
                                            Taxi Boat <span className="text-danger">*</span>
                                        </label>
                                        <Controller
                                            name="taxi_boat_id"
                                            control={control}
                                            rules={{ required: "Taxi boat is required" }}
                                            render={({ field }) => (
                                                <PremiumSelect
                                                    value={field.value != null ? String(field.value) : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    options={taxiBoatList.map((boat) => ({
                                                        value: String(boat.taxi_boat_id ?? ""),
                                                        label: String(boat.taxi_boat_name ?? ""),
                                                    }))}
                                                    placeholder="Select Taxi Boat"
                                                    searchPlaceholder="Search taxi boat..."
                                                    hasError={Boolean(errors.taxi_boat_id)}
                                                />
                                            )}
                                        />
                                    </div>
                                    {errors.taxi_boat_id && (
                                        <span className="field-error">{errors.taxi_boat_id.message}</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-field">
                                    <div className="phone-wrapper">
                                        <label className="phone-label">
                                            Contact No
                                        </label>
                                        <Controller
                                            name="contact_no"
                                            control={control}
                                            rules={{
                                                validate: (value) => {
                                                    if (!value) return true;
                                                    const digits = (value || "").replace(/\D/g, "");
                                                    return digits.length >= 7 || "Enter a valid phone number";
                                                },
                                            }}
                                            render={({ field }) => (
                                                <PhoneInput
                                                    {...field}
                                                    country="sa"
                                                    enableSearch
                                                    inputClass="phone-input"
                                                    buttonClass="phone-flag"
                                                />
                                            )}
                                        />
                                    </div>
                                    {errors.contact_no && (
                                        <span className="field-error">
                                            {errors.contact_no.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* License No + License Expiry */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="License No"
                                            {...register("license_no")}
                                        />
                                        <label>License No</label>
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-6 col-sm-12">
                                <Controller
                                    name="license_expiry"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="form-field">
                                            <div className="form-floating desig-inp add-edit-modal-date-field">
                                                <DatePickerField
                                                    dateValue={field.value || ""}
                                                    dateFieldName={field.name}
                                                    onDateChange={(event) => field.onChange(event.target.value)}
                                                    hasError={Boolean(errors?.license_expiry)}
                                                    placeholder=""
                                                    className="add-edit-modal-date-picker"
                                                    slotProps={{
                                                        textField: {
                                                            variant: "outlined",
                                                            size: "small",
                                                        },
                                                    }}
                                                />
                                                <label>License Expiry</label>
                                            </div>
                                            {errors?.license_expiry ? (
                                                <span className="field-error">{errors.license_expiry.message}</span>
                                            ) : null}
                                        </div>
                                    )}
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
                form="captainForm"
                className="btn btn-primary"
                disabled={isBeingUpdated || (isEdit && isDetailLoading)}
            >
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="user-modal-sm"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
