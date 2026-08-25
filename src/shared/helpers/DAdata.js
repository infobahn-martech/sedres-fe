// ============================================
// DA DESK WORKFLOW CONFIGURATION
// ============================================

const workflowsConfig = [
  {
    id: "da-desk-workflow",
    title: "RT-DA Board",
    columnColors: {
      "col-1": "#2666be", // Ready to Finalize - Pink
      "col-2": "#f38a30", // In Progress - Purple
      "col-2-1": "rgb(121 21 188)", // Working on it - Purple
      "col-2-2": "rgb(121 21 188)", // Awaiting PO - Purple
      "col-3": "#42af49", // Al Gihaz awaiting submission - Blue
      "col-4": "#42af49", // Finalized - Green
      "col-5": "#42af49", // Awaiting acknowledgment - Brown
      "col-6": "#42af49", // Dispatched - Orange
    },
    columnTitles: [
      "Ready to Finalize",
      "In Progress",
      "Al Gihaz awaiting submission",
      "Finalized",
      "Awaiting acknowledgment",
      "Dispatched",
    ],
    // Nested columns for In Progress
    nestedColumns: {
      "col-2": [
        { id: "col-2-1", title: "Working on it", color: "rgb(121 21 188)" },
        { id: "col-2-2", title: "Awaiting PO", color: "rgb(121 21 188)" },
      ],
    },
    cardCounts: {
      "col-1": 18, // Ready to Finalize
      "col-2": 179, // In Progress (total)
      "col-2-1": 18, // Working on it - increased to match Ready to Finalize
      "col-2-2": 18, // Awaiting PO - increased to match Ready to Finalize
      "col-3": 18, // Al Gihaz awaiting submission
      "col-4": 18, // Finalized
      "col-5": 18, // Awaiting acknowledgment
      "col-6": 18, // Dispatched
    },
  },
  {
    id: "jub-da-board",
    title: "JUB-DA Board",
    columnColors: {
      "col-1": "#2666be", // Ready to Finalize - Pink
      "col-2": "#f38a30", // In Progress - Purple
      "col-3": "#42af49", // Al Gihaz awaiting submission - Blue
      "col-4": "#42af49", // Finalized - Green
      "col-5": "#42af49", // Awaiting acknowledgment - Brown
      "col-6": "#42af49", // Dispatched - Orange
    },
    columnTitles: [
      "Ready to Finalize",
      "In Progress",
      "Al Gihaz awaiting submission",
      "Finalized",
      "Awaiting acknowledgment",
      "Dispatched",
    ],
    // No nested columns - explicitly normal columns only
    nestedColumns: {},
    cardCounts: {
      "col-1": 10,
      "col-2": 10,
      "col-3": 10,
      "col-4": 10,
      "col-5": 10,
      "col-6": 10,
    },
  },
];

// Footer status icons: random subset per card (1–5 icons, including link)
const footerIconKeys = ["priority", "subtasks", "deadline", "watchers", "link"];
const footerIconCount = Math.floor(Math.random() * 5) + 1; // 1, 2, 3, 4, or 5
const shuffledKeys = [...footerIconKeys].sort(() => Math.random() - 0.5);
const footerShowIcons = shuffledKeys.slice(0, footerIconCount);

// ============================================
// HELPER FUNCTIONS
// ============================================


// Icon pool
const iconTypes = ["inprogress", "download", "document"];

const colorOptions = [
  "#34a97b",
  "#7333bd",
  "#e6186a",
  "#f37325",
  "#af0020",
  "#607d8b",
  "#336633",]

