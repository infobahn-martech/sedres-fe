import { useForm, Controller } from 'react-hook-form';
import { useEffect, useMemo, useRef } from 'react';
import Quill from 'quill';
import QuillTableBetter from 'quill-table-better';
import 'quill/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import CustomModal from '../../../components/CustomModal';
import PremiumSelect from '../../../components/form/PremiumSelect';
import Gateway from '../../../gateway/gateway';
import { notify } from '../../../components/Toaster';
import useVesselRegistrationTemplateReducer from '../../../store/VesselRegistrationTemplateReducer';
import usePortReducer from '../../../store/PortReducer';
import '../../../design/scss/prospect-modal.scss';
import '../../../design/scss/modal-designs.scss';
import '../../../design/scss/form-designs.scss';
import '../../../design/scss/pages/vessel-registration-template/modals/AddEditVesselRegistrationTemplate.scss';

// Register once at module level using the same Quill instance that quill-table-better uses
if (!Quill.__tableBetterRegistered) {
  Quill.register({ 'modules/table-better': QuillTableBetter }, true);
  QuillTableBetter.register();

  // Quill's built-in Image blot only round-trips `alt`/`height`/`width` through
  // HTML<->Delta (its static formats()/format() only know those three — see
  // quill/formats/image.js). The float/margin wrap style the align toolbar below
  // sets on the <img> would silently vanish the next time saved content gets
  // reloaded (AddEditVesselRegistrationTemplateModal's edit-mode load runs HTML
  // through quill.clipboard.convert(), which rebuilds the Delta purely from
  // formats()). Extending it to also carry `style` is what quill's own clipboard
  // matcher (matchBlot in modules/clipboard.js) expects for round-tripping.
  const BaseImage = Quill.import('formats/image');
  class StyledImage extends BaseImage {
    static formats(domNode) {
      const formats = super.formats(domNode);
      if (domNode.hasAttribute('style')) {
        formats.style = domNode.getAttribute('style');
      }
      return formats;
    }
    format(name, value) {
      if (name === 'style') {
        if (value) {
          this.domNode.setAttribute('style', value);
        } else {
          this.domNode.removeAttribute('style');
        }
      } else {
        super.format(name, value);
      }
    }
  }
  Quill.register(StyledImage, true);

  const Icons = Quill.import('ui/icons');
  Icons['table-better'] = `<svg viewBox="0 0 18 18"><rect class="ql-stroke" height="12" width="12" x="3" y="3"/><line class="ql-stroke" x1="3" x2="15" y1="9" y2="9"/><line class="ql-stroke" x1="9" x2="9" y1="3" y2="15"/></svg>`;

  Quill.__tableBetterRegistered = true;
}

const isHtmlEmpty = (value) => {
  if (!value) return true;
  return value.replace(/<(.|\n)*?>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
};

// Shared by the toolbar's "insert image" handler and the selected-image "replace"
// button below. Mirrors the same upload endpoint/response shape already used for
// Quill image inserts in AppointmentAcceptance's report template modal and the
// Kanban card description editor.
async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('image_file', file);
  const response = await Gateway.post('/report_template/upload_image', formData);
  return response?.data?.file_url ?? response?.data?.data?.file_url;
}

function pickImageFile(onPicked) {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPicked(file);
  };
}

// Native Quill toolbar handlers are invoked with `this` bound to the toolbar module,
// which carries `this.quill` — see quill/modules/toolbar.js `handlers[format].call(this, value)`.
function quillImageUploadHandler() {
  const quill = this.quill;
  pickImageFile(async (file) => {
    try {
      const fileUrl = await uploadImageFile(file);
      if (fileUrl) {
        const range = quill.getSelection(true);
        quill.insertEmbed(range?.index ?? 0, 'image', fileUrl, 'user');
        quill.setSelection((range?.index ?? 0) + 1);
      }
    } catch {
      notify('Image upload failed.', 'error');
    }
  });
}

