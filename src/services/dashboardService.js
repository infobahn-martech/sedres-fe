// Mock implementation of GET /api/dashboard/get_overview.
// Swap the body of getDashboardOverview for:
//   Gateway.get('dashboard/get_overview', { params })
// once BE ships the endpoint — response shape below matches the agreed contract.

const MOCK_OVERVIEW = {
  summary: {
    total_vessels_imported: 142,
    total_vessels_exported: 128,
    total_crew_change_ytd: 1234,
    vessels_in_agency: 37,
  },

  // Port-wise vessel lists. `direction`: import | export | domestic.
  vessels: [
    { id: 1, name: "MV Gulf Pioneer", port: "jubail", direction: "import", client: "Saipem", eta: "2026-09-28", status: "berthed" },
    { id: 2, name: "MV Arabian Star", port: "rt", direction: "import", client: "Aramco", eta: "2026-09-30", status: "arrived" },
    { id: 3, name: "MT Red Sea Spirit", port: "dammam", direction: "import", client: "McDermott", eta: "2026-10-02", status: "expected" },
    { id: 4, name: "MV Ocean Grace", port: "jubail", direction: "import", client: "NMDC", eta: "2026-09-25", status: "customs_clearance" },
    { id: 5, name: "MV Khaleej Trader", port: "rt", direction: "export", client: "Aramco", eta: "2026-09-29", status: "loading" },
    { id: 6, name: "MV Desert Falcon", port: "jubail", direction: "export", client: "Saipem", eta: "2026-10-01", status: "expected" },
    { id: 7, name: "MT Coral Wave", port: "dammam", direction: "export", client: "L&T", eta: "2026-09-27", status: "sailed" },
    { id: 8, name: "Tug Al Jubail 3", port: "jubail", direction: "domestic", client: "Saipem", eta: "2026-09-29", status: "berthed" },
    { id: 9, name: "AHTS Najm", port: "jubail", direction: "domestic", client: "NMDC", eta: "2026-09-30", status: "expected" },
    { id: 10, name: "Barge RT-12", port: "rt", direction: "domestic", client: "Aramco", eta: "2026-09-28", status: "arrived" },
    { id: 11, name: "Crew Boat Sadaf", port: "rt", direction: "domestic", client: "McDermott", eta: "2026-10-03", status: "expected" },
  ],

  crew_changes: [
    { id: 1, vessel: "MV Gulf Pioneer", port: "jubail", date: "2026-09-29", on_signers: 6, off_signers: 5, status: "in_progress" },
    { id: 2, vessel: "MV Arabian Star", port: "rt", date: "2026-10-01", on_signers: 4, off_signers: 4, status: "scheduled" },
    { id: 3, vessel: "MV Ocean Grace", port: "jubail", date: "2026-09-26", on_signers: 8, off_signers: 7, status: "completed" },
    { id: 4, vessel: "MV Khaleej Trader", port: "rt", date: "2026-10-04", on_signers: 3, off_signers: 3, status: "scheduled" },
  ],

  crew_change_trend: [
    { month: "Jan", count: 118 },
    { month: "Feb", count: 124 },
    { month: "Mar", count: 131 },
    { month: "Apr", count: 142 },
    { month: "May", count: 128 },
    { month: "Jun", count: 150 },
    { month: "Jul", count: 139 },
    { month: "Aug", count: 147 },
    { month: "Sep", count: 155 },
  ],

  branches: [
    { key: "jubail", name: "Jubail" },
    { key: "dammam", name: "Dammam" },
    { key: "rt", name: "Ras Tanura" },
  ],

  revenue_by_branch: [
    { month: "Jan", jubail: 182000, dammam: 124000, rt: 96000 },
    { month: "Feb", jubail: 191000, dammam: 131000, rt: 101000 },
    { month: "Mar", jubail: 205000, dammam: 128000, rt: 108000 },
    { month: "Apr", jubail: 214000, dammam: 139000, rt: 112000 },
    { month: "May", jubail: 208000, dammam: 145000, rt: 118000 },
    { month: "Jun", jubail: 226000, dammam: 151000, rt: 121000 },
    { month: "Jul", jubail: 238000, dammam: 149000, rt: 127000 },
    { month: "Aug", jubail: 245000, dammam: 158000, rt: 133000 },
    { month: "Sep", jubail: 257000, dammam: 164000, rt: 139000 },
  ],

  revenue_offshore_marine: [
    { month: "Jan", revenue: 312000 },
    { month: "Feb", revenue: 298000 },
    { month: "Mar", revenue: 335000 },
    { month: "Apr", revenue: 351000 },
    { month: "May", revenue: 344000 },
    { month: "Jun", revenue: 372000 },
    { month: "Jul", revenue: 389000 },
    { month: "Aug", revenue: 381000 },
    { month: "Sep", revenue: 402000 },
  ],

  open_sales_orders: [
    { id: 1, so_number: "SO-24081", client: "Saipem", created_on: "2026-07-14", amount: 48500 },
    { id: 2, so_number: "SO-24102", client: "Aramco", created_on: "2026-08-02", amount: 126000 },
    { id: 3, so_number: "SO-24155", client: "NMDC", created_on: "2026-08-21", amount: 32750 },
    { id: 4, so_number: "SO-24190", client: "Saipem", created_on: "2026-09-05", amount: 71200 },
    { id: 5, so_number: "SO-24211", client: "McDermott", created_on: "2026-09-12", amount: 18900 },
    { id: 6, so_number: "SO-24236", client: "L&T", created_on: "2026-09-20", amount: 54300 },
    { id: 7, so_number: "SO-24248", client: "Aramco", created_on: "2026-09-24", amount: 89400 },
  ],
};

const getDashboardOverview = () =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ data: { data: MOCK_OVERVIEW } }), 400);
  });

export default {
  getDashboardOverview,
};
