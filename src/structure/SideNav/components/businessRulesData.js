export const BUSINESS_RULES = [
  {
    id: 1,
    name: 'Card is created',
    icon: 'create',
    description:
      'Triggers when a new card is created. Use this to send notifications, assign defaults, or start workflows automatically.',
  },
  {
    id: 2,
    name: 'Card is updated',
    icon: 'update',
    description:
      'Triggers when any field on a card changes. Use this to track changes, update related cards, or send change notifications.',
  },
  {
    id: 3,
    name: 'Card is moved',
    icon: 'moved',
    description:
      'Triggers when a card moves between columns or lanes. Use this to update status, notify stakeholders, or run location-based workflows.',
  },
  {
    id: 4,
    name: 'Child card is blocked',
    icon: 'child-blocked',
    description:
      'Triggers when a child card is marked blocked. Use this to notify stakeholders, pause parent progress, or escalate blocked work.',
  },
  {
    id: 5,
    name: 'Child card is moved',
    icon: 'child-moved',
    description:
      'Triggers when a child card moves. Use this to sync parent status, align child movement with parent workflows, or send updates.',
  },
  {
    id: 6,
    name: 'All children are moved',
    icon: 'all-children-moved',
    description:
      'Triggers when every child card has moved to the target location or status. Use this to complete parents or start the next phase.',
  },
];

// Maps a business rule's trigger_code (e.g. from get_business_rule_list/get_business_rule_by_id)
// to the same icon-type strings used by BUSINESS_RULES[].icon above, so both the trigger-type
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

// Dev-only fallback for the THEN column, used when get_trigger_config hasn't
// returned an `actions` list yet (e.g. local dev without a live backend).
export const THEN_ACTION_SECTIONS = [
  { id: 'create', title: 'Create cards or subtasks' },
  { id: 'update', title: 'Update the card details' },
  { id: 'link', title: 'Link the card' },
  { id: 'move', title: 'Move the card' },
  { id: 'copy_values', title: 'Copy the values of these fields from the child into the parent' },
  { id: 'notify', title: 'Send notifications' },
  { id: 'invoke', title: 'Create the UI Invoke web service' },
];

// Maps a get_trigger_config `actions[].group_type` to the THEN section id the form
// already knows how to render, so the THEN column can be built from the trigger
// type's own action catalog instead of always showing every section.
export const ACTION_GROUP_TYPE_TO_SECTION_ID = {
  create_cards: 'create',
  // Recurring-schedule triggers (e.g. "Recurring create cards") carry the "what to
  // create" action under this group_type instead of plain create_cards — same 'create'
  // section/chip-list UI, just paired with the trigger's own 'execute' schedule section.
  create_card_recurring: 'create',
  update_card: 'update',
  link_card: 'link',
  move_card: 'move',
  send_notifications: 'notify',
  invoke_web_service: 'invoke',
  // move_parent_card/move_child_card reuse the same 'move' section as plain move_card —
  // it's still just a destination pick, and the nested "if parent/child card matches
  // this filter" block below each move action is only rendered when this trigger's own
  // move action actually carries has_parent_filter/has_child_filter.
  move_parent_card: 'move',
  move_child_card: 'move',
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
  // "Convert subtasks to" (e.g. on "Card is moved") has the same empty
  // get_then_action_fields shape as move_card — it's a destination pick, not a
  // field pick — so it reuses the board-minimap destination picker as its own
  // dedicated section rather than the 'move' one, to keep it a separate action list.
  convert_subtasks_to: 'convert',
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

export const CREATE_ACTION_OPTIONS = [
  { key: 'card', label: 'Create card' },
  { key: 'child', label: 'Create child' },
  { key: 'parent', label: 'Create parent' },
  { key: 'predecessor', label: 'Create predecessor' },
  { key: 'relative', label: 'Create relative' },
  { key: 'subtask', label: 'Create subtask' },
  { key: 'successor', label: 'Create successor' },
];

// Relational create-action variants — these create a new card linked to the card that
// triggered the rule (an "originator"), so after picking a destination they get an extra
// "Copy Card Details" step to pick which of the originator's fields to carry over. A plain
// "Create card" has no originator relationship, so it skips that step entirely.
// Matched by keyword-in-label rather than key or exact phrase — same reason as the
// "Create subtask" check nearby (hasCustomProperties): a live get_then_action_fields
// response keys/labels each regular field using the backend's own wording (e.g. "Create
// Child Card"), not the dev-fallback's literal 'child'/'parent'/... strings or exact
// 'create child' phrasing, so key-based or exact-phrase matching silently never fires
// once real backend data is in play.
export const RELATIONAL_CREATE_ACTION_KEYWORDS = ['child', 'parent', 'predecessor', 'relative', 'successor'];

// Inverse-relation wording for the THEN-column "title will be copied from..." note —
// the originator (triggering) card is described from the *new* card's point of view,
// e.g. creating a "child" means the originator is that new card's parent.
export const RELATIONAL_CREATE_ACTION_ORIGIN_LABELS = {
  child: 'the parent card',
  parent: 'the child card',
  relative: 'the relative card',
  successor: 'the predecessor card',
};

// Fixed field list for the "Copy Card Details" step (no backend endpoint returns this
// list today — best-effort, hardcoded to match the same fixed-option pattern as
// CREATE_ACTION_OPTIONS/UPDATE_ACTION_OPTIONS above).
export const COPY_CARD_DETAIL_REGULAR_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'owner', label: 'Owner' },
  { key: 'color', label: 'Color' },
  { key: 'priority', label: 'Priority' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'size', label: 'Size' },
  { key: 'type', label: 'Type' },
  { key: 'tags', label: 'Tags' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'subtasks', label: 'Subtasks' },
  { key: 'co_owners', label: 'Co-owners' },
  { key: 'stickers', label: 'Stickers' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'custom_card_id', label: 'Custom card ID' },
  { key: 'parent_links', label: 'Parent links' },
  { key: 'all_custom_fields', label: 'All custom fields' },
];