// Wrap modes applied directly as inline styles on the <img> (persisted via the
// StyledImage blot above). 'inline' clears everything back to normal text flow.
const IMAGE_WRAP_STYLES = {
  left: 'float:left;margin:4px 12px 8px 0;',
  center: 'display:block;margin:8px auto;',
  right: 'float:right;margin:4px 0 8px 12px;',
  inline: '',
};
const IMAGE_WRAP_MENU_ITEMS = [
  { mode: 'inline', label: 'In line with text' },
  { mode: 'left', label: 'Wrap left' },
  { mode: 'center', label: 'Center' },
  { mode: 'right', label: 'Wrap right' },
];

// Eight handles around the bounding box, Word-style. Each carries which edges
// it grows from ({dx,dy} = -1/0/1). The image sits in normal document flow
// (no explicit x/y — its on-screen position comes entirely from text flow /
// float, not coordinates we control), so there's no independent "move the left
// edge" the way a canvas object would have. All eight instead resize the same
// way — proportionally, driven by drag distance in that handle's outward
// direction — which keeps the image from distorting and needs no absolute
// positioning, at the cost of not matching Word's true per-edge free stretch.
const RESIZE_HANDLES = [
  { pos: 'nw', dx: -1, dy: -1, cursor: 'nwse-resize' },
  { pos: 'n', dx: 0, dy: -1, cursor: 'ns-resize' },
  { pos: 'ne', dx: 1, dy: -1, cursor: 'nesw-resize' },
  { pos: 'e', dx: 1, dy: 0, cursor: 'ew-resize' },
  { pos: 'se', dx: 1, dy: 1, cursor: 'nwse-resize' },
  { pos: 's', dx: 0, dy: 1, cursor: 'ns-resize' },
  { pos: 'sw', dx: -1, dy: 1, cursor: 'nesw-resize' },
  { pos: 'w', dx: -1, dy: 0, cursor: 'ew-resize' },
];
const HANDLE_POINT = {
  nw: (r) => [r.left, r.top],
  n: (r) => [r.left + r.width / 2, r.top],
  ne: (r) => [r.right, r.top],
  e: (r) => [r.right, r.top + r.height / 2],
  se: (r) => [r.right, r.bottom],
  s: (r) => [r.left + r.width / 2, r.bottom],
  sw: (r) => [r.left, r.bottom],
  w: (r) => [r.left, r.top + r.height / 2],
};

const LAYOUT_ICON_SVG =
  '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="1.5" y="1.5" width="5" height="5" fill="currentColor"/><line x1="8.5" y1="2.5" x2="14.5" y2="2.5" stroke="currentColor" stroke-width="1.3"/><line x1="8.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" stroke-width="1.3"/><line x1="1.5" y1="9" x2="14.5" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="1.5" y1="12" x2="14.5" y2="12" stroke="currentColor" stroke-width="1.3"/></svg>';

