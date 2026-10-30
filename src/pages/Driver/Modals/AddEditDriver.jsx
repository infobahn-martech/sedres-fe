import { useForm, Controller, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import PhoneInput from "react-phone-input-2";
import { FiUploadCloud, FiFileText, FiX } from "react-icons/fi";
import "react-phone-input-2/lib/bootstrap.css";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import useDriverReducer from "../../../store/DriverReducer";
import usePortReducer from "../../../store/PortReducer";
import DatePickerField from "../../KanbanBoard/CardFormTabs/shared/components/DatePickerField";
import PremiumSelect from "../../../components/form/PremiumSelect";
import userIcon from "../../../assets/images/DummyProPic.avif";
import edit from "../../../assets/images/edit.svg";

// Two fields per row, matching the Add/Edit User modal.
const FIELD_COL = "col-lg-6 col-sm-12";

const ZAWIL_ACCEPT = ".pdf,.jpg,.jpeg,.png";

const fileNameFromUrl = (url) => decodeURIComponent(String(url).split("?")[0].split("/").pop() || url);

function parseList(value) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return [];
    }
}

/**
 * Per-port Zawil Pass state keyed by port_id: { expiry_date, file (new File), existing ({ file_name, file_url }) }.
 * API may return zawil_passes as a JSON string or an array of { port_id, expiry_date, file_url | zawil_pass }.
 */
function normalizeZawilPasses(value) {
    const list = parseList(value);
    if (!Array.isArray(list)) return {};
    return list.reduce((acc, entry) => {
        if (entry?.port_id == null) return acc;
        const url = entry.file_url ?? entry.zawil_pass ?? entry.file ?? "";
        acc[String(entry.port_id)] = {
            expiry_date: entry.expiry_date || "",
            file: null,
            existing: url ? { file_name: entry.file_name || fileNameFromUrl(url), file_url: url } : null,
        };
        return acc;
    }, {});
}

const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Request shape: `data` (JSON string) + `zawil_pass_files[<port_id>]` per uploaded pass + optional `profileimg`. */
function buildRequestBody(payload, zawilByPort, portIds, profileImage) {
    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));
    portIds.forEach((portId) => {
        const file = zawilByPort[portId]?.file;
        if (file) formData.append(`zawil_pass_files[${portId}]`, file);
    });
    if (profileImage) formData.append("profileimg", profileImage);
    return formData;
}

const EMPTY_FORM = {
    driver_name: "",
    employee_no: "",
    joining_date: "",
    contact_no: "",
    email: "",
    iqama_no: "",
    location: "",
    port_id: [],
    nationality: "",
};

