// Maps a business rule's trigger_code (e.g. from get_business_rule_list/get_business_rule_by_id)
// to the icon-type strings DynamicIcon understands, so both the trigger-type
// picker grid and any other rule listing/detail view can resolve the same icon from either shape.
export const TRIGGER_CODE_TO_ICON = {
  card_created: 'create',
  card_updated: 'update',
  card_moved: 'moved',
  child_card_blocked: 'child-blocked',
  child_card_moved: 'child-moved',
  child_card_updated: 'child-updated',
  all_children_moved: 'all-children-moved',
  time_based: 'time-based',
  recurring_created: 'time-based',
  recurring_create_cards: 'time-based',
  time_based_rule: 'time-based',
  // Best-effort guess for the "Deadline is in/was more than N day(s)" trigger — not
  // confirmed against a real get_trigger_types response yet.
  deadline_reached: 'time-based',
  parent_card_moved: 'parent-moved',
  parent_card_updated: 'parent-updated',
  parent_card_created: 'parent-created',
  archive_cards: 'archive',
  card_archived: 'archive',
  task_created: 'task-created',
  task_card_moved: 'task-moved',
  task_card_updated: 'task-updated',
};

// Maps a get_trigger_config `actions[].group_type` to the THEN section id the form
// already knows how to render, so the THEN column can be built from the trigger
// type's own action catalog instead of always showing every section.
export const ACTION_GROUP_TYPE_TO_SECTION_ID = {
  create_cards: 'create',
  update_card: 'update',
  link_card: 'link',
  send_notifications: 'notify',
  invoke_web_service: 'invoke',
  // update_parent_card/update_child_card get their own dedicated, repeatable section
  // (like 'create') instead of reusing the flat same-card 'update' chip list — they need
  // a per-instance nested "if parent/child card matches this filter" sub-picker that the
  // plain update_card flow never needed, so reusing 'update' would have meant restructuring
  // its already-working flat shape just for this cross-card case.
  update_parent_card: 'update_related',
  update_child_card: 'update_related',
  // Recurring-schedule triggers (e.g. "Recurring create cards") carry their own
  // dedicated "execute" section, rendered with a time+timezone picker instead of
  // an add/remove action list since there's exactly one schedule per rule.
  execute_at: 'execute',
  // "Copy the values of these fields from the child into the parent" (e.g. on
  // "Child card is updated") — its own repeatable section like update_related,
  // with a field-to-copy chip list plus the same nested parent-filter sub-picker.
  // Not yet returned by the live get_trigger_config for that trigger (actions: []
  // there as of this writing), so this key is a best-effort guess pending the
  // backend seeding real action rows — update it if the real group_type differs.
  copy_values_to_parent: 'copy_values',
  // Mirror direction of copy_values_to_parent (e.g. "Child card is updated" triggers) —
  // same 'copy_values' section/chip-list UI, its own has_child_filter flag drives the
  // nested "if child card matches this filter" wording instead of "if parent".
  copy_values_to_child: 'copy_values',
};

// Destination-based action groups (move/convert card, recurring create card) — no longer
// supported by the form, so they are filtered out of the THEN column and dropped when
// restoring a saved rule.
export const UNSUPPORTED_ACTION_GROUP_TYPES = [
  'move_card',
  'move_parent_card',
  'move_child_card',
  'convert_subtasks_to',
  'create_card_recurring',
];

export const LINK_ACTION_OPTIONS = [
  { key: 'child', label: 'Link as child' },
  { key: 'parent', label: 'Link as parent' },
  { key: 'predecessor', label: 'Link as predecessor' },
  { key: 'relative', label: 'Link as relative' },
  { key: 'successor', label: 'Link as successor' },
];

// "Remove all other X links" checkboxes shown under the Link the card action — one per
// link type, and only for a type the user has actually added (see hasLinkActionOfType
// usage in BusinessRuleFormModal.jsx), not all of them unconditionally.
export const LINK_REMOVE_OTHERS_OPTIONS = [
  { key: 'child', label: 'Remove all other child links' },
  { key: 'parent', label: 'Remove all other parent links' },
  { key: 'predecessor', label: 'Remove all other predecessor links' },
  { key: 'relative', label: 'Remove all other relative links' },
  { key: 'successor', label: 'Remove all other successor links' },
];

// Execution-frequency picker shown next to the "Add stickers"/"Remove stickers" update
// action label — whether the action fires only the first time the rule matches ('once')
// or every time it matches ('every_time'). No documented backend property for this yet;
// sent as a best-effort 'frequency' property alongside field_key/field_value.
export const STICKER_ACTION_FREQUENCY_OPTIONS = [
  { key: 'once', label: 'once' },
  { key: 'every_time', label: 'every time' },
];

// List-update-mode picker shown next to "Set milestones"/"Set tags" — whether the picked
// values are appended to the card's existing list or replace it outright. No documented
// backend property for this yet; sent as a best-effort 'list_mode' property.
export const LIST_UPDATE_MODE_OPTIONS = [
  { key: 'append', label: 'append' },
  { key: 'replace', label: 'replace' },
];

// "Set deadline to a relative/absolute date" picker. No documented backend property for
// this yet; sent as best-effort 'deadline_mode'/'deadline_days'/'deadline_date' properties.
export const DEADLINE_MODE_OPTIONS = [
  { key: 'relative', label: 'to a relative date' },
  { key: 'absolute', label: 'to an absolute date' },
];