// Dependency-free image controls: an 8-handle resize box, a Word-style "Layout
// Options" icon that opens a wrap/align dropdown, and a selection outline —
// modeled after Microsoft Word's image selection UI. Tried quill-resize-image
// first, but its handle is position:absolute against quill's own container and
// computes its offset assuming the editor sits flush at (0,0) inside it — that
// math drifts with any border/padding/scroll on an ancestor (see upstream
// issues #10, #23, #25 at github.com/hunghg255/quill-resize-image), which is
// exactly this modal's nesting. Everything here instead uses position:fixed +
// getBoundingClientRect() recomputed on every drag/scroll/resize frame, which
// is always in viewport coordinates and so can't drift regardless of ancestors.
function attachImageControls(quill, notifyChange) {
  let activeImg = null;
  let selectionBox = null;
  let handles = [];
  let layoutIcon = null;
  let dropdown = null;
  let dragHandle = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  const positionControls = () => {
    if (!activeImg) return;
    const rect = activeImg.getBoundingClientRect();
    if (selectionBox) {
      selectionBox.style.left = `${rect.left}px`;
      selectionBox.style.top = `${rect.top}px`;
      selectionBox.style.width = `${rect.width}px`;
      selectionBox.style.height = `${rect.height}px`;
    }
    handles.forEach((el, i) => {
      const [x, y] = HANDLE_POINT[RESIZE_HANDLES[i].pos](rect);
      el.style.left = `${x - 4}px`;
      el.style.top = `${y - 4}px`;
    });
    if (layoutIcon) {
      layoutIcon.style.left = `${rect.right + 4}px`;
      layoutIcon.style.top = `${rect.top}px`;
    }
    if (dropdown && layoutIcon) {
      const iconRect = layoutIcon.getBoundingClientRect();
      dropdown.style.left = `${iconRect.left}px`;
      dropdown.style.top = `${iconRect.bottom + 4}px`;
    }
  };

  const closeDropdown = () => {
    dropdown?.remove();
    dropdown = null;
  };

  const removeControls = () => {
    selectionBox?.remove();
    handles.forEach((el) => el.remove());
    layoutIcon?.remove();
    closeDropdown();
    selectionBox = null;
    handles = [];
    layoutIcon = null;
    activeImg = null;
  };

  const onDragMove = (e) => {
    if (!activeImg || !dragHandle) return;
    const { dx, dy } = dragHandle;
    const widthDelta =
      dx !== 0
        ? (e.clientX - startX) * dx
        : (e.clientY - startY) * dy * (startWidth / (startHeight || 1));
    const newWidth = Math.max(30, Math.round(startWidth + widthDelta));
    activeImg.setAttribute('width', String(newWidth));
    activeImg.removeAttribute('height');
    positionControls();
  };

  const detachDragListeners = () => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', stopDrag);
  };

  const stopDrag = () => {
    detachDragListeners();
    dragHandle = null;
    notifyChange();
  };

  const startDrag = (handleDef, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeImg) return;
    dragHandle = handleDef;
    startX = e.clientX;
    startY = e.clientY;
    const rect = activeImg.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', stopDrag);
  };

  const applyWrap = (mode) => {
    if (!activeImg) return;
    const style = IMAGE_WRAP_STYLES[mode] ?? '';
    if (style) {
      activeImg.setAttribute('style', style);
    } else {
      activeImg.removeAttribute('style');
    }
    notifyChange();
    closeDropdown();
    // Floating/centering reflows surrounding text, which can move the image
    // itself, so re-anchor the controls to wherever it ended up.
    requestAnimationFrame(positionControls);
  };

  const replaceImage = () => {
    const target = activeImg;
    if (!target) return;
    closeDropdown();
    pickImageFile(async (file) => {
      try {
        const fileUrl = await uploadImageFile(file);
        if (fileUrl && activeImg === target) {
          target.setAttribute('src', fileUrl);
          notifyChange();
          requestAnimationFrame(positionControls);
        }
      } catch {
        notify('Image upload failed.', 'error');
      }
    });
  };

  const openDropdown = () => {
    if (dropdown) {
      closeDropdown();
      return;
    }
    dropdown = document.createElement('div');
    dropdown.className = 'ql-image-layout-dropdown';

    IMAGE_WRAP_MENU_ITEMS.forEach(({ mode, label }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ql-image-layout-dropdown-item';
      item.textContent = label;
      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        applyWrap(mode);
      });
      dropdown.appendChild(item);
    });

    const divider = document.createElement('div');
    divider.className = 'ql-image-layout-dropdown-divider';
    dropdown.appendChild(divider);

    const replaceItem = document.createElement('button');
    replaceItem.type = 'button';
    replaceItem.className = 'ql-image-layout-dropdown-item';
    replaceItem.textContent = 'Replace image';
    replaceItem.addEventListener('mousedown', (e) => e.preventDefault());
    replaceItem.addEventListener('click', (e) => {
      e.stopPropagation();
      replaceImage();
    });
    dropdown.appendChild(replaceItem);

    document.body.appendChild(dropdown);
    positionControls();
  };

  const selectImage = (img) => {
    activeImg = img;
    closeDropdown();
    if (!selectionBox) {
      selectionBox = document.createElement('div');
      selectionBox.className = 'ql-image-selection-box';
      document.body.appendChild(selectionBox);
    }
    if (handles.length === 0) {
      handles = RESIZE_HANDLES.map((def) => {
        const el = document.createElement('div');
        el.className = 'ql-image-resize-handle';
        el.style.cursor = def.cursor;
        el.addEventListener('mousedown', (e) => startDrag(def, e));
        document.body.appendChild(el);
        return el;
      });
    }
    if (!layoutIcon) {
      layoutIcon = document.createElement('button');
      layoutIcon.type = 'button';
      layoutIcon.className = 'ql-image-layout-icon';
      layoutIcon.title = 'Layout options';
      layoutIcon.innerHTML = LAYOUT_ICON_SVG;
      layoutIcon.addEventListener('mousedown', (e) => e.preventDefault());
      layoutIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        openDropdown();
      });
      document.body.appendChild(layoutIcon);
    }
    positionControls();
  };

  const onEditorClick = (e) => {
    if (e.target?.tagName === 'IMG') {
      selectImage(e.target);
    } else {
      removeControls();
    }
  };
  const onOutsideMousedown = (e) => {
    if (!activeImg) return;
    if (
      e.target === activeImg ||
      handles.includes(e.target) ||
      e.target === layoutIcon ||
      dropdown?.contains(e.target)
    ) {
      return;
    }
    if (dropdown) {
      closeDropdown();
      return;
    }
    removeControls();
  };

  quill.root.addEventListener('click', onEditorClick);
  document.addEventListener('mousedown', onOutsideMousedown, true);
  document.addEventListener('scroll', positionControls, true);
  window.addEventListener('resize', positionControls);

  return () => {
    detachDragListeners();
    removeControls();
    quill.root.removeEventListener('click', onEditorClick);
    document.removeEventListener('mousedown', onOutsideMousedown, true);
    document.removeEventListener('scroll', positionControls, true);
    window.removeEventListener('resize', positionControls);
  };
}

