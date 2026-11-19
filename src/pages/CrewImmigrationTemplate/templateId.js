// pass_template rows carry a type-specific id key (Vessel Registration uses `pass_vesselreg_template_id`).
// Resolve the Crew Immigration row id from any `*template_id` key so it works whatever the backend names it.
export const resolveTemplateId = (row) => {
  if (!row || typeof row !== 'object') return '';
  const direct = row.pass_crewimmigration_template_id ?? row.pass_crew_immigration_template_id ?? row.template_id;
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
  const key = Object.keys(row).find((k) => /template_id$/i.test(k) && String(row[k] ?? '').trim() !== '');
  return key ? row[key] : '';
};
