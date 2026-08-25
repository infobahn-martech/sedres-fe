/**
 * Static / mock Kanban workflows for `/kanban-board/operator` only.
 * Preserves the pre–API-refactor authoring + `normalizeWorkflowFromApi` pipeline.
 */

import { normalizeWorkflowFromApi } from "./data";

const DEFAULT_CARDS_PER_ROW = 2;

const workflowsConfig = [
  {
    id: "workflow-1",
    title: "TEST",
    columns: [
      { key: "col-1", title: "Appointment Received", color: "#2666be", wipLimit: 25, cardsPerRow: 4 },
      { key: "col-2", title: "Enroute", color: "#2666be", wipLimit: 25 },
      { key: "col-3", title: "Vessel Arrived", color: "#f38a30", wipLimit: 25 },
      { key: "col-4", title: "Vessel Cleared", color: "#f38a30", wipLimit: 25 },
      { key: "col-5", title: "Vessel on Standby", color: "#f38a30", wipLimit: 25 },
      { key: "col-6", title: "Vessel Sailed", color: "#f38a30", wipLimit: 25 },
      { key: "col-7", title: "Ready to Fianalize", color: "#42af49", wipLimit: 25 },
    ],
    cardCounts: {
      "col-1": 6,
      "col-2": 4,
      "col-3": 0,
      "col-4": 0,
      "col-5": 0,
      "col-6": 0,
      "col-7": 0,
    },
  },
  {
    id: "workflow-2",
    title: "Cards workflow 2",
    onlyDefaultSwimlane: true,
    columns: [
      { key: "col-1", title: "Appointment Received", color: "#2666be", wipLimit: 20 },
      { key: "col-2", title: "Enroute", color: "#2666be", wipLimit: 20 },
      { key: "col-3", title: "Vessel Arrived", color: "#f38a30", wipLimit: 20 },
      { key: "col-4", title: "Vessel Cleared", color: "#f38a30", wipLimit: 20 },
      { key: "col-5", title: "Vessel Sailed", color: "#f38a30", wipLimit: 20 },
      { key: "col-6", title: "Ready to Fianalize", color: "#42af49", wipLimit: 20 },
    ],
    cardCounts: {
      "col-1": 1,
      "col-2": 0,
      "col-3": 1,
      "col-4": 0,
      "col-5": 0,
      "col-6": 0,
    },
  },
];

const iconTypes = ["inprogress", "download", "document"];

