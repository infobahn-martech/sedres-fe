import { useRef, useEffect, useLayoutEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CTTaskCard from "./CTTaskCard";
import "../../design/css/common/Column.css";
import "../../design/css/common/OperationsColumn.css";

// Nested Column Component (for sub-columns within "In Progress")
function NestedColumn({ column, cards, setSelectedCard, isShrunk = false, columnHeight, onHeightChange, isSelectionMode, selectedCardIds, onToggleCardSelect }) {
    const columnRef = useRef(null);
    const columnColor = column.color || "#2A00FF";
    const onHeightChangeRef = useRef(onHeightChange);
    const previousHeightRef = useRef(null);

    // Keep the callback ref up to date
    useEffect(() => {
        onHeightChangeRef.current = onHeightChange;
    }, [onHeightChange]);

    // Measure column height
    useLayoutEffect(() => {
        if (!columnRef.current || !onHeightChangeRef.current) return;

        const measureHeight = () => {
            if (columnRef.current && onHeightChangeRef.current) {
                const height = columnRef.current.offsetHeight;
                // Only call onHeightChange if height actually changed
                if (previousHeightRef.current !== height) {
                    previousHeightRef.current = height;
                    onHeightChangeRef.current(column.id, height);
                }
            }
        };

        measureHeight();
        const rafId = requestAnimationFrame(() => {
            measureHeight();
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [cards.length, column.id, isShrunk]);

    useEffect(() => {
        if (!columnRef.current || !onHeightChangeRef.current) return;

        const measureHeight = () => {
            if (columnRef.current && onHeightChangeRef.current) {
                const height = columnRef.current.offsetHeight;
                // Only call onHeightChange if height actually changed
                if (previousHeightRef.current !== height) {
                    previousHeightRef.current = height;
                    onHeightChangeRef.current(column.id, height);
                }
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            measureHeight();
        });

        if (columnRef.current) {
            resizeObserver.observe(columnRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [cards.length, column.id, isShrunk]);

    return (
        <div
            ref={columnRef}
            className="nested-column"
            style={columnHeight ? { minHeight: `${columnHeight}px` } : {}}
        >
            <div
                className="nested-column-header"
                style={{ "--column-color": columnColor }}
            >
                <div className="nested-column-title-wrapper">
                    <h3 className="nested-column-title">{column.title}</h3>
                </div>
            </div>

            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        className={`card-list ${snapshot.isDraggingOver ? "drag-over" : ""}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {cards.map((card, index) => (
                            <CTTaskCard
                                key={card.id}
                                card={card}
                                index={index}
                                setSelectedCard={setSelectedCard}
                                isSelected={selectedCardIds?.has(card.id) ?? false}
                                onToggleSelect={onToggleCardSelect}
                                isSelectionMode={isSelectionMode}
                            />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

// Main Column Component (handles both regular and nested columns)
function Column({ column, cards, setSelectedCard, isExpanded = false, isShrunk = false, onHeaderClick, onContextMenu, columnHeight, onHeightChange, subColumns, subColumnCards, subColumnHeights, isSelectionMode, selectedCardIds, onToggleCardSelect }) {
    const columnRef = useRef(null);
    const columnColor = column.color || "#2A00FF";
    const isNestedColumn = column.isNested || (subColumns && subColumns.length > 0);
    const onHeightChangeRef = useRef(onHeightChange);
    const previousHeightRef = useRef(null);

    const displayTitle = isShrunk && column.title.length > 8
        ? column.title.substring(0, 5) + "..."
        : column.title;
    const tooltipId = `column-title-${column.id}`;

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (onContextMenu) {
            onContextMenu(e, column);
        }
    };

    // Keep the callback ref up to date
    useEffect(() => {
        onHeightChangeRef.current = onHeightChange;
    }, [onHeightChange]);

    // Measure column height
    useLayoutEffect(() => {
        if (!columnRef.current || !onHeightChangeRef.current) return;

        const measureHeight = () => {
            if (columnRef.current && onHeightChangeRef.current) {
                const height = columnRef.current.offsetHeight;
                // Only call onHeightChange if height actually changed
                if (previousHeightRef.current !== height) {
                    previousHeightRef.current = height;
                    onHeightChangeRef.current(column.id, height);
                }
            }
        };

        measureHeight();
        const rafId = requestAnimationFrame(() => {
            measureHeight();
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [cards.length, column.id, isExpanded, isShrunk, subColumns]);

    useEffect(() => {
        if (!columnRef.current || !onHeightChangeRef.current) return;

        const measureHeight = () => {
            if (columnRef.current && onHeightChangeRef.current) {
                const height = columnRef.current.offsetHeight;
                // Only call onHeightChange if height actually changed
                if (previousHeightRef.current !== height) {
                    previousHeightRef.current = height;
                    onHeightChangeRef.current(column.id, height);
                }
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            measureHeight();
        });

        if (columnRef.current) {
            resizeObserver.observe(columnRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [cards.length, column.id, isExpanded, isShrunk, subColumns]);

    // If this is a nested column parent, render nested structure
    if (isNestedColumn && subColumns && subColumns.length > 0) {
        return (
            <div
                ref={columnRef}
                className={`column nested-column-parent ${isExpanded ? 'column-expanded' : ''} ${isShrunk ? 'column-shrunk' : ''}`}
                onContextMenu={handleContextMenu}
                style={columnHeight ? { minHeight: `${columnHeight}px` } : {}}
            >
                <div
                    className="column-header nested-column-parent-header"
                    style={{ "--column-color": columnColor }}
                    onClick={onHeaderClick}
                >
                    <div className="column-left">
                        <h2 className="column-title">{column.title}</h2>
                    </div>
                    <span className="column-count">{cards?.length ?? 0}</span>
                </div>

                <div className="nested-columns-container">
                    {subColumns.map((subCol) => {
                        const subCards = subColumnCards[subCol.id] || [];
                        const subHeight = subColumnHeights[subCol.id];
                        return (
                            <NestedColumn
                                key={subCol.id}
                                column={subCol}
                                cards={subCards}
                                setSelectedCard={setSelectedCard}
                                isShrunk={isShrunk}
                                columnHeight={subHeight}
                                onHeightChange={onHeightChange}
                                isSelectionMode={isSelectionMode}
                                selectedCardIds={selectedCardIds}
                                onToggleCardSelect={onToggleCardSelect}
                            />
                        );
                    })}
                </div>
                <span className="column-count">{cards?.length ?? 0}</span>
            </div>
        );
    }

    // Regular column rendering
    return (
        <div
            ref={columnRef}
            className={`column ${isExpanded ? 'column-expanded' : ''} ${isShrunk ? 'column-shrunk' : ''}`}
            onContextMenu={handleContextMenu}
            style={columnHeight ? { minHeight: `${columnHeight}px` } : {}}
        >
            <div
                className="column-header"
                style={{ "--column-color": columnColor }}
                onClick={onHeaderClick}
            >
                <div className="column-left">
                    {isShrunk && column.title.length > 8 ? (
                        <>
                            <h2
                                className="column-title"
                                data-tooltip-id={tooltipId}
                                data-tooltip-content={column.title}
                            >
                                {displayTitle}
                            </h2>
                            <Tooltip id={tooltipId} place="top" />
                        </>
                    ) : (
                        <h2 className="column-title">{displayTitle}</h2>
                    )}
                </div>
                <span className="column-count">{cards?.length ?? 0}</span>
            </div>

            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        className={`card-list ${snapshot.isDraggingOver ? "drag-over" : ""}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {cards.map((card, index) => (
                            <CTTaskCard
                                key={card.id}
                                card={card}
                                index={index}
                                setSelectedCard={setSelectedCard}
                                isSelected={selectedCardIds?.has(card.id) ?? false}
                                onToggleSelect={onToggleCardSelect}
                                isSelectionMode={isSelectionMode}
                            />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

Column.propTypes = {
    column: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        color: PropTypes.string,
        isNested: PropTypes.bool,
    }).isRequired,
    cards: PropTypes.arrayOf(PropTypes.object).isRequired,
    setSelectedCard: PropTypes.func.isRequired,
    isExpanded: PropTypes.bool,
    isShrunk: PropTypes.bool,
    onHeaderClick: PropTypes.func,
    onContextMenu: PropTypes.func,
    columnHeight: PropTypes.number,
    onHeightChange: PropTypes.func,
    subColumns: PropTypes.array,
    subColumnCards: PropTypes.object,
    subColumnHeights: PropTypes.object,
    isSelectionMode: PropTypes.bool,
    selectedCardIds: PropTypes.instanceOf(Set),
    onToggleCardSelect: PropTypes.func,
};

NestedColumn.propTypes = {
    column: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        color: PropTypes.string,
    }).isRequired,
    cards: PropTypes.arrayOf(PropTypes.object).isRequired,
    setSelectedCard: PropTypes.func.isRequired,
    isShrunk: PropTypes.bool,
    columnHeight: PropTypes.number,
    onHeightChange: PropTypes.func,
    isSelectionMode: PropTypes.bool,
    selectedCardIds: PropTypes.instanceOf(Set),
    onToggleCardSelect: PropTypes.func,
};

export default Column;
