import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const KANBAN_LOCAL_HOOKS = new Set([
  'useKanbanDnD',
  'useKanbanBoardState',
  'useWorkflowExpansion',
  'useWorkflowPinning',
  'useColumnHeights',
  'useKanbanRoleAccess',
]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'shared') continue;
      walk(full, files);
    } else if (/\.(js|jsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function updateContent(content, filePath) {
  let next = content;

  const depthPrefixes = [
    '../',
    '../../',
    '../../../',
    '../../../../',
    '../../../../../',
    '../../../../../../',
    '../../../../../../../',
  ];

  for (const p of depthPrefixes) {
    next = next.replaceAll(`${p}helpers/`, `${p}shared/helpers/`);
    next = next.replaceAll(`${p}context/`, `${p}shared/context/`);
    next = next.replaceAll(`${p}constants/`, `${p}shared/constants/`);
  }

  for (const p of depthPrefixes) {
    next = next.replaceAll(
      `${p}modules/kanban/constants/kanbanConfig`,
      `${p}shared/constants/kanbanConfig`,
    );
  }

  next = next.replaceAll('utils/utils', 'shared/utils/utils');
  next = next.replaceAll('utils/dashboardBackground', 'shared/utils/dashboardBackground');
  next = next.replaceAll('utils/encryptionUtils', 'shared/utils/encryptionUtils');
  next = next.replaceAll('utils/permissionUtils', 'shared/utils/permissionUtils');

  const sharedHookNames = [
    'useGoogleMaps',
    'useWindowSize',
    'useKanbanAddCardFromSidebar',
    'useSyncKanbanSidebarWorkflows',
  ];

  for (const hook of sharedHookNames) {
    for (const p of depthPrefixes) {
      const from = `${p}hooks/${hook}`;
      const to = `${p}shared/hooks/${hook}`;
      next = next.replaceAll(from, to);
    }
  }

  // Fix double shared/ if script runs twice
  next = next.replaceAll('/shared/shared/', '/shared/');

  // KanbanBoardPage comment in index.jsx
  next = next.replaceAll('src/helpers/', 'src/shared/helpers/');

  return next;
}

const files = walk(srcRoot);
let changed = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const updated = updateContent(original, file);
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changed += 1;
  }
}

// Update shared folder internal relative imports (helpers cross-refs stay ./)
console.log(`Updated ${changed} files`);