/** `type` "transport" has per-port Zawil Passes and a profile photo (multipart); "material" is plain JSON. */
export function DriverModal({ showModal, closeModal, onSuccess, type = "transport" }) {
    const isEdit = !!showModal?.driver_id;
    const editId = showModal?.driver_id;
    const isTransport = type === "transport";

    const [zawilByPort, setZawilByPort] = useState({});
    const [draggingPortId, setDraggingPortId] = useState(null);
    const [profileImage, setProfileImage] = useState(null);
    const [profileImagePreview, setProfileImagePreview] = useState(userIcon);

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
    } = useForm({ defaultValues: EMPTY_FORM });

    const selectedPortIds = useWatch({ control, name: "port_id" }) || [];

    const {
        countries,
        fetchAllCountries,
        fetchDriverDetail,
        addDriver,
        updateDriver,
        isBeingUpdated,
        isLoadingCountries,
        isLoadingDetail,
    } = useDriverReducer();
    const { ports, getPorts, isLoading: isLoadingPorts } = usePortReducer((s) => s);

    // Edit loads the driver from its detail API (full zawil_passes list); null until it loads.
    const [driver, setDriver] = useState(null);

    useEffect(() => {
        if (showModal) {
            fetchAllCountries();
            getPorts({ params: { limit: 1000 } });
        }
    }, [showModal]);

    useEffect(() => {
        setDriver(null);
        if (!editId) return;
        let cancelled = false;
        fetchDriverDetail(editId, type).then((detail) => {
            if (!cancelled) setDriver(detail);
        });
        return () => {
            cancelled = true;
        };
    }, [editId, type, fetchDriverDetail]);

    useEffect(() => {
        if (!showModal) return;
        setProfileImage(null);
        setProfileImagePreview((isEdit && (driver?.avatar_path || driver?.profileimg)) || userIcon);
        setZawilByPort(isEdit ? normalizeZawilPasses(driver?.zawil_passes) : {});
    }, [showModal, isEdit, driver]);

    useEffect(() => {
        if (showModal && isEdit && driver && !isLoadingCountries && countries) {
            reset({
                driver_name: driver.driver_name || "",
                employee_no: driver.employee_no || "",
                joining_date: driver.joining_date || "",
                contact_no: driver.contact_no || "",
                email: driver.email || "",
                iqama_no: driver.iqama_no || "",
                location: driver.location || "",
                port_id: Array.isArray(driver.port_ids) ? driver.port_ids.map(String) : [],
                nationality: driver.nationality ?? "",
            });
        } else if (showModal && !isEdit) {
            reset(EMPTY_FORM);
        }
    }, [showModal, isEdit, driver, reset, isLoadingCountries, countries]);

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setProfileImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setProfileImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const updateZawil = (portId, changes) => {
        setZawilByPort((prev) => ({
            ...prev,
            [portId]: { expiry_date: "", file: null, existing: null, ...prev[portId], ...changes },
        }));
    };

    // One pass file per port; a new file replaces the uploaded one.
    const setZawilFile = (portId, fileList) => {
        const file = fileList?.[0];
        if (file) updateZawil(portId, { file });
    };

    const onSubmit = (data) => {
        const portIds = (data.port_id || []).map(String);
        const payload = {
            ...(isEdit && { driver_id: editId }),
            driver_name: data.driver_name,
            iqama_no: data.iqama_no,
            nationality: data.nationality ? Number(data.nationality) : null,
            contact_no: data.contact_no,
            email: data.email,
            employee_no: data.employee_no,
            location: data.location,
            joining_date: data.joining_date,
            port_ids: portIds.map(Number),
            ...(isTransport && {
                zawil_passes: portIds
                    .filter((portId) => zawilByPort[portId]?.expiry_date)
                    .map((portId) => ({ port_id: Number(portId), expiry_date: zawilByPort[portId].expiry_date })),
            }),
        };
        const cb = () => {
            closeModal();
            onSuccess?.();
        };
        const formData = isTransport ? buildRequestBody(payload, zawilByPort, portIds, profileImage) : payload;
        if (isEdit) {
            updateDriver({ formData, cb, type });
        } else {
            addDriver({ formData, cb, type });
        }
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {isEdit ? "Edit Driver" : "Add Driver"}
        </h1>
    );

    const portName = (portId) => {
        const port = (ports || []).find((p) => String(p.port_id) === String(portId));
        return String(port?.port_name ?? port?.port ?? portId);
    };

    const renderZawilFile = (portId, zawil) => {
        if (zawil?.file) {
            return (
                <div className="driver-file-list__item">
                    <FiFileText className="driver-file-list__icon" />
                    <span className="driver-file-list__name">{zawil.file.name}</span>
                    <span className="driver-file-list__meta">{formatFileSize(zawil.file.size)}</span>
                    <button
                        type="button"
                        className="driver-file-list__remove"
                        aria-label={`Remove ${zawil.file.name}`}
                        onClick={() => updateZawil(portId, { file: null })}
                    >
                        <FiX />
                    </button>
                </div>
            );
        }
        const inputId = `zawilPassFile_${portId}`;
        return (
            <label
                htmlFor={inputId}
                className={`file-drop-zone driver-drop-zone mb-0 ${draggingPortId === portId ? "file-drop-zone--active" : ""}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingPortId(portId);
                }}
                onDragLeave={() => setDraggingPortId(null)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDraggingPortId(null);
                    setZawilFile(portId, e.dataTransfer.files);
                }}
            >
                <FiUploadCloud className="file-drop-zone__icon" />
                <span className="file-drop-zone__text">
                    {zawil?.existing ? "Replace file" : "Drag & drop, or"}{" "}
                    <span className="driver-drop-zone__browse">browse</span>
                </span>
                <span className="file-drop-zone__formats">PDF, JPG, PNG</span>
                <input
                    id={inputId}
                    type="file"
                    accept={ZAWIL_ACCEPT}
                    hidden
                    onChange={(e) => {
                        setZawilFile(portId, e.target.files);
                        // Reset so picking the same file again after removing it still fires onChange.
                        e.target.value = "";
                    }}
                />
            </label>
        );
    };

    const renderZawilPasses = () => (
        <div className="form-field">
            <div className="driver-notched driver-zawil">
                <label className="phone-label">Zawil Pass</label>
                {selectedPortIds.length === 0 ? (
                    <p className="driver-zawil__empty">Select a port to add its Zawil Pass.</p>
                ) : (
                    selectedPortIds.map((portId) => {
                        const zawil = zawilByPort[portId];
                        return (
                            <div key={portId} className="driver-zawil__row">
                                <span className="driver-zawil__port">{portName(portId)}</span>
                                <div className="form-floating desig-inp add-edit-modal-date-field driver-zawil__expiry">
                                    <DatePickerField
                                        dateValue={zawil?.expiry_date || ""}
                                        dateFieldName={`zawil_expiry_${portId}`}
                                        onDateChange={(event) => updateZawil(portId, { expiry_date: event.target.value })}
                                        placeholder=""
                                        className="add-edit-modal-date-picker"
                                        slotProps={{
                                            textField: {
                                                variant: "outlined",
                                                size: "small",
                                            },
                                        }}
                                    />
                                    <label>Expiry Date</label>
                                </div>
                                <div className="driver-zawil__file">
                                    {renderZawilFile(portId, zawil)}
                                    {zawil?.existing && !zawil?.file && (
                                        <a
                                            href={zawil.existing.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="driver-zawil__existing"
                                        >
                                            <FiFileText /> {zawil.existing.file_name}
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="driverForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* ===== Avatar Upload ===== */}
                    {isTransport && (
                        <div className="d-flex justify-content-center mb-3">
                            <div className="avatar-outer">
                                <div className="avatar-wrapper">
                                    <img src={profileImagePreview} alt="Driver Avatar" className="avatar-image" />
                                </div>
                                <label htmlFor="driverAvatarUpload" className="avatar-edit-icon">
                                    <img src={edit} alt="Edit" className="avatar-edit-pencil" />
                                </label>
                                <input
                                    type="file"
                                    id="driverAvatarUpload"
                                    className="d-none"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>
                    )}

                    <div className="permInputs row">
                        {/* EMPLOYEE NO */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.employee_no ? "is-invalid" : ""}`}
                                        placeholder="Employee No"
                                        {...register("employee_no")}
                                    />
                                    <label>Employee No</label>
                                </div>
                                {errors.employee_no && (
                                    <span className="field-error">{errors.employee_no.message}</span>
                                )}
                            </div>
                        </div>

                        {/* DRIVER NAME */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.driver_name ? "is-invalid" : ""}`}
                                        placeholder="Driver Name"
                                        {...register("driver_name", {
                                            required: "Driver name is required",
                                            pattern: {
                                                value: /^[A-Za-z\s]+$/,
                                                message: "Driver name cannot contain numbers or special characters",
                                            },
                                            onChange: (e) => {
                                                e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                                            },
                                        })}
                                    />
                                    <label>
                                        Driver Name <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.driver_name && (
                                    <span className="field-error">{errors.driver_name.message}</span>
                                )}
                            </div>
                        </div>

                        {/* IQAMA NO */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.iqama_no ? "is-invalid" : ""}`}
                                        placeholder="Iqama No"
                                        {...register("iqama_no", {
                                            required: "Iqama number is required",
                                        })}
                                    />
                                    <label>
                                        Iqama No <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.iqama_no && (
                                    <span className="field-error">{errors.iqama_no.message}</span>
                                )}
                            </div>
                        </div>

                        {/* NATIONALITY (from all_country API) */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Nationality <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="nationality"
                                        control={control}
                                        rules={{ required: "Nationality is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={(countries || []).map((c) => ({
                                                    value: String(c.country_id ?? ""),
                                                    label: String(
                                                        c.country || c.country_code || c.country_id || "",
                                                    ),
                                                }))}
                                                placeholder={
                                                    isLoadingCountries || countries === null
                                                        ? "Loading..."
                                                        : "Select Nationality"
                                                }
                                                searchPlaceholder="Search nationality..."
                                                disabled={isLoadingCountries || countries === null}
                                                hasError={Boolean(errors.nationality)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.nationality && (
                                    <span className="field-error">{errors.nationality.message}</span>
                                )}
                            </div>
                        </div>

                        {/* JOINING DATE */}
                        <div className={FIELD_COL}>
                            <Controller
                                name="joining_date"
                                control={control}
                                render={({ field }) => (
                                    <div className="form-field">
                                        <div className="form-floating desig-inp add-edit-modal-date-field">
                                            <DatePickerField
                                                dateValue={field.value || ""}
                                                dateFieldName={field.name}
                                                onDateChange={(event) => field.onChange(event.target.value)}
                                                hasError={Boolean(errors?.joining_date)}
                                                placeholder=""
                                                className="add-edit-modal-date-picker"
                                                slotProps={{
                                                    textField: {
                                                        variant: "outlined",
                                                        size: "small",
                                                    },
                                                }}
                                            />
                                            <label>Joining Date</label>
                                        </div>
                                        {errors?.joining_date ? (
                                            <span className="field-error">{errors.joining_date.message}</span>
                                        ) : null}
                                    </div>
                                )}
                            />
                        </div>

                        {/* CONTACT NO (PhoneInput) */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Contact No <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="contact_no"
                                        control={control}
                                        rules={{
                                            validate: (value) => {
                                                // PhoneInput keeps the dial code (e.g. "966") when the number is cleared.
                                                const digits = (value || "").replace(/\D/g, "");
                                                if (digits.length <= 4) return "Contact number is required";
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
                                    <span className="field-error">{errors.contact_no.message}</span>
                                )}
                            </div>
                        </div>

                        {/* EMAIL */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="email"
                                        className={`form-control ${errors.email ? "is-invalid" : ""}`}
                                        placeholder="Email"
                                        {...register("email", {
                                            pattern: {
                                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                message: "Enter a valid email address",
                                            },
                                        })}
                                    />
                                    <label>Email</label>
                                </div>
                                {errors.email && (
                                    <span className="field-error">{errors.email.message}</span>
                                )}
                            </div>
                        </div>

                        {/* PORT */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Port</label>
                                    <Controller
                                        name="port_id"
                                        control={control}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                isMulti
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={(ports || []).map((p) => ({
                                                    value: String(p.port_id ?? ""),
                                                    label: String(p.port_name ?? p.port ?? p.port_id ?? ""),
                                                }))}
                                                placeholder={
                                                    isLoadingPorts || ports === null
                                                        ? "Loading..."
                                                        : "Select Port"
                                                }
                                                searchPlaceholder="Search port..."
                                                disabled={isLoadingPorts || ports === null}
                                                hasError={Boolean(errors.port_id)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.port_id && (
                                    <span className="field-error">{errors.port_id.message}</span>
                                )}
                            </div>
                        </div>

                        {/* LOCATION */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        type="text"
                                        className={`form-control ${errors.location ? "is-invalid" : ""}`}
                                        placeholder="Location"
                                        {...register("location")}
                                    />
                                    <label>Location</label>
                                </div>
                            </div>
                        </div>

                        {/* ZAWIL PASS (one expiry date + file per selected port) */}
                        {isTransport && <div className="col-12">{renderZawilPasses()}</div>}
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
            <button
                type="submit"
                form="driverForm"
                className="btn btn-primary"
                disabled={isBeingUpdated || (isEdit && !driver)}
            >
                {isBeingUpdated ? "Saving..." : isEdit && isLoadingDetail ? "Loading..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="user-modal-sm driver-modal"
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
