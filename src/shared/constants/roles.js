export const ROLE_OPTIONS = [
  "Admin",
  "Management",
  "Manager",
  "Port Manager",
  "Supervisor",
  "Operator",
  "Tax Board Caption",
  "Driver",
  "DA Supervisor",
  "DA Operator",
];

export const ROLE_DESCRIPTIONS = {
  Admin: "Full system access and configuration control.",
  Management: "Oversee operations, KPIs, and strategic workflows.",
  Manager: "Manage teams, assignments, and approvals.",
  "Port Manager": "Coordinate day-to-day activities for port operations.",
  Supervisor: "Review and approve operational tasks and escalations.",
  Operator: "Execute daily tasks and update operational statuses.",
  "Tax Board Caption": "Handle tax board processes and related documentation.",
  Driver: "Manage transport movements and delivery updates.",
  "DA Supervisor": "Supervise disbursement account reviews and audits.",
  "DA Operator": "Process disbursement account entries and updates.",
};

export const getRoleDescription = (role) =>
  ROLE_DESCRIPTIONS[role] || "Role description coming soon.";

