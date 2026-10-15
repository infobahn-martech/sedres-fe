import { useForm, Controller } from "react-hook-form";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CustomModal from "../../../components/CustomModal";
import PremiumSelect from "../../../components/form/PremiumSelect";
import SedresColorPicker from "../../../components/SedresColorPicker/SedresColorPicker";
import { DEFAULT_PICKER_COLOR, normalizeHexColor } from "../../../components/SedresColorPicker/sedresColorPickerConstants";
import useBillingEntityReducer from "../../../store/BillingEntityReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/billing-entity-modal.scss";
import userIcon from "../../../assets/images/DummyProPic.avif";
import edit from "../../../assets/images/edit.svg";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "Cash", label: "Cash" },
  { value: "Credit", label: "Credit" },
];

const COLOR_PICKER_PORTAL_Z = 10800;
const COLOR_PICKER_GAP = 8;
const VIEWPORT_MARGIN = 16;

const DEFAULT_VALUES = {
  billingEntityName: "",
  creditLimit: "",
  customerType: "",
  colorCode: DEFAULT_PICKER_COLOR,
};

export function BillingEntityModal({ showModal, closeModal, onSuccess }) {
  const isEdit = !!showModal?.entity_id;

  const { updateBillingEntityDetail, addEditLoader } = useBillingEntityReducer((s) => s);

  const [logoImage, setLogoImage] = useState(null);
  const [logoImagePreview, setLogoImagePreview] = useState(userIcon);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorPickerPlacement, setColorPickerPlacement] = useState({ top: 0, left: 0 });

  const colorTriggerRef = useRef(null);
  const colorPickerPopoverRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (isEdit) {
      reset({
        billingEntityName: showModal?.billing_entity ?? showModal?.billingEntityName ?? "",
        creditLimit: showModal?.credit_limit ?? showModal?.creditLimit ?? "",
        customerType: showModal?.customer_type ?? "",
        colorCode: normalizeHexColor(showModal?.color_code),
      });
      setLogoImagePreview(showModal?.entity_logo || showModal?.logo_path || userIcon);
    } else {
      reset(DEFAULT_VALUES);
      setLogoImagePreview(userIcon);
    }
    setLogoImage(null);
    setIsColorPickerOpen(false);
  }, [showModal, reset]);

  const closeColorPicker = useCallback(() => setIsColorPickerOpen(false), []);

  // Place the picker below the trigger; flip above when it doesn't fit, else clamp inside the viewport
  const positionColorPicker = useCallback(() => {
    const trigger = colorTriggerRef.current;
    const popover = colorPickerPopoverRef.current;
    if (!trigger || !popover) return;
    const r = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = popover;
    const spaceBelow = window.innerHeight - r.bottom - COLOR_PICKER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = r.top - COLOR_PICKER_GAP - VIEWPORT_MARGIN;

    let top;
    if (height <= spaceBelow) top = r.bottom + COLOR_PICKER_GAP;
    else if (height <= spaceAbove) top = r.top - COLOR_PICKER_GAP - height;
    else top = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);

    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(r.left, window.innerWidth - width - VIEWPORT_MARGIN)
    );
    setColorPickerPlacement({ top, left });
  }, []);

  // Measure before paint, and re-measure when the advanced palette changes the picker's height
  useLayoutEffect(() => {
    if (!isColorPickerOpen) return undefined;
    positionColorPicker();
    const observer = new ResizeObserver(positionColorPicker);
    if (colorPickerPopoverRef.current) observer.observe(colorPickerPopoverRef.current);
    window.addEventListener("resize", positionColorPicker);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionColorPicker);
    };
  }, [isColorPickerOpen, positionColorPicker]);

  // Close the picker on outside click (trigger + popover count as inside)
  useEffect(() => {
    if (!isColorPickerOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (colorTriggerRef.current?.contains(t)) return;
      if (colorPickerPopoverRef.current?.contains(t)) return;
      closeColorPicker();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isColorPickerOpen, closeColorPicker]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    if (isEdit) {
      await updateBillingEntityDetail({
        entityId: showModal.entity_id,
        creditLimit: data.creditLimit,
        customerType: data.customerType,
        colorCode: data.colorCode,
        logoFile: logoImage || null,
        cb: () => {
          onSuccess?.();
          closeModal();
        },
      });
    } else {
      // TODO: wire create endpoint when available
      onSuccess?.();
      closeModal();
    }
  };

  const renderHeader = () => (
    <h1 className="modal-title">
      {isEdit ? "Edit Billing Entity" : "Add Billing Entity"}
    </h1>
  );

  const renderBody = () => (
    <div className="modal-body billing-entity-modal">
      <div className="lead-form">
        <form id="billingEntityForm" onSubmit={handleSubmit(onSubmit)}>
          {/* ===== Logo Upload ===== */}
          <div className="d-flex justify-content-center mb-4">
            <div className="avatar-outer">
              <div className="avatar-wrapper">
                <img
                  src={logoImagePreview}
                  alt="Billing Entity Logo"
                  className="avatar-image"
                />
              </div>
              <label htmlFor="logoUpload" className="avatar-edit-icon">
                <img src={edit} alt="Edit" className="avatar-edit-pencil" />
              </label>
              <input
                type="file"
                id="logoUpload"
                className="d-none"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* ===== Billing Entity Name + Credit Limit ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <input
                      type="text"
                      className={`form-control ${errors.billingEntityName ? "is-invalid" : ""}`}
                      placeholder="Billing Entity Name"
                      disabled={isEdit}
                      {...register("billingEntityName", { required: !isEdit && "Billing Entity Name is required" })}
                    />
                    <label>
                      Billing Entity Name <span className="text-danger">*</span>
                    </label>
                  </div>
                  {errors.billingEntityName && (
                    <span className="field-error">{errors.billingEntityName.message}</span>
                  )}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="form-floating desig-inp">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`form-control ${errors.creditLimit ? "is-invalid" : ""}`}
                      placeholder="Credit Limit"
                      {...register("creditLimit")}
                    />
                    <label>Credit Limit</label>
                  </div>
                  {errors.creditLimit && (
                    <span className="field-error">{errors.creditLimit.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Customer Type + Color Code ===== */}
          <div className="mb-lg-3 mb-sm-0">
            <div className="row g-3">
              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <div className="phone-wrapper">
                    <label className="phone-label">
                      Customer Type <span className="text-danger">*</span>
                    </label>
                    <Controller
                      name="customerType"
                      control={control}
                      rules={{ required: "Customer Type is required" }}
                      render={({ field }) => (
                        <PremiumSelect
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          options={CUSTOMER_TYPE_OPTIONS}
                          placeholder="Select Customer Type"
                          searchPlaceholder="Search type..."
                          hasError={Boolean(errors.customerType)}
                          menuPortalTarget={
                            typeof document !== "undefined" ? document.body : undefined
                          }
                          menuClassName="user-modal-premium-select-menu"
                        />
                      )}
                    />
                  </div>
                  {errors.customerType && (
                    <span className="field-error">{errors.customerType.message}</span>
                  )}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="form-field">
                  <Controller
                    name="colorCode"
                    control={control}
                    render={({ field }) => (
                      <>
                        <div className="form-floating desig-inp billing-entity-color-field">
                          <input
                            ref={colorTriggerRef}
                            type="text"
                            readOnly
                            className="form-control"
                            placeholder="Color Code"
                            value={field.value?.toUpperCase() ?? ""}
                            onClick={() => setIsColorPickerOpen((open) => !open)}
                            aria-haspopup="dialog"
                            aria-expanded={isColorPickerOpen}
                          />
                          <label>Color Code</label>
                          <span
                            className="billing-entity-color-swatch"
                            style={{ backgroundColor: field.value }}
                            aria-hidden="true"
                          />
                        </div>
                        {isColorPickerOpen &&
                          createPortal(
                            <div
                              style={{
                                position: "fixed",
                                top: colorPickerPlacement.top,
                                left: colorPickerPlacement.left,
                                zIndex: COLOR_PICKER_PORTAL_Z,
                              }}
                            >
                              <SedresColorPicker
                                popoverRef={colorPickerPopoverRef}
                                popoverId="billing-entity-color-picker"
                                className="kanban-dashboard-color-picker-popover--floating"
                                initialHex={field.value}
                                onApply={(hex) => {
                                  field.onChange(normalizeHexColor(hex));
                                  closeColorPicker();
                                }}
                                onCancel={closeColorPicker}
                                ariaLabel="Pick billing entity color"
                              />
                            </div>,
                            document.body
                          )}
                      </>
                    )}
                  />
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
      <button type="button" className="btn btn-outline" onClick={closeModal} disabled={addEditLoader}>
        Close
      </button>
      <button type="submit" form="billingEntityForm" className="btn btn-primary" disabled={addEditLoader}>
        {addEditLoader ? (
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        ) : isEdit ? (
          "Update"
        ) : (
          "Save"
        )}
      </button>
    </div>
  );

  return (
    <CustomModal
      className="user-modal-sm add-edit-user-modal"
      dialgName="modal-dialog modal-dialog-centered"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={renderHeader()}
    />
  );
}