const generateCard = (workflowId, columnKey, laneId, cardId) => {
  const colorOptions = [
    "#34a97b",
    "#7333bd",
    "#e6186a",
    "#f37325",
    "#af0020",
    "#607d8b",
    "#336633",
  ];

  const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
  const randomIconType = iconTypes[Math.floor(Math.random() * iconTypes.length)];
  const id = `${workflowId}-card-${cardId}`;

  const customerNames = [
    "Gulf Marine",
    "Saudi Marcap",
    "Snamprogetti",
    "Saipem",
    "Lamprell",
  ];
  const ports = ["DAM", "JED", "RUH", "JUB", "RAS", "YAN"];
  const vesselNames = [
    "Atlantic Star",
    "Pacific Wave",
    "Indian Ocean",
    "Mediterranean",
    "Caribbean Breeze",
    "Ocean Express",
    "Blue Horizon",
    "Sea Voyager",
    "Trade Wind",
    "Golden Gate",
    "Northern Star",
    "Southern Cross",
    "Eastern Dawn",
    "Western Tide",
    "Central Bay",
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

  const footerIconKeys = ["priority", "subtasks", "deadline", "watchers", "link"];
  const footerIconCount = Math.floor(Math.random() * 5) + 1;
  const shuffledKeys = [...footerIconKeys].sort(() => Math.random() - 0.5);
  const footerShowIcons = shuffledKeys.slice(0, footerIconCount);

  const extraDetailsKeys = ["transport", "hotel", "medical", "material", "waste", "launch"];
  const extraDetailsCount = Math.floor(Math.random() * 6) + 1;
  const shuffledExtra = [...extraDetailsKeys].sort(() => Math.random() - 0.5);
  const extraDetailsShowIcons = shuffledExtra.slice(0, extraDetailsCount);

  const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
  const cardData = {
    id,
    laneId,
    columnId: columnKey,
    title: `CARD – ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG"][
      Math.floor(Math.random() * 8)
    ]} ${2025 + Math.floor(Math.random() * 2)}`,
    name: customerName,
    user: drivers[Math.floor(Math.random() * drivers.length)],
    timeLeft: `${Math.floor(Math.random() * 90)}d ${Math.floor(Math.random() * 24)}h ${Math.floor(
      Math.random() * 60
    )}m`,
    progress: Math.floor(Math.random() * 100),
    color: randomColor,
    iconType: randomIconType,
    priority: cardId === 1,
    vesselName: vesselNames[Math.floor(Math.random() * vesselNames.length)],
    port: ports[Math.floor(Math.random() * ports.length)],
    priorityLevel: ["H", "M", "L"][Math.floor(Math.random() * 3)],
    transport: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    transportCount: Math.floor(Math.random() * 5) + 1,
    hotel: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    hotelCount: Math.floor(Math.random() * 5) + 1,
    medicalService: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    medicalServiceCount: Math.floor(Math.random() * 5) + 1,
    materialManagement: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    wasteDisposal: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    launchHire: ["done", "rejected", "inProgress"][Math.floor(Math.random() * 3)],
    footerShowIcons,
    extraDetailsShowIcons,
    footerSubtasks: Math.floor(Math.random() * 5) + 1,
    footerDeadline: `${Math.floor(Math.random() * 30) + 1}d`,
    footerWatchers: Math.floor(Math.random() * 5) + 1,
    footerLinkCount: Math.floor(Math.random() * 5),
  };

  return { id, cardData };
};

const DEFAULT_SWIMLANE_ID = "lane-default";
const EXTRA_SWIMLANE_ID = "lane-new";

const createWorkflow = (workflowConfig) => {
  const { id, title, columns: columnDefs, cardCounts, onlyDefaultSwimlane = false } =
    workflowConfig;

  const columnOrder = columnDefs.map((c) => c.key);
  const columns = {};

  for (const def of columnDefs) {
    const colKey = def.key;
    columns[colKey] = {
      id: `${id}-${colKey}`,
      title: def.title,
      color: def.color,
      wipLimit: def.wipLimit ?? null,
      cardsPerRow: def.cardsPerRow ?? DEFAULT_CARDS_PER_ROW,
    };
  }

  const emptyCardMap = () => Object.fromEntries(columnOrder.map((k) => [k, []]));

  const swimlaneOrder = onlyDefaultSwimlane
    ? [DEFAULT_SWIMLANE_ID]
    : [DEFAULT_SWIMLANE_ID, EXTRA_SWIMLANE_ID];

  const swimlanes = {
    [DEFAULT_SWIMLANE_ID]: {
      id: DEFAULT_SWIMLANE_ID,
      title: "Default Swimlane",
      cardMap: emptyCardMap(),
    },
    ...(onlyDefaultSwimlane
      ? {}
      : {
          [EXTRA_SWIMLANE_ID]: {
            id: EXTRA_SWIMLANE_ID,
            title: "New Swimlane",
            cardMap: emptyCardMap(),
          },
        }),
  };

  const cards = {};
  let cardSeq = 1;

  for (let colIndex = 0; colIndex < columnOrder.length; colIndex += 1) {
    const colKey = columnOrder[colIndex];
    const count = cardCounts[colKey] ?? 0;

    for (let i = 0; i < count; i += 1) {
      const { id: generatedCardId, cardData } = generateCard(id, colKey, DEFAULT_SWIMLANE_ID, cardSeq);
      cards[generatedCardId] = cardData;
      swimlanes[DEFAULT_SWIMLANE_ID].cardMap[colKey].push(generatedCardId);
      cardSeq += 1;
    }
  }

  return normalizeWorkflowFromApi({
    id,
    title,
    columnOrder,
    columns,
    swimlaneOrder,
    swimlanes,
    cards,
  });
};

/** Normalized workflows for the operator static board (same as legacy `initialData` before API refactor). */
export const operatorKanbanStaticWorkflows = workflowsConfig.map(createWorkflow);