// Dev-only fallback data for the "Create card or subtask" action's board-template picker.
export const DUMMY_CREATE_ACTION_TEMPLATES = [
  'Air Shipment',
  'Air(FFD)',
  'Bahrain Visa services',
  'Bidding',
  'Collections - Offshore Marine',
  'CREW CHANGE',
  'Crew change - Jubail',
  'Custom Clearance',
  'DOMESTIC CALL',
  'Export call',
  'EXPORT VESSEL',
  'FFD',
  'General Board',
  'IMPORT VESSEL',
  'Infobahn Import call template',
  'Land Shipment',
  'LAUNCH HIRE INVOICE',
  'MARINE SUPPORT',
  'Marine Work Permit',
  'MATERIAL / GARBAGE DELIVERY',
  'MEDICAL CREW',
  'Miscellaneous',
  'MWP',
  'ON STATION CHARGES',
  'Procurement',
  'Purchase Order',
  'REMOTE ROB SURVEY',
  'Request Driver',
  'Sea Freight',
  'Taxi Tug',
  'test by khadeeja',
  'Visa services',
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

// Dev-only fallback data for the Linked Card action operator dropdown, used when the
// real business_rule/get_link_card_possible_action_operators endpoint returns nothing.
export const DUMMY_LINK_ACTION_OPERATORS = [
  { operator_id: '1', operator_key: 'card_id', operator_label: 'to card with id', has_input_value: '1', is_dynamic: '0', display_order: '1' },
  { operator_id: '2', operator_key: 'card_custom_id', operator_label: 'to card with custom id', has_input_value: '1', is_dynamic: '0', display_order: '2' },
  { operator_id: '3', operator_key: 'dynamic_1', operator_label: 'Dynamic Picker 1', has_input_value: '0', is_dynamic: '1', display_order: '3' },
  { operator_id: '4', operator_key: 'dynamic_2', operator_label: 'Dynamic Picker 2', has_input_value: '0', is_dynamic: '1', display_order: '4' },
  { operator_id: '5', operator_key: 'dynamic_3', operator_label: 'Dynamic Picker 3', has_input_value: '0', is_dynamic: '1', display_order: '5' },
];

// Dev-only fallback operators for a condition row's field-details fetch (business_rule/get_field_details),
// used when that endpoint returns nothing, e.g. local dev without a live backend. Never shown in production.
export const DUMMY_FIELD_OPERATORS = [
  { field_operator_id: '1', operator_label: 'is' },
  { field_operator_id: '2', operator_label: 'is not' },
  { field_operator_id: '3', operator_label: 'contains' },
  { field_operator_id: '4', operator_label: 'does not contain' },
];

export const MOVE_ACTION_OPTIONS = [
  { key: 'move_to', label: 'Move card to' },
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

// Static size catalog for the "Create card with custom properties" panel's Size field —
// no documented backend enum for card size exists yet, so this is the fixed T-shirt
// scale (same best-effort-fixed-list pattern as PRIORITY_OPTIONS above).
export const CREATE_CARD_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'];

// Static size catalog for the card fields "Size" dropdown — no backend endpoint for this
// today, same fixed-option pattern as PRIORITY_OPTIONS above.
export const SIZE_OPTIONS = [
  { key: '', label: 'Not Set' },
  { key: 'xs', label: 'XS' },
  { key: 's', label: 'S' },
  { key: 'm', label: 'M' },
  { key: 'l', label: 'L' },
  { key: 'xl', label: 'XL' },
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

export const CONVERT_SUBTASK_ACTION_OPTIONS = [
  { key: 'convert_to', label: 'Convert subtasks to' },
];

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

// Fields insertable into a Params row's value (the payload sent to the service).
export const DUMMY_INVOKE_PAYLOAD_FIELDS = ['Kanbanize Payload', 'Card ID', 'Card Title', 'Board ID'];

// Dev-only fallback data for the "Notification Message Settings" modal.
export const DUMMY_NOTIFICATION_FROM_EMAIL = 'sedres_notifications@kanbanize.com';

export const DUMMY_INTERNAL_USERS = ['John Smith', 'Sarah Ahmed', 'Mohammed Al-Farsi'];

// Static role/group pills shown alongside individual users in the "Select
// Internal Users" modal.
export const INTERNAL_USER_ROLE_OPTIONS = ['Self', 'Owner', 'Owners', 'Watchers', 'Contributors', 'Reporter', 'Co-owners'];

// Dev-only fallback data for the "Shared with" permissions modal.
export const DUMMY_SHARE_USERS = [
  { id: 'u1', name: 'Sedres Maritime', username: 'sarim.asaf' },
  { id: 'u2', name: 'Shuaib', username: 'Shuaib' },
  { id: 'u3', name: 'Rejeesh Krishnan', username: 'Rejeesh Krishnan' },
  { id: 'u4', name: 'Junaid Altaf Khan', username: 'Junaidkhan' },
  { id: 'u5', name: 'Omer Fennan', username: 'omer.fennan' },
  { id: 'u6', name: 'abdulhakim', username: 'hakimabdul' },
  { id: 'u7', name: 'MohammedMifzalHusain', username: 'Mifzalmanna' },
  { id: 'u8', name: 'Nandu dinesh', username: 'Nandu' },
  { id: 'u9', name: 'Nadir Shah', username: 'Nadir' },
  { id: 'u10', name: 'YASIR KHAN', username: 'YASIRKHAN' },
  { id: 'u11', name: 'FDA', username: 'DA Hub' },
  { id: 'u12', name: 'GRO OPERATIONS', username: 'GRO' },
];

export const DUMMY_NOTIFICATION_SUBJECT_PARTS = [
  { type: 'text', value: '{' },
  { type: 'pill', value: 'Title' },
  { type: 'text', value: '} - {' },
  { type: 'pill', value: 'Board Name' },
  { type: 'text', value: '}{' },
  { type: 'pill', value: 'Internal Card Id' },
  { type: 'text', value: '} New card created' },
];

// Quill strips unrecognized classes/attributes when parsing raw HTML (it only keeps
// known formats), so pill spans would render as plain text if passed to the editor as
// an HTML string. Building the initial content as Quill Delta ops instead (with a
// custom "pill" format registered in BusinessRuleFormModal.jsx) preserves them.
function bulletPillLine(label, pillText) {
  return [
    { insert: `${label}: ` },
    { insert: { pill: pillText } },
    { insert: '\n', attributes: { list: 'bullet' } },
  ];
}

export const DUMMY_NOTIFICATION_BODY_DELTA_OPS = [
  { insert: 'New card has been created by ', attributes: { bold: true } },
  { insert: { pill: 'Author' } },
  { insert: '\n\n' },
  { insert: { pill: 'Card URL' } },
  { insert: '\n\n' },
  { insert: 'Card details', attributes: { bold: true } },
  { insert: '\n' },
  ...bulletPillLine('Title', 'Title'),
  ...bulletPillLine('Description', 'Description'),
  ...bulletPillLine('Color', 'Color'),
  ...bulletPillLine('Owner', 'Owner'),
  ...bulletPillLine('Priority', 'Priority'),
  ...bulletPillLine('Size', 'Size'),
  ...bulletPillLine('Deadline', 'Deadline'),
  ...bulletPillLine('Tags', 'Tags'),
  ...bulletPillLine('Milestones', 'Milestones'),
  ...bulletPillLine('Board', 'Board Name'),
  ...bulletPillLine('Column', 'Column Name'),
  ...bulletPillLine('Subtasks', 'Total Subtasks Count'),
];

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

// Dev-only fallback data for the "Card property match" modal, used when the
// real business_rule field endpoints return nothing (e.g. local dev without
// a live backend). Never shown in production builds.
export const DUMMY_REGULAR_FIELDS = [
  'Attachments', 'Block time', 'Blocked', 'Blocker', 'Board', 'Card ID', 'Child cards', 'Co-owners',
  'Color', 'Column', 'Comments', 'Created at', 'Custom card ID', 'Cycle time', 'Deadline', 'Description',
  'Finished subtasks count', 'First blocked date', 'First date moved to',
  'Internal card id', 'Lane', 'Last blocked date', 'Last date moved out of', 'Last date moved to',
  'Last modified', 'Last moved', 'Logged time', 'Milestones', 'Owner', 'Owners', 'Parent cards',
  'Position', 'Priority', 'Relative cards', 'Reporter', 'Section', 'Size', 'Stickers',
  'Subtasks progress', 'Tags', 'Title', 'Total subtasks count', 'Type', 'Unfinished subtasks count',
  'Watchers', 'Workflow',
].map((label, idx) => ({ regular_field_id: idx + 1, field_label: label, field_key: label }));

export const DUMMY_TIME_UNITS = ['Days', 'Hours', 'Minutes', 'Seconds']
  .map((label, idx) => ({ time_unit_id: idx + 1, unit_label: label, unit_key: label }));

// Dev-only sample workspace/board groups appended after the real API results in the
// board picker, so the picker has enough groups/tiles to test scrolling and layout
// even when the connected backend only has a couple of real workspaces set up.
// IDs are namespaced ('dummy-...') so they can never collide with a real workspace/board id.
export const DUMMY_WORKSPACE_BOARDS = [
  {
    workspace_id: 'dummy-ws-1',
    workspace_name: 'SEDRES - CHANDLING - WORK SPACE',
    boards: [
      { board_id: 'dummy-board-1', board_name: 'CHANDLING OPERATIONS' },
      { board_id: 'dummy-board-2', board_name: 'FROZEN' },
      { board_id: 'dummy-board-3', board_name: 'LOGISTICS' },
      { board_id: 'dummy-board-4', board_name: 'DRY AND CABIN ITEMS' },
      { board_id: 'dummy-board-5', board_name: 'DN' },
      { board_id: 'dummy-board-6', board_name: 'CHILLER' },
      { board_id: 'dummy-board-7', board_name: 'SUPER MARKET MAIN BOARD' },
    ],
  },
  {
    workspace_id: 'dummy-ws-2',
    workspace_name: 'New Offshore Marine Logistics',
    boards: [
      { board_id: 'dummy-board-8', board_name: 'Rastanura/ Dammam Operations' },
      { board_id: 'dummy-board-9', board_name: 'Jubail Operations' },
      { board_id: 'dummy-board-10', board_name: 'Centralized DA DESK' },
    ],
  },
  {
    workspace_id: 'dummy-ws-3',
    workspace_name: 'Limousine',
    boards: [
      { board_id: 'dummy-board-11', board_name: 'Coordinator Transport' },
    ],
  },
  {
    workspace_id: 'dummy-ws-4',
    workspace_name: 'Bunkering Services',
    boards: [
      { board_id: 'dummy-board-12', board_name: 'Bunker Operations' },
      { board_id: 'dummy-board-13', board_name: 'Fuel Delivery' },
    ],
  },
  {
    workspace_id: 'dummy-ws-5',
    workspace_name: 'Documentation',
    boards: [
      { board_id: 'dummy-board-14', board_name: 'Customs Clearance' },
      { board_id: 'dummy-board-15', board_name: 'Port Documentation' },
    ],
  },
];

export const DUMMY_CUSTOM_FIELDS = [
  '3rd Party Items', '3rd Party Launch hire (If any)', 'Additional Assignee', 'Airway bill no.',
  'Amount (In SAR)', 'any additional requirment will be based on cargo type', 'AP Number',
  'Appointment Email', 'Arrival procedure copy', 'Assigned Driver', 'ASSSIGNED VEHICLE', 'ATD', 'AWB',
  'AWBL copy from Agent/ shipping line', 'Bah Inv No', 'Bayan', 'Bidding Documents from client',
  'Billing Entity- -', 'BL copy from Agent/ shipping line', 'BL number', 'Buying Price [Excl. VAT]',
  'Card Picker', 'Cargo bayan copy', 'Cargo collection date', 'Cargo Invoice & BL', 'CG PERMIT COPY',
  'CIPL / BL - Vessel', 'CIPL FFD', 'CLIENT', 'Client Acknowledgment', 'Client Name (FFD)',
  'Commercial invoice', 'Commercial Proposal', 'Commodity', 'Consumable Invoice & BL',
  'COO certificate of origin', 'Copy of Export Bayan', 'Copy of Sales order', 'Costing for Bid',
  'Costing Issued On', 'Credit Terms', 'Crew Documents',
].map((label, idx) => ({ custom_field_id: idx + 1, field_label: label }));
