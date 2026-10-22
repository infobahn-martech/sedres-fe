import { useForm, Controller } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
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

const DRIVER_FOR_OPTIONS = [
    { value: 1, label: "Transport" },
    { value: 2, label: "Material" },
];

// Two fields per row, matching the Add/Edit User modal.
const FIELD_COL = "col-lg-6 col-sm-12";

const ZAWIL_ACCEPT = ".pdf,.jpg,.jpeg,.png";

/** API may return driver_for as 1/2, "1"/"2", or "Transport" / "Material". */
function normalizeDriverFor(value) {
    if (value === 2 || value === "2") return 2;
    if (value === 1 || value === "1") return 1;
    if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (v === "material") return 2;
        if (v === "transport") return 1;
    }
    return 1;
}

const fileNameFromUrl = (url) => decodeURIComponent(String(url).split("?")[0].split("/").pop() || url);

/** API may return zawil_pass as a JSON string, URL strings, or { file_name, file_url } objects. */
function normalizeZawilFiles(value) {
    let list = value;
    if (typeof list === "string") {
        try {
            list = JSON.parse(list);
        } catch {
            list = list.split(",");
        }
    }
    if (!Array.isArray(list)) return [];
    return list
        .map((entry) => {
            if (typeof entry === "string") {
                const url = entry.trim();
                return url ? { file_name: fileNameFromUrl(url), file_url: url } : null;
            }
            const url = entry?.file_url ?? entry?.url ?? "";
            const name = entry?.file_name ?? entry?.name ?? (url ? fileNameFromUrl(url) : "");
            return name ? { file_name: name, file_url: url } : null;
        })
        .filter(Boolean);
}

const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Plain JSON unless new files are attached — keeps the existing request shape when nothing is uploaded. */
function buildRequestBody(payload, files, profileImage) {
    if (!files.length && !profileImage) return payload;
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => formData.append(`${key}[]`, item));
        } else {
            formData.append(key, value ?? "");
        }
    });
    files.forEach((file) => formData.append("zawil_pass[]", file));
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
    driver_for: 1,
};

