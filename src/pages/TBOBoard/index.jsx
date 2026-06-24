import { useState, useCallback, useMemo, useEffect } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { KANBAN_DND_DISABLED } from "../../shared/constants/kanbanConfig";
import { FiLayers } from "react-icons/fi";
import { initialData } from "../../shared/helpers/TBOdata";
import Column from "./Column";
import CardForm from "../KanbanBoard/components/cards/CardForm";
import ContextMenu from "../KanbanBoard/components/menus/ContextMenu";
import AccordionMenu from "../KanbanBoard/components/menus/AccordionMenu";
import Workspaces from "../Workspaces";
import "../../design/scss/common.scss";
import useSyncKanbanSidebarWorkflows from "../../shared/hooks/useSyncKanbanSidebarWorkflows";
import useKanbanAddCardFromSidebar from "../../shared/hooks/useKanbanAddCardFromSidebar";
import { getAddModeCardFormWorkflow } from "../../shared/helpers/kanbanSidebarWorkflow";

export default function TBOBoard() {
  const [workflows, setWorkflows] = useState(initialData);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [addTargetWorkflowId, setAddTargetWorkflowId] = useState(null);

  // Track expanded state for each workflow
  const [expandedWorkflows, setExpandedWorkflows] = useState(() => {
    const state = {};
    initialData.forEach(workflow => {
      state[workflow.id] = true; // All workflows expanded by default
    });
    return state;
  });

  // Track pinned workflows
  const [pinnedWorkflows, setPinnedWorkflows] = useState(() => {
    const state = {};
    initialData.forEach(workflow => {
      state[workflow.id] = false;
    });
    return state;
  });

  // Track expanded column for each workflow
  const [expandedColumns, setExpandedColumns] = useState(() => {
    const state = {};
    initialData.forEach(workflow => {
      state[workflow.id] = null;
    });
    return state;
  });

  // Control expand/shrink functionality
  const [enableExpandShrink, setEnableExpandShrink] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuColumn, setContextMenuColumn] = useState(null);

  // Accordion menu state
  const [accordionMenu, setAccordionMenu] = useState(null);
  const [accordionMenuWorkflowId, setAccordionMenuWorkflowId] = useState(null);

  // Track column heights per workflow
  const [columnHeights, setColumnHeights] = useState(() => {
    const state = {};
    initialData.forEach(workflow => {
      state[workflow.id] = {};
    });
    return state;
  });

  // Track max height per workflow
  const [maxColumnHeights, setMaxColumnHeights] = useState(() => {
    const state = {};
    initialData.forEach(workflow => {
      state[workflow.id] = 0;
    });
    return state;
  });

  const handleSelectCard = useCallback(card => {
    setSelectedCard(card);
    setIsAddMode(false);
    setAddTargetWorkflowId(null);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedCard(null);
    setIsAddMode(false);
    setAddTargetWorkflowId(null);
  }, []);

  // Set loading to false after component mounts
  useEffect(() => {
    // Simulate loading time for board initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useSyncKanbanSidebarWorkflows(workflows);
  useKanbanAddCardFromSidebar({ setSelectedCard, setIsAddMode, setAddTargetWorkflowId });

  // Listen for add card event from SideNav
  useEffect(() => {
    const handleShowWorkspaces = () => {
      setShowWorkspaces(true);
    };

    const handleHideWorkspaces = () => {
      setShowWorkspaces(false);
    };

    window.addEventListener('kanban:show-workspaces', handleShowWorkspaces);
    window.addEventListener('kanban:hide-workspaces', handleHideWorkspaces);
    return () => {
      window.removeEventListener('kanban:show-workspaces', handleShowWorkspaces);
      window.removeEventListener('kanban:hide-workspaces', handleHideWorkspaces);
    };
  }, []);

  // Find which column contains a specific card
  const findCardColumn = useCallback((cardId) => {
    for (const workflow of workflows) {
      for (const colId of workflow.columnOrder) {
        const column = workflow.columns[colId];
        if (column && column.cardIds.includes(cardId)) {
          return column;
        }
      }
    }
    return null;
  }, [workflows]);

  // Move card to a specific column by column ID
  const moveCardToColumn = useCallback((cardId, targetColumnId) => {
    const sourceColumn = findCardColumn(cardId);
    if (!sourceColumn) return;

    let sourceWorkflowIndex = -1;
    let sourceColumnKey = null;
    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];
      const foundKey = Object.keys(workflow.columns).find(key => workflow.columns[key].id === sourceColumn.id);
      if (foundKey) {
        sourceWorkflowIndex = i;
        sourceColumnKey = foundKey;
        break;
      }
    }

    let targetColumn = null;
    let targetWorkflowIndex = -1;
    let targetColumnKey = null;

    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];
      const foundColumn = Object.values(workflow.columns).find(col => col.id === targetColumnId);
      if (foundColumn) {
        targetColumn = foundColumn;
        targetWorkflowIndex = i;
        targetColumnKey = Object.keys(workflow.columns).find(key => workflow.columns[key].id === targetColumnId);
        break;
      }
    }

    if (!targetColumn || targetWorkflowIndex === -1 || !targetColumnKey || sourceWorkflowIndex === -1 || !sourceColumnKey) return;
    if (sourceColumn.id === targetColumnId) return;

    const startCardIds = Array.from(sourceColumn.cardIds);
    const cardIndex = startCardIds.indexOf(cardId);
    if (cardIndex === -1) return;

    startCardIds.splice(cardIndex, 1);
    const newStart = { ...sourceColumn, cardIds: startCardIds };

    const finishCardIds = Array.from(targetColumn.cardIds);
    finishCardIds.unshift(cardId);
    const newFinish = { ...targetColumn, cardIds: finishCardIds };

    setWorkflows(prevWorkflows => {
      const updated = [...prevWorkflows];

      if (sourceWorkflowIndex === targetWorkflowIndex) {
        updated[sourceWorkflowIndex] = {
          ...updated[sourceWorkflowIndex],
          columns: {
            ...updated[sourceWorkflowIndex].columns,
            [sourceColumnKey]: newStart,
            [targetColumnKey]: newFinish,
          },
        };
      } else {
        updated[sourceWorkflowIndex] = {
          ...updated[sourceWorkflowIndex],
          columns: {
            ...updated[sourceWorkflowIndex].columns,
            [sourceColumnKey]: newStart,
          },
        };
        updated[targetWorkflowIndex] = {
          ...updated[targetWorkflowIndex],
          columns: {
            ...updated[targetWorkflowIndex].columns,
            [targetColumnKey]: newFinish,
          },
        };
      }
      return updated;
    });
  }, [workflows, findCardColumn]);

  // Create drag end handler for a specific workflow
  const createDragEndHandler = useCallback((workflowId) => {
    return (result) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return;

      const start = Object.values(workflow.columns).find(col => col.id === source.droppableId);
      const finish = Object.values(workflow.columns).find(col => col.id === destination.droppableId);

      if (!start || !finish) return;

      if (start === finish) {
        const newCardIds = Array.from(start.cardIds);
        newCardIds.splice(source.index, 1);
        newCardIds.splice(destination.index, 0, draggableId);

        const newColumn = { ...start, cardIds: newCardIds };
        const columnKey = Object.keys(workflow.columns).find(key => workflow.columns[key].id === newColumn.id);

        setWorkflows(prevWorkflows =>
          prevWorkflows.map(w =>
            w.id === workflowId
              ? { ...w, columns: { ...w.columns, [columnKey]: newColumn } }
              : w
          )
        );
        return;
      }

      const startCardIds = Array.from(start.cardIds);
      startCardIds.splice(source.index, 1);
      const newStart = { ...start, cardIds: startCardIds };

      const finishCardIds = Array.from(finish.cardIds);
      finishCardIds.splice(destination.index, 0, draggableId);
      const newFinish = { ...finish, cardIds: finishCardIds };

      const startColumnKey = Object.keys(workflow.columns).find(key => workflow.columns[key].id === newStart.id);
      const finishColumnKey = Object.keys(workflow.columns).find(key => workflow.columns[key].id === newFinish.id);

      setWorkflows(prevWorkflows =>
        prevWorkflows.map(w =>
          w.id === workflowId
            ? { ...w, columns: { ...w.columns, [startColumnKey]: newStart, [finishColumnKey]: newFinish } }
            : w
        )
      );
    };
  }, [workflows]);

  // Toggle workflow expansion
  const toggleWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [workflowId]: !prev[workflowId]
    }));
  }, []);

  // Expand/collapse workflow
  const expandWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [workflowId]: true
    }));
  }, []);

  const collapseWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [workflowId]: false
    }));
  }, []);

  // Handle accordion menu
  const handleAccordionMenuClick = useCallback((e, workflowId) => {
    e.stopPropagation();
    setAccordionMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setAccordionMenuWorkflowId(workflowId);
  }, []);

  const handleCloseAccordionMenu = useCallback(() => {
    setAccordionMenu(null);
    setAccordionMenuWorkflowId(null);
  }, []);

  const reorderWorkflows = useCallback((pinState, currentWorkflows) => {
    const pinned = currentWorkflows.filter(w => pinState[w.id]);
    const unpinned = currentWorkflows.filter(w => !pinState[w.id]);
    return [...pinned, ...unpinned];
  }, []);

  const handleAccordionExpand = useCallback(() => {
    if (accordionMenuWorkflowId) {
      expandWorkflow(accordionMenuWorkflowId);
    }
  }, [accordionMenuWorkflowId, expandWorkflow]);

  const handleAccordionCollapse = useCallback(() => {
    if (accordionMenuWorkflowId) {
      collapseWorkflow(accordionMenuWorkflowId);
    }
  }, [accordionMenuWorkflowId, collapseWorkflow]);

  const handleTogglePin = useCallback(() => {
    if (!accordionMenuWorkflowId) return;

    setPinnedWorkflows(prev => {
      const updated = {
        ...prev,
        [accordionMenuWorkflowId]: !prev[accordionMenuWorkflowId]
      };
      setWorkflows(prevWorkflows => reorderWorkflows(updated, prevWorkflows));
      return updated;
    });

    handleCloseAccordionMenu();
  }, [accordionMenuWorkflowId, reorderWorkflows, handleCloseAccordionMenu]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (accordionMenu) {
        handleCloseAccordionMenu();
      }
    };

    if (accordionMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [accordionMenu, handleCloseAccordionMenu]);

  // Handle column header click
  const handleColumnHeaderClick = useCallback((workflowId, columnId) => {
    if (!enableExpandShrink) return; // Disable functionality when false
    setExpandedColumns(prev => {
      const currentExpanded = prev[workflowId];
      return {
        ...prev,
        [workflowId]: currentExpanded === columnId ? null : columnId
      };
    });
  }, [enableExpandShrink]);

  // Handle column context menu
  const handleColumnContextMenu = useCallback((e, column) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setContextMenuColumn(column);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuColumn(null);
  }, []);

  const handleCreateCard = useCallback(() => {
    const newCard = {
      id: `new-${Date.now()}`,
      title: '',
      color: contextMenuColumn?.color || '#2A00FF',
    };
    setSelectedCard(newCard);
    setIsAddMode(true);
    setAddTargetWorkflowId(null);
  }, [contextMenuColumn]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu, handleCloseContextMenu]);

  // Handle column height change
  const handleColumnHeightChange = useCallback((columnId, height) => {
    const workflow = workflows.find(w =>
      Object.values(w.columns).some(col => col.id === columnId)
    );

    if (!workflow) return;

    setColumnHeights(prev => {
      const newHeights = {
        ...prev,
        [workflow.id]: {
          ...prev[workflow.id],
          [columnId]: height
        }
      };

      const heights = Object.values(newHeights[workflow.id]);
      const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;

      setMaxColumnHeights(prevMax => {
        if (prevMax[workflow.id] === maxHeight) {
          return prevMax;
        }
        return {
          ...prevMax,
          [workflow.id]: maxHeight
        };
      });

      return newHeights;
    });
  }, [workflows]);

  // Render columns for a workflow - with nested column support
  const renderWorkflowColumns = useCallback((workflow) => {
    const expandedColumnId = expandedColumns[workflow.id];
    const maxHeight = maxColumnHeights[workflow.id] || 0;
    const columnHeightsForWorkflow = columnHeights[workflow.id] || {};

    // Build column order - handle nested columns
    const columnsToRender = [];

    for (let i = 0; i < workflow.columnOrder.length; i++) {
      const colId = workflow.columnOrder[i];
      const column = workflow.columns[colId];

      if (!column) continue;

      // Check if this is a sub-column (belongs to a nested parent)
      const isSubColumn = column.parentColumnId;

      if (isSubColumn) {
        // Skip sub-columns - they'll be rendered within their parent
        continue;
      }

      // Check if this is a nested parent column
      if (column.isNested && column.subColumns && column.subColumns.length > 0) {
        // Render nested column parent with sub-columns
        const subColumns = column.subColumns.map(subColId => {
          const subCol = workflow.columns[subColId];
          return subCol;
        }).filter(Boolean);

        const subColumnCards = {};
        subColumns.forEach(subCol => {
          if (subCol) {
            // Ensure cardIds exists and is an array
            const cardIds = Array.isArray(subCol.cardIds) ? subCol.cardIds : [];
            // Map card IDs to actual card objects from workflow.cards
            const cardsForSubCol = cardIds
              .map(id => {
                const card = workflow.cards && workflow.cards[id] ? workflow.cards[id] : null;
                return card;
              })
              .filter(Boolean);
            subColumnCards[subCol.id] = cardsForSubCol;
          } else {
            // Initialize empty array if sub-column not found
            subColumnCards[subCol?.id] = [];
          }
        });

        const subColumnHeights = {};
        subColumns.forEach(subCol => {
          if (subCol) {
            subColumnHeights[subCol.id] = columnHeightsForWorkflow[subCol.id];
          }
        });

        columnsToRender.push({
          type: 'nested',
          column: column,
          subColumns,
          subColumnCards,
          subColumnHeights,
        });
      } else {
        // Regular column
        columnsToRender.push({
          type: 'regular',
          column,
          cards: column.cardIds.map(id => workflow.cards[id]).filter(Boolean),
        });
      }
    }

    return columnsToRender.map((item, index) => {
      if (item.type === 'nested') {
        const isExpanded = expandedColumnId === item.column.id;
        const isShrunk = expandedColumnId !== null && expandedColumnId !== item.column.id;
        return (
          <Column
            key={item.column.id}
            column={item.column}
            cards={[]}
            setSelectedCard={handleSelectCard}
            isExpanded={isExpanded}
            isShrunk={isShrunk}
            onHeaderClick={() => handleColumnHeaderClick(workflow.id, item.column.id)}
            onContextMenu={handleColumnContextMenu}
            columnHeight={maxHeight > 0 ? maxHeight : undefined}
            onHeightChange={handleColumnHeightChange}
            subColumns={item.subColumns}
            subColumnCards={item.subColumnCards}
            subColumnHeights={item.subColumnHeights}
          />
        );
      } else {
        const isExpanded = expandedColumnId === item.column.id;
        const isShrunk = expandedColumnId !== null && expandedColumnId !== item.column.id;
        return (
          <Column
            key={item.column.id}
            column={item.column}
            cards={item.cards}
            setSelectedCard={handleSelectCard}
            isExpanded={isExpanded}
            isShrunk={isShrunk}
            onHeaderClick={() => handleColumnHeaderClick(workflow.id, item.column.id)}
            onContextMenu={handleColumnContextMenu}
            columnHeight={maxHeight > 0 ? maxHeight : undefined}
            onHeightChange={handleColumnHeightChange}
          />
        );
      }
    });
  }, [handleSelectCard, expandedColumns, handleColumnHeaderClick, handleColumnContextMenu, maxColumnHeights, columnHeights, handleColumnHeightChange]);

  // Show Workspaces view when Workspaces icon is clicked
  if (showWorkspaces) {
    return <Workspaces />;
  }

  const getSelectedCardWorkflow = useCallback(() => {
    if (!selectedCard) return null;
    return workflows.find(workflow =>
      Object.values(workflow.cards).some(card => card.id === selectedCard.id)
    );
  }, [selectedCard, workflows]);

  const selectedCardWorkflow = getSelectedCardWorkflow();

  const addModeCardWorkflow = useMemo(
    () => getAddModeCardFormWorkflow(workflows, isAddMode, selectedCardWorkflow, addTargetWorkflowId),
    [workflows, isAddMode, selectedCardWorkflow, addTargetWorkflowId]
  );

  const columnsForCardForm = addModeCardWorkflow?.columns;
  const columnOrderForCardForm = addModeCardWorkflow?.columnOrder;

  if (isLoading) {
    return (
      <div className="page-loader-overlay">
        <div className="page-loader-content">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {workflows.map((workflow) => (
        <div key={workflow.id} className="kanban-accordion">
          <div
            className="kanban-accordion-header"
            onClick={() => toggleWorkflow(workflow.id)}
          >
            <div className="kanban-accordion-title-row">
              <FiLayers className="kanban-accordion-title-icon" aria-hidden />
              <h2 className="kanban-accordion-title">{workflow.title}</h2>
            </div>
            <div className="kanban-accordion-actions">
              <button
                className="accordion-menu-button"
                onClick={(e) => handleAccordionMenuClick(e, workflow.id)}
                aria-label="Menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="4.5" r="1.5" fill="currentColor" />
                  <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="9" cy="13.5" r="1.5" fill="currentColor" />
                </svg>
              </button>
              <span className={`kanban-accordion-icon ${expandedWorkflows[workflow.id] ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
          </div>

          {expandedWorkflows[workflow.id] && (
            <div className="kanban-container">
              <DragDropContext onDragEnd={KANBAN_DND_DISABLED ? () => {} : createDragEndHandler(workflow.id)}>
                <div className="kanban-board">
                  {renderWorkflowColumns(workflow)}
                </div>
              </DragDropContext>
            </div>
          )}
        </div>
      ))}

      {selectedCard && columnsForCardForm && (
        <CardForm
          show={true}
          close={handleCloseCard}
          card={{ ...selectedCard, crew: [] }}
          moveCardToColumn={moveCardToColumn}
          columns={columnsForCardForm}
          columnOrder={columnOrderForCardForm}
          currentColumn={isAddMode ? null : findCardColumn(selectedCard.id)}
          isAddMode={isAddMode}
          variant="taxi-boat"
        />
      )}

      <ContextMenu
        position={contextMenu}
        onClose={handleCloseContextMenu}
        onCreateCard={handleCreateCard}
      />

      <AccordionMenu
        position={accordionMenu}
        onClose={handleCloseAccordionMenu}
        onExpand={handleAccordionExpand}
        onCollapse={handleAccordionCollapse}
        isExpanded={accordionMenuWorkflowId ? expandedWorkflows[accordionMenuWorkflowId] : false}
        isPinned={accordionMenuWorkflowId ? pinnedWorkflows[accordionMenuWorkflowId] : false}
        onTogglePin={handleTogglePin}
      />
    </>
  );
}
