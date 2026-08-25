// ============================================
// DA DESK WORKFLOW CONFIGURATION
// ============================================
// 'REQUESTED AREA': '#2666be',
// 'IN PROGRESS AREA': '#f38a30',
// 'DONE AREA': '#42af49',
// 'READY TO ARCHIVE AREA': '#7333bd',
const workflowsConfig = [
    {
        id: "main-work-flow-rt",
        title: "Main work flow RT",
        columnColors: {
            "col-1": "#2666be", // Appointment Received - Purple
            "col-2": "#2666be", // Working on it - Purple
            "col-3": "#f38a30", // Awaiting PO - Purple
            "col-4": "#f38a30", // Al Gihaz awaiting submission - Blue
            "col-5": "#f38a30", // Finalized - Green
            "col-6": "#f38a30", // Awaiting acknowledgment - Brown
            "col-7": "#42af49", // Dispatched - Orange
            "col-8": "#42af49", // In Client System - Orange
            "col-9": "#7333bd", // Ready To Archive - Orange

        },
        columnTitles: [
            "Appointment Received",
            "Enroute",
            "Ops In Progress",
            "Ops Completed",
            "Ready To Finalize",
            "Awaiting on client",
            "Dispatched",
            "In Client System",
            "Ready To Archive",
        ],
        // // Nested columns for In Progress
        // nestedColumns: {
        //     "col-4": [
        //         { id: "col-2-1", title: "Working on it", color: "rgb(121 21 188)" },
        //         { id: "col-2-2", title: "Awaiting PO", color: "rgb(121 21 188)" },
        //     ],
        // },
        cardCounts: {
            "col-1": 0, // Appointment Received
            "col-2": 0, // Enroute
            "col-3": 0, // Ops In Progress
            "col-4": 0, // Ops Completed
            "col-5": 0, // Ready To Finalize
            "col-6": 0, // Awaiting on client
            "col-7": 0, // Dispatched
            "col-8": 0, // In Client System
            "col-9": 0, // Ready To Archive
        },
    },
    {
        id: "import-export-rt",
        title: "Import Export RT",
        columnColors: {
            "col-1": "#f38a30", // Ready to Finalize - Pink
            "col-2": "#f38a30", // In Progress - Purple
            "col-3": "#f38a30", // Al Gihaz awaiting submission - Blue
            "col-4": "#f38a30", // Finalized - Green
            "col-5": "#f38a30", // Awaiting acknowledgment - Brown
            "col-6": "#f38a30", // Dispatched - Orange
            "col-7": "#f38a30", // In Client System - Orange
            "col-8": "#42af49", // Ready To Archive - Orange
            "col-9": "#42af49", // Ready To Archive - Orange
        },
        columnTitles: [
            "Arrived",
            "Cleared",
            "Inward Completed",
            "MWP Applied",
            "MWP Issued",
            "Outward Clearance",
            "Sailed",
            "Ops Completed",
            "DA Rejected",
        ],
        // No nested columns - explicitly normal columns only
        nestedColumns: {},
        cardCounts: {
            "col-1": 0,
            "col-2": 0,
            "col-3": 0,
            "col-4": 0,
            "col-5": 0,
            "col-6": 0,
            "col-7": 0,
            "col-8": 0,
            "col-9": 0,
        },
    },
    {
        id: "husbandry-rt",
        title: "Husbandry RT",
        columnColors: {
            "col-1": "#2666be", // Requested - Pink
            "col-2": "#f38a30", // Service In Progress - Purple
            "col-3": "#f38a30", // Service In Progress - Blue
            "col-4": "#42af49", // Done - Green
            "col-5": "#7333bd", // Ready To Archive - Brown
        },
        columnTitles: [
            "Requested",
            "Service In Progress",
            "Service Completed",
            "Done",
            "Ready To Archive",
        ],
        // No nested columns - explicitly normal columns only
        nestedColumns: {},
        cardCounts: {
            "col-1": 0,
            "col-2": 0,
            "col-3": 0,
            "col-4": 0,
            "col-5": 0,
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

// Helper function to generate a single card
const generateCard = (workflowId, colId, cardId) => {
    const workflow = workflowsConfig.find((w) => w.id === workflowId);
    const colorPool = Object.values(workflow.columnColors);

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