// WHEN-side comparison for the "Deadline is in/was more than N day(s)" trigger
// (when_type 'deadline', e.g. "Time-based rule", trigger_type_id 9). No backend
// catalog for this yet, best-effort fixed set until confirmed against a real save payload.
export const WHEN_DEADLINE_COMPARISON_OPTIONS = [
  { key: 'is_in', label: 'is in' },
  { key: 'was_more_than', label: 'was more than' },
];

// Static weekday catalog for the deadline action's "Non-working days" multi-select — no
// backend catalog for this exists, so it's the fixed 7-day week rather than an invented
// endpoint.
export const WEEKDAY_OPTIONS = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
];

// Static priority catalog for the "Set priority" picker — a fixed 4-level enum, not a
// backend-driven list (matches the fixed-option pattern used by CREATE_ACTION_OPTIONS etc).
export const PRIORITY_OPTIONS = [
  { key: 'critical', label: 'Critical', color: '#e5484d' },
  { key: 'high', label: 'High', color: '#f5a623' },
  { key: 'average', label: 'Average', color: '#9ca3af' },
  { key: 'low', label: 'Low', color: '#2f80ed' },
];

// Custom fields carry no confirmed field_type anywhere in this app yet (nothing in the
// codebase branches on get_custom_fields'/get_then_action_fields' field_type today), so
// which value UI a "Set {custom field}" update action gets is guessed from the field's
// own label instead — best-effort, easy to swap for a real field_type check once the
// backend shape is confirmed.
export const CUSTOM_FIELD_DATE_LABEL_HINTS = ['date', 'atd', 'ata', 'etd', 'eta'];
export const CUSTOM_FIELD_NO_VALUE_LABEL_HINTS = ['copy', 'document', 'acknowledgment', 'acknowledgement', 'certificate', 'permit'];
export const CUSTOM_FIELD_CARD_PICKER_LABEL = 'card picker';

// Resolves which value UI a custom-field update action should render: 'date' (relative-
// days + non-working-days, same as Set deadline minus the relative/absolute toggle),
// 'card' (a "Pick a card" reference picker), 'none' (no settable value — e.g. a file/
// document field), or the 'text' default.
export function classifyCustomFieldUiKind(label) {
  const l = String(label ?? '').trim().toLowerCase();
  if (l === CUSTOM_FIELD_CARD_PICKER_LABEL) return 'card';
  if (CUSTOM_FIELD_DATE_LABEL_HINTS.some((hint) => l === hint || l.includes(hint))) return 'date';
  if (CUSTOM_FIELD_NO_VALUE_LABEL_HINTS.some((hint) => l.includes(hint))) return 'none';
  return 'text';
}

export const NOTIFY_ACTION_OPTIONS = [
  { key: 'send_notification', label: 'Send notification' },
];

export const INVOKE_ACTION_OPTIONS = [
  { key: 'invoke_web_service', label: 'Invoke web service' },
];

// Dev-only fallback data for the "Web Service Invoke Settings" modal.
export const DUMMY_INVOKE_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

export const DUMMY_INVOKE_AUTH_OPTIONS = ['NONE', 'BASIC', 'API_KEY'];

// HTTP methods that carry a request body, and so support the "send parameters
// in body" toggle and the default 'kanbanize_payload' parameter. GET requests
// only ever send parameters as a URL query string.
export const INVOKE_METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Regular-field options offered by the "Select a field" modal (Url's "add card fields" trigger).
export const DUMMY_URL_FIELD_OPTIONS = ['Card ID', 'Custom card ID', 'Internal card id'];

// Static role/group pills shown alongside individual users in the "Select
// Internal Users" modal.
export const INTERNAL_USER_ROLE_OPTIONS = ['Self', 'Owner', 'Owners', 'Watchers', 'Contributors', 'Reporter', 'Co-owners'];

export const UPDATE_ACTION_OPTIONS = [
  { key: 'add_co_owners', label: 'Add co-owners', field: 'Co-owners' },
  { key: 'add_stickers', label: 'Add stickers', field: 'Stickers' },
  { key: 'add_watcher', label: 'Add watcher', field: 'Watcher' },
  { key: 'remove_co_owners', label: 'Remove co-owners', field: 'Co-owners' },
  { key: 'remove_milestones', label: 'Remove milestones', field: 'Milestones' },
  { key: 'remove_stickers', label: 'Remove stickers', field: 'Stickers' },
  { key: 'set_blocker', label: 'Set blocker', field: 'Blocker' },
  { key: 'set_color', label: 'Set color', field: 'Color' },
  { key: 'set_deadline', label: 'Set deadline', field: 'Deadline' },
  { key: 'set_description', label: 'Set description', field: 'Description' },
  { key: 'set_milestones', label: 'Set milestones', field: 'Milestones' },
  { key: 'set_owner', label: 'Set owner', field: 'Owner' },
  { key: 'set_priority', label: 'Set priority', field: 'Priority' },
  { key: 'set_size', label: 'Set size', field: 'Size' },
  { key: 'set_tags', label: 'Set tags', field: 'Tags' },
  { key: 'set_title', label: 'Set title', field: 'Title' },
  { key: 'set_type', label: 'Set type', field: 'Type' },
  { key: 'unblock_card', label: 'Unblock card', field: 'Card' },
];
