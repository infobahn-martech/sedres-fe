import { useForm, Controller } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import CustomModal from "../../../components/CustomModal";
import useHotelReducer from "../../../store/HotelReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";

export function HotelModal({ showModal, closeModal, onSuccess }) {
    const { addHotel, updateHotel, isBeingUpdated } = useHotelReducer(
        (state) => state
    );
    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
    } = useForm({
        defaultValues: showModal?.hotel_id
            ? {
                hotel_name: showModal?.hotel_name || "",
                contact_name: showModal?.contact_name || "",
                contact_no: showModal?.contact_no || "",
                contact_email: showModal?.contact_email || "", // ✅ single email
                hotel_address: showModal?.hotel_address || "",
            }
            : {
                hotel_name: "",
                contact_name: "",
                contact_no: "",
                contact_email: "", // ✅ single email
                hotel_address: "",
            },
    });

    const onSubmit = (data) => {
        const payload = {
            hotel_name: data.hotel_name,
            contact_name: data.contact_name,
            contact_no: data.contact_no,
            contact_email: data.contact_email?.trim(), // ✅ single email string
            hotel_address: data.hotel_address,
        };

        const isEdit = !!showModal?.hotel_id;

        if (isEdit) {
            updateHotel({
                formData: { ...payload, hotel_id: showModal.hotel_id },
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        } else {
            addHotel({
                formData: payload,
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
        }
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">{showModal?.hotel_id ? "Edit Hotel" : "Add Hotel"}</h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="hotelForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* ===== Hotel Name + Contact Name ===== */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            {/* HOTEL NAME */}
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="text"
                                            className={`form-control ${errors.hotel_name ? "is-invalid" : ""}`}
                                            placeholder="Hotel Name"
                                            {...register("hotel_name", {
                                                required: "Hotel name is required",
                                            })}
                                        />
                                        <label>
                                            Hotel Name <span className="text-danger">*</span>
                                        </label>
                                    </div>
                                    {errors.hotel_name && (
                                        <span className="field-error">
                                            {errors.hotel_name.message}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* CONTACT NAME */}
                            <div className="col-lg-6 col-sm-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="text"
                                            className={`form-control ${errors.contact_name ? "is-invalid" : ""}`}
                                            placeholder="Contact Name"
                                            {...register("contact_name", {
                                                required: "Contact name is required",
                                                pattern: {
                                                    value: /^[A-Za-z\s]+$/,
                                                    message: "Contact name cannot contain numbers or special characters",
                                                },
                                                onChange: (e) => {
                                                    e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                                                },
                                            })}
                                        />
                                        <label>
                                            Contact Name <span className="text-danger">*</span>
                                        </label>
                                    </div>
                                    {errors.contact_name && (
                                        <span className="field-error">
                                            {errors.contact_name.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== Contact No ===== */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-12">
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

                    {/* ===== Contact Email (Single) ===== */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="email"
                                            className={`form-control ${errors.contact_email ? "is-invalid" : ""
                                                }`}
                                            placeholder="email@example.com"
                                            {...register("contact_email", {
                                                required: "Email is required",
                                                pattern: {
                                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                    message: "Enter a valid email address",
                                                },
                                            })}
                                        />
                                        <label>
                                            Email <span className="text-danger">*</span>
                                        </label>
                                    </div>

                                    {errors.contact_email && (
                                        <span className="field-error">
                                            {errors.contact_email.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== Hotel Address (Full Row) ===== */}
                    <div className="mb-lg-3 mb-sm-0">
                        <div className="permInputs row">
                            <div className="col-12">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <textarea
                                            className={`form-control ${errors.hotel_address ? "is-invalid" : ""
                                                }`}
                                            placeholder="Hotel Address"
                                            style={{ minHeight: "80px" }}
                                            {...register("hotel_address", {
                                                required: "Hotel address is required",
                                            })}
                                        />
                                        <label>
                                            Hotel Address <span className="text-danger">*</span>
                                        </label>
                                    </div>
                                    {errors.hotel_address && (
                                        <span className="field-error">
                                            {errors.hotel_address.message}
                                        </span>
                                    )}
                                </div>
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
                form="hotelForm"
                className="btn btn-primary"
                disabled={isBeingUpdated}
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