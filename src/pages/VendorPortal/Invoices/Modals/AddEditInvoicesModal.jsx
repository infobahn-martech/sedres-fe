import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import CustomModal from "../../../../components/CustomModal";
import "../../../../design/scss/prospect-modal.scss";
import "../../../../design/scss/modal-designs.scss";
import "../../../../design/scss/form-designs.scss";

export function AddEditInvoicesModal({
    showModal,
    closeModal,
    selectedData,
    onSuccess,
    isBeingUpdated = false,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm({
        defaultValues: {
            woNo: "",
            poNo: "",
            taxInvoiceFile: null,
        },
    });

    useEffect(() => {
        if (selectedData?._id) {
            reset({
                woNo: selectedData.woNo || "",
                poNo: selectedData.poNo || "",
                taxInvoiceFile: null,
            });
        } else {
            reset({
                woNo: "",
                poNo: "",
                taxInvoiceFile: null,
            });
        }
    }, [selectedData, reset]);

    const onSubmit = (data) => {
        const file = data.taxInvoiceFile?.[0] || null;

        onSuccess?.({
            woNo: data.woNo,
            poNo: data.poNo,
            taxInvoiceFile: file,
            taxInvoiceFileName: file?.name || selectedData?.taxInvoiceFileName || "",
        });
    };

    const renderHeader = () => (
        <h1 className="modal-title">
            {selectedData?._id ? "Upload Invoice" : "Upload Invoice"}
        </h1>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="invoiceForm" onSubmit={handleSubmit(onSubmit)}>
                    <div className="row">
                        <div className="col-md-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.woNo ? "is-invalid" : ""}`}
                                        placeholder="WO No"
                                        {...register("woNo", {
                                            required: "Work Order number is required",
                                        })}
                                    />
                                    <label>
                                        Work Order (WO) Number <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.woNo && (
                                    <span className="field-error">{errors.woNo.message}</span>
                                )}
                            </div>
                        </div>

                        <div className="col-md-6 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.poNo ? "is-invalid" : ""}`}
                                        placeholder="PO No"
                                        {...register("poNo", {
                                            required: "Purchase Order number is required",
                                        })}
                                    />
                                    <label>
                                        Purchase Order (PO) Number <span className="text-danger">*</span>
                                    </label>
                                </div>
                                {errors.poNo && (
                                    <span className="field-error">{errors.poNo.message}</span>
                                )}
                            </div>
                        </div>

                        <div className="col-md-12 mb-lg-3 mb-sm-0">
                            <div className="form-field">
                                <div className="desig-inp">
                                    <label className="form-label mb-2">
                                        Tax Invoice Attachment <span className="text-danger">*</span>
                                    </label>
                                    <Controller
                                    name="taxInvoiceFile"
                                    control={control}
                                    rules={{
                                        validate: {
                                            required: (files) => {
                                                if (selectedData?._id && selectedData?.taxInvoiceFileName)
                                                    return true;
                                                return (
                                                    (files?.length > 0 && files[0]) ||
                                                    "Tax Invoice attachment is required"
                                                );
                                            },
                                            fileType: (files) => {
                                                if (!files || files.length === 0 || !files[0])
                                                    return true;
                                                const file = files[0];
                                                const allowedTypes = [
                                                    "application/pdf",
                                                    "image/jpeg",
                                                    "image/jpg",
                                                ];
                                                return (
                                                    allowedTypes.includes(file.type) ||
                                                    "Only PDF or JPG files are allowed"
                                                );
                                            },
                                        },
                                    }}
                                    render={({ field: { onChange, value } }) => {
                                        const fileList = value && (Array.isArray(value) ? value : [value]);
                                        const file = fileList?.[0] || (value instanceof File ? value : null);

                                        const handleDragOver = (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragging(true);
                                        };
                                        const handleDragLeave = (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragging(false);
                                        };
                                        const handleDrop = (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragging(false);
                                            const dropped = e.dataTransfer?.files;
                                            if (dropped?.length) onChange(Array.from(dropped));
                                        };
                                        const handleChange = (e) => {
                                            const chosen = e.target?.files;
                                            if (chosen?.length) onChange(Array.from(chosen));
                                        };
                                        const clearFile = () => onChange(null);

                                        return (
                                            <div className="file-drop-zone-wrapper">
                                                <div
                                                    className={`file-drop-zone ${isDragging ? "file-drop-zone--active" : ""} ${errors.taxInvoiceFile ? "file-drop-zone--error" : ""}`}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    onClick={() => document.getElementById("tax-invoice-input").click()}
                                                >
                                                    <input
                                                        id="tax-invoice-input"
                                                        type="file"
                                                        className="d-none"
                                                        accept=".pdf,.jpg,.jpeg,.jpe"
                                                        onChange={handleChange}
                                                    />
                                                    {file ? (
                                                        <div className="file-drop-zone__selected">
                                                            <span className="file-drop-zone__icon">✓</span>
                                                            <span className="file-drop-zone__name">{file.name}</span>
                                                            <button
                                                                type="button"
                                                                className="file-drop-zone__clear"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    clearFile();
                                                                    const input = document.getElementById("tax-invoice-input");
                                                                    if (input) input.value = "";
                                                                }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="file-drop-zone__icon">📎</span>
                                                            <span className="file-drop-zone__text">
                                                                {isDragging
                                                                    ? "Drop your file here"
                                                                    : "Drag and drop your file here"}
                                                            </span>
                                                            <span className="file-drop-zone__hint">or click to browse</span>
                                                            <span className="file-drop-zone__formats">PDF, JPG, JPEG</span>
                                                        </>
                                                    )}
                                                </div>
                                                {selectedData?.taxInvoiceFileName && !file && (
                                                    <small className="d-block mt-2 text-muted">
                                                        Current file: {selectedData.taxInvoiceFileName}
                                                    </small>
                                                )}
                                            </div>
                                        );
                                    }}
                                />
                                </div>
                                {errors.taxInvoiceFile && (
                                    <span className="field-error">
                                        {errors.taxInvoiceFile.message}
                                    </span>
                                )}
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
                form="invoiceForm"
                className="btn btn-primary"
                disabled={isBeingUpdated}
            >
                {isBeingUpdated ? "Saving..." : "Save"}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="invoice-modal-sm"
            dialgName="modal-dialog modal-dialog-centered modal-lg"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}