export function DriverModal({ showModal, closeModal, onSuccess }) {
    const isEdit = !!showModal?.driver_id;
    const editId = showModal?.driver_id;

    const [zawilFiles, setZawilFiles] = useState([]);
    const [existingZawilFiles, setExistingZawilFiles] = useState([]);
    const [removedZawilFiles, setRemovedZawilFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [profileImagePreview, setProfileImagePreview] = useState(userIcon);
    const fileInputRef = useRef(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
        setValue,
    } = useForm({ defaultValues: EMPTY_FORM });

    const { countries, fetchAllCountries, addDriver, updateDriver, isBeingUpdated, isLoadingCountries } = useDriverReducer();
    const { ports, getPorts, isLoading: isLoadingPorts } = usePortReducer((s) => s);

    useEffect(() => {
        if (showModal) {
            fetchAllCountries();
            getPorts({ params: { limit: 1000 } });
        }
    }, [showModal]);

    useEffect(() => {
        if (!showModal) return;
        setZawilFiles([]);
        setRemovedZawilFiles([]);
        setProfileImage(null);
        setProfileImagePreview((isEdit && (showModal?.avatar_path || showModal?.profileimg)) || userIcon);
        setExistingZawilFiles(isEdit ? normalizeZawilFiles(showModal?.zawil_pass) : []);
    }, [showModal, isEdit]);

    useEffect(() => {
        if (showModal && isEdit && !isLoadingCountries && countries) {
            // Handle port_id: split comma-separated string or convert array
            let portIds = [];
            if (showModal?.port_ids && Array.isArray(showModal.port_ids)) {
                portIds = showModal.port_ids.map(String);
            } else if (showModal?.port_id) {
                if (typeof showModal.port_id === 'string') {
                    portIds = showModal.port_id.split(',').map(id => id.trim());
                } else {
                    portIds = [String(showModal.port_id)];
                }
            }

            reset({
                driver_name: showModal?.driver_name || "",
                employee_no: showModal?.employee_no || "",
                joining_date: showModal?.joining_date || "",
                contact_no: showModal?.contact_no || "",
                email: showModal?.email || "",
                iqama_no: showModal?.iqama_no || "",
                location: showModal?.location || "",
                port_id: portIds,
                nationality: showModal?.nationality ?? showModal?.country_id ?? "",
                driver_for: normalizeDriverFor(showModal?.driver_for),
            });
        } else if (showModal && !isEdit) {
            reset(EMPTY_FORM);
        }
    }, [showModal, isEdit, reset, isLoadingCountries, countries]);

    // Ensure driver_for syncs for edit (row may load before/after main reset; radios are controlled).
    useEffect(() => {
        if (!showModal || !isEdit || !showModal?.driver_id) return;
        setValue("driver_for", normalizeDriverFor(showModal.driver_for), {
            shouldValidate: false,
            shouldDirty: false,
        });
    }, [showModal?.driver_id, showModal?.driver_for, isEdit, setValue]);

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setProfileImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setProfileImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const addZawilFiles = (fileList) => {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;
        // Skip files already queued (same name + size) so a double drop doesn't duplicate them.
        setZawilFiles((prev) => [
            ...prev,
            ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size)),
        ]);
    };

    const handleFileInputChange = (e) => {
        addZawilFiles(e.target.files);
        // Reset so picking the same file again after removing it still fires onChange.
        e.target.value = "";
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        addZawilFiles(e.dataTransfer.files);
    };

    const removeNewZawilFile = (index) => {
        setZawilFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const removeExistingZawilFile = (file) => {
        setExistingZawilFiles((prev) => prev.filter((f) => f.file_name !== file.file_name));
        setRemovedZawilFiles((prev) => [...prev, file.file_name]);
    };

    const onSubmit = (data) => {
        const payload = {
            driver_name: data.driver_name,
            employee_no: data.employee_no,
            contact_no: data.contact_no,
            email: data.email,
            iqama_no: data.iqama_no,
            nationality: data.nationality,
            location: data.location,
            port_ids: (data.port_id || []).map(Number),
            joining_date: data.joining_date,
            driver_for: normalizeDriverFor(data.driver_for),
            ...(isEdit && { driver_id: editId, remove_files: removedZawilFiles }),
        };
        const cb = () => {
            closeModal();
            onSuccess?.();
        };
        const formData = buildRequestBody(payload, zawilFiles, profileImage);
        if (isEdit) {
            updateDriver({ formData, cb });
        } else {
            addDriver({ formData, cb });
        }
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {isEdit ? "Edit Driver" : "Add Driver"}
        </h1>
    );

    const renderZawilUpload = () => (
        <div className="form-field">
            <div className="driver-notched">
                <label className="phone-label">Zawil Pass</label>
                <div
                    role="button"
                    tabIndex={0}
                    className={`file-drop-zone driver-drop-zone ${isDragging ? "file-drop-zone--active" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <FiUploadCloud className="file-drop-zone__icon" />
                    <span className="file-drop-zone__text">
                        Drag & drop files, or <span className="driver-drop-zone__browse">browse</span>
                    </span>
                    <span className="file-drop-zone__formats">PDF, JPG, PNG · multiple allowed</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ZAWIL_ACCEPT}
                        hidden
                        onChange={handleFileInputChange}
                    />
                </div>
            </div>

            {(existingZawilFiles.length > 0 || zawilFiles.length > 0) && (
                <ul className="driver-file-list">
                    {existingZawilFiles.map((file) => (
                        <li key={`existing-${file.file_name}`} className="driver-file-list__item">
                            <FiFileText className="driver-file-list__icon" />
                            {file.file_url ? (
                                <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="driver-file-list__name"
                                >
                                    {file.file_name}
                                </a>
                            ) : (
                                <span className="driver-file-list__name">{file.file_name}</span>
                            )}
                            <span className="driver-file-list__meta">Uploaded</span>
                            <button
                                type="button"
                                className="driver-file-list__remove"
                                aria-label={`Remove ${file.file_name}`}
                                onClick={() => removeExistingZawilFile(file)}
                            >
                                <FiX />
                            </button>
                        </li>
                    ))}
                    {zawilFiles.map((file, index) => (
                        <li key={`new-${file.name}-${file.size}`} className="driver-file-list__item">
                            <FiFileText className="driver-file-list__icon" />
                            <span className="driver-file-list__name">{file.name}</span>
                            <span className="driver-file-list__meta">{formatFileSize(file.size)}</span>
                            <button
                                type="button"
                                className="driver-file-list__remove"
                                aria-label={`Remove ${file.name}`}
                                onClick={() => removeNewZawilFile(index)}
                            >
                                <FiX />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="driverForm" onSubmit={handleSubmit(onSubmit)}>
                    {/* ===== Avatar Upload ===== */}
                    <div className="d-flex justify-content-center mb-4">
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
                                    <label className="phone-label">Nationality</label>
                                    <Controller
                                        name="nationality"
                                        control={control}
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

                        {/* DRIVER FOR — Transport (1) / Material (2) */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Driver For <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="driver_for"
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                            <div className="driver-radio-box" role="radiogroup" aria-label="Driver For">
                                                {DRIVER_FOR_OPTIONS.map(({ value, label }) => (
                                                    <div key={value} className="form-check form-check-inline mb-0">
                                                        <input
                                                            className="form-check-input"
                                                            type="radio"
                                                            id={`driver_for_${value}`}
                                                            name={field.name}
                                                            checked={Number(field.value) === value}
                                                            onChange={() => field.onChange(value)}
                                                            onBlur={field.onBlur}
                                                        />
                                                        <label className="form-check-label" htmlFor={`driver_for_${value}`}>
                                                            {label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                </div>
                                {errors.driver_for && (
                                    <span className="field-error">Please select Driver For</span>
                                )}
                            </div>
                        </div>

                        {/* CONTACT NO (PhoneInput) */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Contact No</label>
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
                                {errors.email && (
                                    <span className="field-error">{errors.email.message}</span>
                                )}
                            </div>
                        </div>

                        {/* PORT */}
                        <div className={FIELD_COL}>
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">
                                        Port <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                        name="port_id"
                                        control={control}
                                        rules={{
                                            validate: (val) =>
                                                (Array.isArray(val) && val.length > 0) || "Port is required",
                                        }}
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

                        {/* ZAWIL PASS (multiple files) */}
                        <div className="col-12">{renderZawilUpload()}</div>
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
            <button type="submit" form="driverForm" className="btn btn-primary" disabled={isBeingUpdated}>
                {isBeingUpdated ? "Saving..." : "Save"}
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
