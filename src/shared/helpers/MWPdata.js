// ============================================
// RAS TANURA DAMMAM OPERATIONS WORKFLOW CONFIGURATION
// ============================================

const workflowsConfig = [
    {
        id: "maintenance-work-permit",
        title: "Maintenance Work Permit",
        columnColors: {
            "col-1": "rgb(226 16 108)", // Documents ready - Pink
            "col-2": "rgb(121 21 188)", // In Progress - Purple
            "col-3": "rgb(62 94 189)", // Approved - Blue
            "col-4": "rgb(65 178 74)", // Issued - Green

        },
        columnTitles: [
            "Documents ready", // Documents ready
            "Applied", // Applied
            "Approved", // Approved
            "Issued", // Issued
        ],
        nestedColumns: {},
        cardCounts: {
            "col-1": 0,// Documents ready
            "col-2": 2, // Applied
            "col-3": 3, // Approved
            "col-4": 0, // Issued
        },
    },
];

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

    // Footer status icons: random subset per card (1–5 icons, including link)
    const footerIconKeys = ["priority", "subtasks", "deadline", "watchers", "link"];
    const footerIconCount = Math.floor(Math.random() * 5) + 1; // 1, 2, 3, 4, or 5
    const shuffledKeys = [...footerIconKeys].sort(() => Math.random() - 0.5);
    const footerShowIcons = shuffledKeys.slice(0, footerIconCount);

    // MWP-specific dummy values
    const appNo = `MWP-${2024 + Math.floor(Math.random() * 2)}-${String(cardId).padStart(4, '0')}`;
    const baseDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const formatDate = (d) => d.toISOString().split('T')[0];
    const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

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
        // MWP card form fields
        applicationNo: appNo,
        applicationSubmittedDate: formatDate(baseDate),
        applicationSubmittedTime: formatTime(baseDate),
        sadadNo: `SADAD-${Math.floor(100000 + Math.random() * 900000)}`,
        approvedDate: formatDate(addDays(baseDate, 3)),
        approvedTime: formatTime(addDays(baseDate, 3)),
        issuedDate: formatDate(addDays(baseDate, 5)),
        issuedTime: formatTime(addDays(baseDate, 5)),
        mwpCopy: [{ name: "mwp_copy.pdf", size: 1024000 }],
        expiryDate: formatDate(addDays(baseDate, 365)),
        expiryTime: "23:59",
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
