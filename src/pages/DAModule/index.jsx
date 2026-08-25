import { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { KANBAN_DND_DISABLED } from "../../shared/constants/kanbanConfig";
import "../../design/scss/pages/da-module/DAModule.scss";

// Dummy content templates
const dummyContent = [
  {
    title: "Project Alpha",
    description: "Main development project for Q1 2024",
    status: "In Progress",
    assignee: "John Smith",
    priority: "High",
  },
  {
    title: "Task Beta",
    description: "Review and update documentation",
    status: "Pending",
    assignee: "Sarah Johnson",
    priority: "Medium",
  },
  {
    title: "Feature Gamma",
    description: "Implement new user authentication",
    status: "Completed",
    assignee: "Mike Davis",
    priority: "High",
  },
  {
    title: "Bug Fix Delta",
    description: "Resolve login issue on mobile devices",
    status: "In Review",
    assignee: "Emily Wilson",
    priority: "Urgent",
  },
];

// Initial data for DA Module with 4 columns
const createDAModuleData = () => {
  const columns = [
    {
      id: "da-col-1",
      title: "Column 1",
      items: dummyContent.map((content, index) => ({
        id: `col1-item-${index + 1}`,
        ...content,
      })),
      color: "#E2106C", // Pink
    },
    {
      id: "da-col-2",
      title: "Column 2",
      items: dummyContent.map((content, index) => ({
        id: `col2-item-${index + 1}`,
        ...content,
      })),
      color: "#7915BC", // Purple
    },
    {
      id: "da-col-3",
      title: "Column 3",
      items: dummyContent.map((content, index) => ({
        id: `col3-item-${index + 1}`,
        ...content,
      })),
      color: "#3E5EBD", // Blue
    },
    {
      id: "da-col-4",
      title: "Column 4",
      items: dummyContent.map((content, index) => ({
        id: `col4-item-${index + 1}`,
        ...content,
      })),
      color: "#41B24A", // Green
    },
  ];

  return columns;
};

export default function DAModule() {
  const [columns, setColumns] = useState(createDAModuleData());

  const handleDeleteItem = useCallback((columnId, itemId) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === columnId) {
          return {
            ...col,
            items: col.items.filter((item) => item.id !== itemId),
          };
        }
        return col;
      })
    );
  }, []);

  const handleDragEnd = useCallback((result) => {
    const { destination, source } = result;

    // If dropped outside a droppable area, do nothing
    if (!destination) {
      return;
    }

    // If dropped in the same position, do nothing
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Find source and destination columns
    const sourceColumn = columns.find((col) => col.id === source.droppableId);
    const destColumn = columns.find((col) => col.id === destination.droppableId);

    if (!sourceColumn || !destColumn) {
      return;
    }

    // Find the item being moved
    const itemToMove = sourceColumn.items[source.index];
    if (!itemToMove) {
      return;
    }

    // Check if moving within the same column or to a different column
    const isSameColumn = source.droppableId === destination.droppableId;

    // Update columns
    setColumns((prev) =>
      prev.map((col) => {
        if (isSameColumn) {
          // Moving within the same column - reorder items
          if (col.id === source.droppableId) {
            const newItems = Array.from(col.items);
            const [removed] = newItems.splice(source.index, 1);
            newItems.splice(destination.index, 0, removed);
            return {
              ...col,
              items: newItems,
            };
          }
        } else {
          // Moving between different columns
          // Remove item from source column
          if (col.id === source.droppableId) {
            const newItems = Array.from(col.items);
            newItems.splice(source.index, 1);
            return {
              ...col,
              items: newItems,
            };
          }

          // Add item to destination column
          if (col.id === destination.droppableId) {
            const newItems = Array.from(col.items);
            newItems.splice(destination.index, 0, itemToMove);
            return {
              ...col,
              items: newItems,
            };
          }
        }

        return col;
      })
    );
  }, [columns]);

  return (
    <div className="da-module-wrapper">
      {/* Header Section */}
      <div className="da-module-header">
        <div className="da-module-header-content">
          <h1 className="da-module-title">DA Module</h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="da-module-content">
        <DragDropContext onDragEnd={KANBAN_DND_DISABLED ? () => {} : handleDragEnd}>
          <div className="da-module-columns-container">
            {columns.map((column) => (
              <div key={column.id} className="da-module-column">
                {/* Column Header */}
                <div
                  className="da-module-column-header"
                  style={{ borderTopColor: column.color }}
                >
                  <div className="da-module-column-header-left">
                    <div
                      className="da-module-column-indicator"
                      style={{ backgroundColor: column.color }}
                    ></div>
                    <h2 className="da-module-column-title">{column.title}</h2>
                  </div>
                  <div className="da-module-column-count">{column.items.length}</div>
                </div>

                {/* Column Body */}
                <div className="da-module-column-body">
                  {column.items.length === 0 ? (
                    <div className="da-module-empty-state">
                      <p>No items yet</p>
                    </div>
                  ) : (
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`da-module-items-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                        >
                          {column.items.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={item.id}
                              index={index}
                              isDragDisabled={KANBAN_DND_DISABLED}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...(KANBAN_DND_DISABLED ? {} : provided.draggableProps)}
                                  {...(KANBAN_DND_DISABLED ? {} : provided.dragHandleProps)}
                                  className={`da-module-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                  style={KANBAN_DND_DISABLED ? undefined : provided.draggableProps.style}
                                >
                                  <div className="da-module-item-content">
                                    <h3 className="da-module-item-title">{item.title}</h3>
                                    <p className="da-module-item-description">{item.description}</p>
                                    <div className="da-module-item-meta">
                                      <span className={`da-module-item-status status-${item.status.toLowerCase().replace(' ', '-')}`}>
                                        {item.status}
                                      </span>
                                      <span className="da-module-item-separator">•</span>
                                      <span className="da-module-item-assignee">{item.assignee}</span>
                                    </div>
                                    <div className="da-module-item-priority">
                                      <span className={`priority-badge priority-${item.priority.toLowerCase()}`}>
                                        {item.priority}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    className="da-module-item-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteItem(column.id, item.id);
                                    }}
                                    aria-label="Delete item"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
