import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SedresColorPicker from '../../components/SedresColorPicker/SedresColorPicker';
import { normalizeHexColor } from '../../components/SedresColorPicker/sedresColorPickerConstants';
import { rgbToHex, hexToRgb, workflowStageHasChildColumns, DEFAULT_STAGE_SWATCH_HEX } from './workflow.utils';

const STAGE_COLOR_PICKER_WIDTH = 308;
const STAGE_COLOR_PICKER_Z = 10050;
const COLOR_PICKER_VIEWPORT_MARGIN = 8;

/**
 * Single stage card with insertion rails, title editing, and minimal color action.
 */
function WorkflowStageCard({
  stage,
  swimlaneStages = [],
  swimlaneId,
  workflowId,
  stageColumnKey,
  colStackKey,
  isStageHovered,
  showAddSubcolumn,
  isSingleInCol,
  mutationState,
  editingStageId,
  editingStageName,
  onStageMouseEnter,
  onStageMouseLeave,
  onAddColumnLeft,
  onAddColumnRight,
  onAddSubcolumn,
  onStartEditStage,
  onEditingStageNameChange,
  onSaveStageName,
  onStageNameKeyPress,
  onColorSelect,
  onDeleteStage,
  onStageLimitChange,
  onStageCardsPerRowChange,
  canAddColumns,
  canUpdateColumnColor,
  canDeleteColumn,
}) {
  const showInlineAddButtons = isSingleInCol;
  const isStacked = !isSingleInCol;

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const limit = stage.limit ?? 0;
  const cardsPerRow = stage.cardsPerRow ?? 1;
  const hasChildren = workflowStageHasChildColumns(stage, swimlaneStages);
  const displayColor = stage.color ? rgbToHex(stage.color) : DEFAULT_STAGE_SWATCH_HEX;
  const [isStageColorPickerOpen, setIsStageColorPickerOpen] = useState(false);
  const stageColorTriggerRef = useRef(null);
  const stageColorPickerPopoverRef = useRef(null);
  const [stageColorPickerPlacement, setStageColorPickerPlacement] = useState({ top: 0, left: 0 });
  const isChildColumn = !!stage.parent_column_id;
  const columnBusy = Boolean(mutationState);
  const isDeleting = mutationState === 'deleting';

  const startEditLimit = () => {
    setEditingField('limit');
    setEditValue(String(limit));
  };

  const startEditCardsPerRow = () => {
    setEditingField('cardsPerRow');
    setEditValue(String(cardsPerRow));
  };

  const saveLimit = () => {
    const num = Math.max(0, parseInt(editValue, 10) || 0);
    onStageLimitChange?.(workflowId, swimlaneId, stage.id, String(num));
    setEditingField(null);
  };

  const saveCardsPerRow = () => {
    const num = Math.max(1, parseInt(editValue, 10) || 1);
    onStageCardsPerRowChange?.(workflowId, swimlaneId, stage.id, String(num));
    setEditingField(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
  };

  const handleLimitKeyDown = (e) => {
    if (e.key === 'Enter') saveLimit();
    else if (e.key === 'Escape') cancelEdit();
  };

  const handleCardsPerRowKeyDown = (e) => {
    if (e.key === 'Enter') saveCardsPerRow();
    else if (e.key === 'Escape') cancelEdit();
  };

  const updateStageColorPickerPlacement = useCallback(() => {
    const el = stageColorTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = COLOR_PICKER_VIEWPORT_MARGIN;
    const gap = 8;
    const pickerHeight = stageColorPickerPopoverRef.current?.offsetHeight ?? 320;
    let left = r.left;
    if (left + STAGE_COLOR_PICKER_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - STAGE_COLOR_PICKER_WIDTH - margin;
    }
    left = Math.max(margin, left);
    const belowTop = r.bottom + gap;
    const aboveTop = r.top - pickerHeight - gap;
    const canPlaceBelow = belowTop + pickerHeight <= window.innerHeight - margin;
    const canPlaceAbove = aboveTop >= margin;
    let top = belowTop;
    if (!canPlaceBelow && canPlaceAbove) {
      top = aboveTop;
    } else if (!canPlaceBelow) {
      top = Math.max(margin, window.innerHeight - pickerHeight - margin);
    }
    setStageColorPickerPlacement({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isStageColorPickerOpen) return;
    updateStageColorPickerPlacement();
  }, [isStageColorPickerOpen, updateStageColorPickerPlacement]);

  useEffect(() => {
    if (!isStageColorPickerOpen) return undefined;
    updateStageColorPickerPlacement();
    window.addEventListener('scroll', updateStageColorPickerPlacement, true);
    window.addEventListener('resize', updateStageColorPickerPlacement);
    return () => {
      window.removeEventListener('scroll', updateStageColorPickerPlacement, true);
      window.removeEventListener('resize', updateStageColorPickerPlacement);
    };
  }, [isStageColorPickerOpen, updateStageColorPickerPlacement]);

  useEffect(() => {
    if (!isStageColorPickerOpen) return undefined;
    const popover = stageColorPickerPopoverRef.current;
    if (!popover || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => updateStageColorPickerPlacement());
    observer.observe(popover);
    return () => observer.disconnect();
  }, [isStageColorPickerOpen, updateStageColorPickerPlacement]);

  useEffect(() => {
    if (!isStageColorPickerOpen) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (stageColorTriggerRef.current?.contains(t) || stageColorPickerPopoverRef.current?.contains(t)) return;
      setIsStageColorPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isStageColorPickerOpen]);

  const closeStageColorPicker = useCallback(() => setIsStageColorPickerOpen(false), []);

  const applyStageColor = useCallback(
    (hex) => {
      const rgb = hexToRgb(hex);
      if (rgb) onColorSelect(workflowId, swimlaneId, stage.id, rgb);
      setIsStageColorPickerOpen(false);
    },
    [onColorSelect, workflowId, swimlaneId, stage.id]
  );

  const openStageColorPicker = (e) => {
    e?.stopPropagation?.();
    setIsStageColorPickerOpen(true);
  };

  return (
    <div
      className={`workflow-stage-wrapper${isSingleInCol ? ' workflow-stage-single' : ' workflow-stage-stacked'}`}
    >
      <div
        className={`workflow-stage-box${isDeleting ? ' workflow-stage-box--mutation-deleting' : ''}`}
        style={{ position: 'relative' }}
        onMouseEnter={(e) =>
          onStageMouseEnter(
            e,
            stageColumnKey,
            workflowId,
            swimlaneId,
            stage.id,
            stage.name,
            isStacked,
            stage.area,
            stage.col ?? 0,
            stage.colSpan ?? 1
          )
        }
        onMouseLeave={(e) => onStageMouseLeave?.(e, stageColumnKey, colStackKey)}
      >
        {columnBusy ? (
          <div
            className={`workflow-stage-mutation-overlay${isDeleting ? ' workflow-stage-mutation-overlay--deleting' : ''}`}
            aria-busy="true"
          >
            <span className="workflow-stage-mutation-skeleton" />
          </div>
        ) : null}
        {isStageHovered && showInlineAddButtons && !columnBusy && canAddColumns && (
          <div className="workflow-insertion-rail workflow-insertion-rail-left">
            <button
              className="workflow-column-add-btn workflow-column-add-left"
              type="button"
              disabled={columnBusy}
              onClick={() => onAddColumnLeft(workflowId, swimlaneId, stage.id)}
              title={`Add a new column before ${stage.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        {isStageHovered && showInlineAddButtons && !columnBusy && canAddColumns && (
          <div className="workflow-insertion-rail workflow-insertion-rail-right">
            <button
              className="workflow-column-add-btn workflow-column-add-right"
              type="button"
              disabled={columnBusy}
              onClick={() => onAddColumnRight(workflowId, swimlaneId, stage.id)}
              title={`Add a new column after ${stage.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        {isStageHovered && showAddSubcolumn && !columnBusy && canAddColumns && (
          <div
            className={`workflow-insertion-rail workflow-insertion-rail-bottom bottom-add-grid${isChildColumn ? ' disabled' : ''}`}
          >
            <button
              className="workflow-column-add-btn workflow-column-add-below"
              type="button"
              disabled={columnBusy || isChildColumn}
              onClick={(e) => {
                e.stopPropagation();
                if (isChildColumn) return;
                onAddSubcolumn(workflowId, swimlaneId, stage.id);
              }}
              title="Add a new subcolumn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className={`workflow-stage-box-content${columnBusy ? ' workflow-stage-box-content--muted' : ''}`}>
          <div className="stage-box-header">
            {editingStageId === stageColumnKey ? (
              <input
                type="text"
                className="stage-name-input"
                value={editingStageName}
                onChange={(e) => onEditingStageNameChange?.(e.target.value)}
                onBlur={() => onSaveStageName(workflowId, swimlaneId, stage.id)}
                onKeyDown={(e) => onStageNameKeyPress(e, workflowId, swimlaneId, stage.id)}
                disabled={columnBusy}
                autoFocus
              />
            ) : (
              <span
                className="stage-name"
                data-tooltip-id="workflow-stage-name-tooltip"
                data-tooltip-content={stage.name}
                onClick={() => !columnBusy && onStartEditStage(stageColumnKey, stage.name)}
                style={{ cursor: columnBusy ? 'default' : 'pointer' }}
              >
                {stage.name}
              </span>
            )}
          </div>
          <div className="stage-box-details">
            <div className="stage-detail-row">
              <span className="stage-detail-label">Limit:</span>
              <span className="stage-detail-value-slot">
                {editingField === 'limit' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="stage-inline-input stage-inline-input-edit"
                    value={editValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) setEditValue(v);
                    }}
                    onBlur={saveLimit}
                    onKeyDown={handleLimitKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    className="stage-detail-value"
                    onClick={(e) => { e.stopPropagation(); startEditLimit(); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditLimit(); } }}
                    title="Click to edit"
                  >
                    {limit}
                  </span>
                )}
              </span>
            </div>
            {!hasChildren ? (
              <div className="stage-detail-row">
                <span className="stage-detail-label">Cards per row:</span>
                <span className="stage-detail-value-slot">
                  {editingField === 'cardsPerRow' ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="stage-inline-input stage-inline-input-edit"
                      value={editValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) setEditValue(v);
                      }}
                      onBlur={saveCardsPerRow}
                      onKeyDown={handleCardsPerRowKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="stage-detail-value"
                      onClick={(e) => { e.stopPropagation(); startEditCardsPerRow(); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditCardsPerRow(); } }}
                      title="Click to edit"
                    >
                      {cardsPerRow}
                    </span>
                  )}
                </span>
              </div>
            ) : null}
          </div>
          <div className="stage-box-actions">
            {canUpdateColumnColor ? (
              <button
                ref={stageColorTriggerRef}
                type="button"
                className="stage-action-color-trigger"
                title="Stage color"
                aria-label="Stage color"
                aria-haspopup="dialog"
                aria-expanded={isStageColorPickerOpen}
                aria-controls={`stage-color-picker-${stage.id}`}
                onClick={openStageColorPicker}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openStageColorPicker(event);
                  }
                }}
              >
                <span
                  className="kanban-dashboard-actions-color-swatch stage-action-color-swatch"
                  style={{ backgroundColor: normalizeHexColor(displayColor) }}
                  aria-hidden
                />
              </button>
            ) : null}
            {isStageColorPickerOpen &&
              canUpdateColumnColor &&
              createPortal(
                <div
                  className="workflow-stage-color-picker-anchor"
                  style={{
                    position: 'fixed',
                    top: stageColorPickerPlacement.top,
                    left: stageColorPickerPlacement.left,
                    zIndex: STAGE_COLOR_PICKER_Z,
                  }}
                >
                  <SedresColorPicker
                    popoverRef={stageColorPickerPopoverRef}
                    popoverId={`stage-color-picker-${stage.id}`}
                    initialHex={displayColor}
                    onApply={applyStageColor}
                    onCancel={closeStageColorPicker}
                    ariaLabel={`Pick color for stage ${stage.name}`}
                    hexInputId={`stage-color-hex-${stage.id}`}
                    className="kanban-dashboard-color-picker-popover--floating"
                  />
                </div>,
                document.body
              )}
            {canDeleteColumn ? (
              <button
                className="stage-action-icon stage-action-icon-delete"
                type="button"
                title="Delete stage"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStage?.(workflowId, swimlaneId, stage.id);
                }}
                aria-label="Delete stage"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M3 4L3 13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowStageCard;
