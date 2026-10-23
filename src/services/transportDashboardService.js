// Mock implementation of GET /api/transport/dashboard_overview (Transport Coordinator dashboard).
// Swap the body of getTransportDashboardOverview for:
//   Gateway.get('transport/dashboard_overview', { params })
// once BE ships the endpoint — response shape below is the proposed contract.

// Pickup times are relative to today so the Today / Upcoming tabs always have rows.
const atDay = (offsetDays, hours, minutes = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const buildMockOverview = () => ({
  summary: {
    todays_pickups: 14,
    pending_assignment: 5,
    in_transit: 3,
    completed_mtd: 186,
    active_drivers: 22,
    available_vehicles: 9,
  },

  // `status`: pending_assignment | assigned | in_transit | completed | cancelled
  transport_requests: [
    { id: 1, wo_number: "WO-24081", vessel: "MV Gulf Pioneer", port: "jubail", from: "Jubail Port Gate 3", to: "Dammam Airport (DMM)", pickup_at: atDay(0, 7, 30), crew_count: 6, company: "In-house", driver: "Faisal Al-Harbi", vehicle: "Coaster Bus · JBL-4521", status: "completed" },
    { id: 2, wo_number: "WO-24082", vessel: "MV Arabian Star", port: "rt", from: "Ras Tanura Pier 2", to: "Holiday Inn Al Khobar", pickup_at: atDay(0, 10, 0), crew_count: 4, company: "Al Majdouie Transport", driver: "Imran Khan", vehicle: "Hiace Van · RTN-1180", status: "in_transit" },
    { id: 3, wo_number: "WO-24083", vessel: "MV Ocean Grace", port: "jubail", from: "Dammam Airport (DMM)", to: "Jubail Port Gate 1", pickup_at: atDay(0, 13, 15), crew_count: 8, company: "In-house", driver: "Saeed Al-Qahtani", vehicle: "Coaster Bus · JBL-4533", status: "assigned" },
    { id: 4, wo_number: "WO-24084", vessel: "MT Red Sea Spirit", port: "dammam", from: "King Abdulaziz Port", to: "Bahrain Causeway", pickup_at: atDay(0, 16, 45), crew_count: 3, company: "Gulf Star Logistics", driver: null, vehicle: null, status: "pending_assignment" },
    { id: 5, wo_number: "WO-24085", vessel: "Crew Boat Sadaf", port: "rt", from: "Ras Tanura Pier 1", to: "Ras Tanura Camp", pickup_at: atDay(0, 19, 0), crew_count: 2, company: "In-house", driver: null, vehicle: null, status: "pending_assignment" },
    { id: 6, wo_number: "WO-24086", vessel: "MV Khaleej Trader", port: "rt", from: "Dammam Airport (DMM)", to: "Ras Tanura Pier 2", pickup_at: atDay(1, 6, 0), crew_count: 5, company: "Al Majdouie Transport", driver: "Imran Khan", vehicle: "Hiace Van · RTN-1180", status: "assigned" },
    { id: 7, wo_number: "WO-24087", vessel: "MV Desert Falcon", port: "jubail", from: "Jubail Port Gate 3", to: "Novotel Dammam", pickup_at: atDay(1, 11, 30), crew_count: 7, company: "In-house", driver: null, vehicle: null, status: "pending_assignment" },
    { id: 8, wo_number: "WO-24088", vessel: "AHTS Najm", port: "jubail", from: "Jubail Marina", to: "Dammam Airport (DMM)", pickup_at: atDay(2, 9, 0), crew_count: 4, company: "Gulf Star Logistics", driver: "Rashid Mahmoud", vehicle: "GMC Suburban · DMM-7712", status: "assigned" },
    { id: 9, wo_number: "WO-24089", vessel: "Barge RT-12", port: "rt", from: "Ras Tanura Camp", to: "Ras Tanura Pier 1", pickup_at: atDay(3, 14, 0), crew_count: 3, company: "Eastern Line Transport", driver: null, vehicle: null, status: "pending_assignment" },
    { id: 10, wo_number: "WO-24090", vessel: "MT Coral Wave", port: "dammam", from: "King Fahd Airport", to: "King Abdulaziz Port", pickup_at: atDay(4, 8, 15), crew_count: 6, company: "Eastern Line Transport", driver: "Omar Siddiqui", vehicle: "Coaster Bus · DMM-3304", status: "assigned" },
  ],

  // Trips this month split by provider. "In-house" is the company's own fleet.
  trips_by_company: [
    { key: "inhouse", name: "In-house", trips: 92 },
    { key: "majdouie", name: "Al Majdouie Transport", trips: 48 },
    { key: "gulfstar", name: "Gulf Star Logistics", trips: 31 },
    { key: "eastern", name: "Eastern Line Transport", trips: 15 },
  ],

  trip_trend: [
    { month: "Jan", period: "2026-01", trips: 142 },
    { month: "Feb", period: "2026-02", trips: 151 },
    { month: "Mar", period: "2026-03", trips: 168 },
    { month: "Apr", period: "2026-04", trips: 173 },
    { month: "May", period: "2026-05", trips: 160 },
    { month: "Jun", period: "2026-06", trips: 189 },
    { month: "Jul", period: "2026-07", trips: 177 },
    { month: "Aug", period: "2026-08", trips: 194 },
    { month: "Sep", period: "2026-09", trips: 201 },
    { month: "Oct", period: "2026-10", trips: 186 },
  ],

  fleet: {
    drivers: { available: 11, on_trip: 7, off_duty: 4 },
    vehicles_by_type: [
      { type: "Coaster Bus", total: 8, available: 3 },
      { type: "Hiace Van", total: 6, available: 2 },
      { type: "GMC Suburban", total: 5, available: 3 },
      { type: "Sedan", total: 4, available: 1 },
    ],
  },
});

const getTransportDashboardOverview = () =>
  Promise.resolve({ data: { status: true, data: buildMockOverview() } });

export default { getTransportDashboardOverview };