// QuillEditor — mounts a real Quill v2 instance directly onto a bare div, bypassing
// react-quill's controlled-component reconciliation (its shouldComponentUpdate diffs
// the `value` prop against live editor content and can stomp the imperative
// direction/align format + insertTable calls quill-table-better relies on). Mirrors
// the pattern already used in CGPassTemplate for the same Quill v2 + quill-table-better combo.
function QuillEditor({ value, onChange, placeholder }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const lastHtmlRef = useRef('');
  const isPristineRef = useRef(true);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: placeholder || '',
      modules: {
        table: false,
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            [{ direction: 'rtl' }],
            ['link', 'image', 'table-better'],
            ['clean'],
          ],
          handlers: {
            image: quillImageUploadHandler,
          },
        },
        'table-better': {
          language: 'en_US',
          menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'delete'],
          toolbarTable: true,
        },
        keyboard: {
          bindings: QuillTableBetter.keyboardBindings,
        },
      },
    });

    quillRef.current = quill;

    quill.format('direction', 'rtl');
    quill.format('align', 'right');

    // Patch getSelection so it never returns null when called with force=true.
    // Prevents insertTable (and the format() calls above) from silently aborting
    // inside a Bootstrap modal where root.focus() can briefly reset savedRange to null.
    const origGetSel = quill.getSelection.bind(quill);
    quill.getSelection = function (force) {
      const range = origGetSel(force);
      return range !== null ? range : (force ? { index: 0, length: 0 } : null);
    };

    // Keep the toolbar's table button from stealing focus/selection away from the
    // editor when opening the row/column picker grid.
    const toolbarContainer = quill.getModule('toolbar')?.container;
    const tableBtn = toolbarContainer?.querySelector('button.ql-table-better');
    if (tableBtn) {
      tableBtn.addEventListener('mousedown', (e) => e.preventDefault());
      tableBtn.addEventListener('click', () => {
        setTimeout(() => {
          const picker = document.querySelector('.ql-table-select-container');
          if (picker && !picker._nofocusAdded) {
            picker.addEventListener('mousedown', (e) => e.preventDefault(), true);
            picker._nofocusAdded = true;
          }
        }, 0);
      });
    }

    const syncChange = () => {
      const html = quill.root.innerHTML;
      lastHtmlRef.current = html;
      onChange(html);
    };
    quill.on(Quill.events.TEXT_CHANGE, syncChange);

    const detachImageControls = attachImageControls(quill, syncChange);

    return () => {
      quill.off(Quill.events.TEXT_CHANGE, syncChange);
      detachImageControls();
      // Quill inserts its toolbar as a DOM sibling *before* the container element
      // (not inside it), and quill-table-better creates its row/column picker and
      // context menus as standalone elements outside the container too — none of
      // that lives inside containerRef, so it isn't removed just by React tearing
      // down this component's own JSX. Left uncleaned, a remount (e.g. reopening
      // this modal) stacks a second toolbar/table-better instance on top of the first.
      quill.getModule('toolbar')?.container?.remove();
      const tableBetter = quill.getModule('table-better');
      tableBetter?.tableSelect?.root?.remove();
      tableBetter?.tableMenus?.root?.remove();
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const incoming = value || '';
    if (incoming === lastHtmlRef.current) return;
    lastHtmlRef.current = incoming;
    const delta = quill.clipboard.convert({ html: incoming });
    // Quill core's own default clipboard matcher for <tr> (quill/formats/table, a
    // legacy plain-attribute table format that stays registered even though the
    // 'table' module is disabled) also fires on every row and stamps a bare
    // `table: <rowNumber>` attribute onto the same ops quill-table-better's matchers
    // already formatted with `table-cell`/`table-cell-block`. quill-table-better's own
    // insertTable() never produces that key, and its presence stops the cells from
    // being wrapped into real <tbody>/<tr>/<td> blots. Strip it before loading.
    delta.ops.forEach((op) => {
      if (op.attributes && 'table' in op.attributes) {
        delete op.attributes.table;
      }
    });
    if (isPristineRef.current) {
      // quill-table-better's row/cell wrap-and-merge cascade needs an existing sibling
      // block already in the scroll to anchor onto. setContents() deletes Quill's own
      // default empty paragraph before inserting, so when a table is the very first
      // thing being loaded, it ends up with no prior sibling and the cells never get
      // grouped into real rows. Insert into the untouched default document instead
      // (leaving that empty paragraph in place), then trim the trailing blank line
      // it leaves behind.
      quill.updateContents(delta, Quill.sources.SILENT);
      quill.deleteText(quill.getLength() - 1, 1, Quill.sources.SILENT);
      isPristineRef.current = false;
    } else {
      quill.setContents(delta, Quill.sources.SILENT);
    }
  }, [value]);

  return (
    <div className="react-quill-wrapper" dir="rtl">
      <div ref={containerRef} />
    </div>
  );
}

