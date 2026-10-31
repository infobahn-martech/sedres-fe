// Preview grid placement for template fields. Mirrors the 3-column
// .ct-preview-custom-fields-grid; positions are 1-based and persisted as
// grid_row/grid_col.
const GRID_COLUMNS = 3;

const toPositiveInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
const cellKey = (row, col) => `${row}:${col}`;

// Resolves each field's grid cell (parallel to `fields`). Stored positions win;
// fields without one (new fields, or templates saved before positions existed)
// fill the first free cells in reading order, which reproduces the old packed
// left-to-right flow.
export const resolveFieldLayout = (fields) => {
    const occupied = new Set();
    const stored = fields.map((f) => {
        const row = toPositiveInt(f.gridRow);
        const col = toPositiveInt(f.gridCol);
        if (!row || !col || col > GRID_COLUMNS || occupied.has(cellKey(row, col))) return null;
        occupied.add(cellKey(row, col));
        return { row, col };
    });
    let cursor = 0;
    return stored.map((cell) => {
        if (cell) return cell;
        let next;
        do {
            next = { row: Math.floor(cursor / GRID_COLUMNS) + 1, col: (cursor % GRID_COLUMNS) + 1 };
            cursor += 1;
        } while (occupied.has(cellKey(next.row, next.col)));
        occupied.add(cellKey(next.row, next.col));
        return next;
    });
};

// Row-major list of every cell in the grid; `index` points into `fields`, or is
// null for an empty cell. `extraRows` appends blank rows (used while dragging so
// a field can be dropped below the last row).
export const buildFieldGrid = (fields, extraRows = 0) => {
    const layout = resolveFieldLayout(fields);
    const indexByCell = new Map(layout.map((c, i) => [cellKey(c.row, c.col), i]));
    const rowCount = Math.max(0, ...layout.map((c) => c.row)) + extraRows;
    const cells = [];
    for (let row = 1; row <= rowCount; row += 1) {
        for (let col = 1; col <= GRID_COLUMNS; col += 1) {
            cells.push({ row, col, key: cellKey(row, col), index: indexByCell.get(cellKey(row, col)) ?? null });
        }
    }
    return cells;
};

// Field indices in grid reading order (row, then col) — the order a single
// stacked column lists them in.
export const getReadingOrder = (fields) => {
    const layout = resolveFieldLayout(fields);
    return fields
        .map((_, i) => i)
        .sort((a, b) => layout[a].row - layout[b].row || layout[a].col - layout[b].col);
};

// The left field list and the preview grid must always show the same order.
// After a preview drop, re-sort the fields array into grid reading order.
export const sortFieldsByLayout = (fields) => getReadingOrder(fields).map((i) => fields[i]);

// After a left-list reorder (or an insert), hand the occupied cells back out in
// the new array order, so reading order follows the list while any gaps the
// user left in the grid stay where they are.
export const alignLayoutToOrder = (fields) => {
    const cells = [...resolveFieldLayout(fields)].sort((a, b) => a.row - b.row || a.col - b.col);
    return fields.map((f, i) => ({ ...f, gridRow: cells[i].row, gridCol: cells[i].col }));
};