// Helper function to generate a single card
const generateCard = (workflowId, colId, cardId) => {
  const colorPool = Object.values(colorOptions);

  // Random color
  const randomColor = colorPool[Math.floor(Math.random() * colorPool.length)];

  // Random icon assigned permanently
  const randomIconType = iconTypes[Math.floor(Math.random() * iconTypes.length)];

  const id = `${workflowId}-card-${cardId}`;

  const customerNames = [
    "Gulf Marine",
    "Saudi Marcap",
    "Snamprogetti",
    "Saipem",
    "Lamprell"
  ];
  const vesselNames = [
    "MV Atlantic Star",
    "SS Pacific Wave",
    "MV Indian Ocean",
    "SS Mediterranean",
    "MV Caribbean Breeze",
    "MV Ocean Express",
    "SS Blue Horizon",
    "MV Sea Voyager",
    "SS Trade Wind",
    "MV Golden Gate",
    "SS Northern Star",
    "MV Southern Cross",
    "SS Eastern Dawn",
    "MV Western Tide",
    "SS Central Bay",
  ];
  const drivers = [
    "John Smith",
    "Michael Johnson",
    "David Williams",
    "Robert Brown",
    "James Davis",
    "William Miller",
    "Richard Wilson",
    "Joseph Moore",
    "Thomas Taylor",
    "Christopher Anderson",
    "Daniel Martinez",
    "Matthew Jackson",
    "Anthony White",
    "Mark Harris",
    "Donald Clark",
  ];

  const cardData = {
    id,
    title: `CARD – ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG"][
      Math.floor(Math.random() * 8)
    ]} ${2025 + Math.floor(Math.random() * 2)}`,
    name: customerNames[Math.floor(Math.random() * customerNames.length)],
    user: drivers[Math.floor(Math.random() * drivers.length)],
    timeLeft: `${Math.floor(Math.random() * 90)}d ${Math.floor(Math.random() * 24)}h ${Math.floor(
      Math.random() * 60
    )}m`,
    progress: Math.floor(Math.random() * 100),
    color: randomColor,
    iconType: randomIconType,
    priority: false, // No blinking for DA cards
    vesselName: vesselNames[Math.floor(Math.random() * vesselNames.length)],
    transport: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    transportCount: Math.floor(Math.random() * 5) + 1,
    hotel: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    hotelCount: Math.floor(Math.random() * 5) + 1,
    medicalService: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    medicalServiceCount: Math.floor(Math.random() * 5) + 1,
    footerShowIcons: footerShowIcons,
    // Invoice amount in SAR (range: 20k–250k so some cards exceed 100k)
    invoiceAmount: Math.floor(Math.random() * 230000) + 20000,
  };

  return { id, cardData };
};

// Helper function to create a workflow
const createWorkflow = (workflowConfig) => {
  const { id, columnColors, columnTitles, cardCounts, nestedColumns } = workflowConfig;
  const columns = {};
  const cards = {};
  let cardId = 1;

  // Initialize all columns first
  for (let i = 0; i < columnTitles.length; i++) {
    const colId = `col-${i + 1}`;
    const isNestedColumn = nestedColumns && nestedColumns[colId];

    if (isNestedColumn) {
      // Create parent column for nested structure
      columns[colId] = {
        id: `${id}-${colId}`,
        title: columnTitles[i],
        cardIds: [],
        color: columnColors[colId],
        isNested: true,
        subColumns: [],
      };

      // Create sub-columns
      isNestedColumn.forEach((subCol) => {
        const subColumnId = subCol.id;
        const subColumn = {
          id: `${id}-${subColumnId}`,
          title: subCol.title,
          cardIds: [],
          color: subCol.color,
          parentColumnId: `${id}-${colId}`,
        };
        columns[subColumnId] = subColumn;
        columns[colId].subColumns.push(subColumnId);
      });
    } else {
      columns[colId] = {
        id: `${id}-${colId}`,
        title: columnTitles[i],
        cardIds: [],
        color: columnColors[colId],
        isNested: false,
      };
    }
  }

  // Create cards for each column/sub-column based on cardCounts
  for (const colId in cardCounts) {
    const count = cardCounts[colId];

    // Skip parent nested column's card count (we use sub-column counts)
    if (columns[colId] && columns[colId].isNested) {
      continue;
    }

    // Ensure column exists and has cardIds array
    if (!columns[colId]) {
      continue;
    }

    // Ensure cardIds is initialized as an array
    if (!Array.isArray(columns[colId].cardIds)) {
      columns[colId].cardIds = [];
    }

    // Generate cards for this column/sub-column
    for (let i = 0; i < count; i++) {
      const { id: generatedCardId, cardData } = generateCard(id, colId, cardId);
      cards[generatedCardId] = cardData;
      columns[colId].cardIds.push(generatedCardId);
      cardId++;
    }
  }

  // Build columnOrder - keep parent columns in order, sub-columns are handled separately
  const columnOrder = [];
  for (let i = 0; i < columnTitles.length; i++) {
    const colId = `col-${i + 1}`;
    const column = columns[colId];

    if (column && column.isNested) {
      // For nested columns, add parent column id (we'll render sub-columns inside)
      columnOrder.push(colId);
    } else {
      columnOrder.push(colId);
    }
  }

  // Mark first generated card (Ready to Finalize, first in insertion order) for invoice trend UI only
  const allCardIds = Object.keys(cards);
  if (allCardIds.length > 0) {
    cards[allCardIds[0]].highlightInvoice = true;
  }

  return {
    id,
    title: workflowConfig.title,
    columns,
    columnOrder,
    cards,
    nestedColumns: nestedColumns || {},
  };
};

// Generate all workflows
const workflows = workflowsConfig.map(createWorkflow);

// Export initial data as an array of workflows
export const initialData = workflows;

// Export workflows config for easy modification
export { workflowsConfig };