export function AddEditVesselRegistrationTemplateModal({ showModal, closeModal, onSuccess }) {
  const templateId = showModal?.pass_vesselreg_template_id;
  const isEdit = !!templateId;

  const { createTemplate, updateTemplate, isBeingUpdated } = useVesselRegistrationTemplateReducer((s) => s);
  const { ports, getPorts } = usePortReducer((s) => s);

  const defaultValues = useMemo(
    () =>
      isEdit && showModal
        ? {
            port_id: String(showModal?.port_id ?? ''),
            template_name: showModal?.template_name ?? '',
            description: showModal?.description ?? '',
            content: showModal?.more_description ?? '',
          }
        : { port_id: '', template_name: '', description: '', content: '' },
    [isEdit, showModal]
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues });

  useEffect(() => {
    getPorts({ params: { limit: 1000 } });
  }, []);

  useEffect(() => {
    reset(defaultValues);
  }, [showModal, reset]);

  const onSubmit = (data) => {
    const payload = {
      port_id: data.port_id ? Number(data.port_id) : null,
      template_name: data.template_name?.trim() ?? '',
      template_type: 'Vessel Registration',
      description: data.description ?? '',
      more_description: data.content ?? '',
    };

    const cb = () => {
      onSuccess?.();
      closeModal();
    };

    if (isEdit) {
      updateTemplate({ formData: { ...payload, template_id: Number(templateId) }, cb });
    } else {
      createTemplate({ formData: payload, cb });
    }
  };

  const renderHeader = () => (
    <h1 className="modal-title">
      {isEdit ? 'Edit Vessel Registration Template' : 'Add Vessel Registration Template'}
    </h1>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="vesselRegistrationTemplateForm" onSubmit={handleSubmit(onSubmit)}>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-lg-6 col-sm-12">
                <div className="desig-inp">
                  <label className="mb-2 d-block">
                    Port <span className="text-danger">*</span>
                  </label>
                  <Controller
                    name="port_id"
                    control={control}
                    rules={{ required: 'Port is required' }}
                    render={({ field }) => (
                      <PremiumSelect
                        value={field.value != null ? String(field.value) : ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        options={(ports ?? []).map((p) => {
                          const id = p?.port_id ?? p?._id ?? p?.id;
                          return {
                            value: String(id ?? ''),
                            label: String(p?.port ?? p?.name ?? p?.port_name ?? id ?? ''),
                          };
                        })}
                        placeholder="Select Port"
                        searchPlaceholder="Search port..."
                        hasError={Boolean(errors.port_id)}
                      />
                    )}
                  />
                  {errors.port_id && (
                    <span className="error text-danger">{errors.port_id.message}</span>
                  )}
                </div>
              </div>

              <div className="col-lg-6 col-sm-12">
                <div className="desig-inp">
                  <label className="mb-2 d-block">
                    Template Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter template name"
                    dir="auto"
                    {...register('template_name', { required: 'Template name is required' })}
                  />
                  {errors.template_name && (
                    <span className="error text-danger">{errors.template_name.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-12">
                <div className="desig-inp">
                  <label className="mb-2 d-block">Description</label>
                  <textarea
                    className="form-control"
                    placeholder=""
                    rows={3}
                    dir="rtl"
                    {...register('description')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-lg-3 mb-sm-0">
            <div className="permInputs row">
              <div className="col-12">
                <div className="desig-inp">
                  <label className="mb-2 d-block">
                    Content <span className="text-danger">*</span>
                  </label>
                  <Controller
                    name="content"
                    control={control}
                    rules={{
                      required: 'Content is required',
                      validate: (v) => !isHtmlEmpty(v) || 'Content is required',
                    }}
                    render={({ field }) => (
                      <QuillEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Enter content..."
                      />
                    )}
                  />
                  {errors.content && (
                    <span className="error text-danger">
                      {errors.content.message}
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
        form="vesselRegistrationTemplateForm"
        className="btn btn-primary"
        disabled={isBeingUpdated}
      >
        {isBeingUpdated ? 'Saving...' : 'Save'}
      </button>
    </div>
  );

  return (
    <CustomModal
      className="appointment-acceptance-modal-lg"
      dialgName="modal-dialog modal-dialog-centered"
      show={!!showModal}
      closeModal={() => closeModal(null)}
      body={renderBody()}
      footer={renderFooter()}
      header={renderHeader()}
    />
  );
}
